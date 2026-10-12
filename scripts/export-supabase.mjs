import { writeFile } from 'node:fs/promises';
import pg from 'pg';
import { snapshotSchema, toTask } from '../server/database.mjs';

const filename = process.argv[2];
if (!filename) throw new Error('Pass an output filename; exports contain private task data.');
let sourceUserId, taskRows, colorRows;
if (process.env.SOURCE_DATABASE_URL) {
  sourceUserId = process.env.SOURCE_USER_ID;
  if (!sourceUserId) throw new Error('Set SOURCE_USER_ID to the exact Supabase user to export.');
  const pool = new pg.Pool({ connectionString: process.env.SOURCE_DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const users = await client.query('SELECT id FROM auth.users WHERE id=$1::uuid', [sourceUserId]);
    if (!users.rowCount) throw new Error('The specified source user does not exist.');
    taskRows = (await client.query('SELECT * FROM public.tasks WHERE user_id=$1 ORDER BY id', [sourceUserId])).rows;
    colorRows = (await client.query('SELECT tag, color FROM public.tag_colors WHERE user_id=$1 ORDER BY tag', [sourceUserId])).rows;
    await client.query('COMMIT');
  } finally { client.release(); await pool.end(); }
} else {
  const url = process.env.SUPABASE_URL;
  const apikey = process.env.SUPABASE_ANON_KEY;
  if (!url || !apikey || !process.env.SUPABASE_EMAIL || !process.env.SUPABASE_PASSWORD) {
    throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_EMAIL and SUPABASE_PASSWORD, or use SOURCE_DATABASE_URL and SOURCE_USER_ID.');
  }
  if (new URL(url).protocol !== 'https:') throw new Error('Use an HTTPS Supabase URL.');
  const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SUPABASE_EMAIL, password: process.env.SUPABASE_PASSWORD }), signal: AbortSignal.timeout(30000),
  });
  if (!signIn.ok) throw new Error(`Supabase sign-in failed (${signIn.status}); check the source login.`);
  const auth = await signIn.json();
  sourceUserId = auth.user.id;
  const headers = { apikey, Authorization: `Bearer ${auth.access_token}`, Prefer: 'count=exact' };
  async function readTable(table, order) {
    const rows = [];
    let expected = null;
    for (;;) {
      const query = new URLSearchParams({ select: '*', user_id: `eq.${sourceUserId}`, order, limit: '500', offset: String(rows.length) });
      const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Could not export ${table} (${response.status}); no snapshot was written.`);
      const count = Number(response.headers.get('content-range')?.split('/')[1]);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Supabase did not return an exact row count.');
      if (expected !== null && count !== expected) throw new Error('Source data changed during export. Stop editing tasks and export again.');
      expected = count;
      const page = await response.json();
      rows.push(...page);
      if (rows.length === expected) return rows;
      if (!page.length || rows.length > expected) throw new Error('Incomplete export; no snapshot was written.');
    }
  }
  [taskRows, colorRows] = await Promise.all([readTable('tasks', 'id.asc'), readTable('tag_colors', 'tag.asc')]);
}
const colors = Object.fromEntries(colorRows.map(row => [row.tag, row.color]));
if (Object.keys(colors).length !== colorRows.length) throw new Error('Duplicate source tag colors.');
const snapshot = snapshotSchema.parse({ version: 1, sourceUserId, exportedAt: new Date().toISOString(), tasks: taskRows.map(toTask), colors });
// Never overwrite an earlier backup, and keep it readable only by its owner.
await writeFile(filename, JSON.stringify(snapshot, null, 2), { flag: 'wx', mode: 0o600 });
console.info(`[export] Saved ${snapshot.tasks.length} tasks and ${colorRows.length} tag colors.`);
