import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import pg from 'pg';
import { z } from 'zod';

// Keep calendar dates as YYYY-MM-DD regardless of the server's timezone.
pg.types.setTypeParser(1082, value => value);
const frequency = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
export const taskSchema = z.object({
  id: z.uuid(), title: z.string().min(1).max(10000), dueDate: z.iso.date().nullable(),
  completed: z.boolean(), subtasks: z.array(z.object({ id: z.string().min(1).max(200), text: z.string().max(10000), completed: z.boolean() })).max(1000),
  tags: z.array(z.string().min(1).max(200)).max(100), createdAt: z.iso.datetime({ offset: true }), lastModified: z.iso.datetime({ offset: true }),
  recurrence: z.enum([...frequency.options, 'custom']).nullable(), recurrenceGroupId: z.uuid().nullable(),
  recurrenceMultiplier: z.number().int().min(1).max(50).optional(), customFrequency: frequency.optional(),
  isLastInstance: z.boolean().default(false), autoRenew: z.boolean().default(false),
});
export const colorsSchema = z.record(z.string().min(1).max(200), z.string().regex(/^#[0-9a-fA-F]{6}$/));
export const tasksSchema = z.array(taskSchema).superRefine((tasks, ctx) => {
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) ctx.addIssue({ code: 'custom', message: 'Duplicate task IDs' });
});
export const snapshotSchema = z.object({ version: z.literal(1), sourceUserId: z.string().min(1), exportedAt: z.iso.datetime(), tasks: tasksSchema, colors: colorsSchema });
export function toTask(row) {
  return {
    id: row.id, title: row.title, dueDate: row.due_date, completed: row.completed, subtasks: row.subtasks ?? [], tags: row.tags ?? [],
    createdAt: new Date(row.created_at).toISOString(), lastModified: new Date(row.last_modified).toISOString(),
    recurrence: row.recurrence, recurrenceGroupId: row.recurrence_group_id,
    ...(row.recurrence_multiplier != null ? { recurrenceMultiplier: row.recurrence_multiplier } : {}),
    ...(row.custom_frequency != null ? { customFrequency: row.custom_frequency } : {}),
    isLastInstance: row.is_last_instance ?? false, autoRenew: row.auto_renew ?? false,
  };
}
export async function transaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function migrate(pool) {
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(74623581)');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    if (!(await client.query("SELECT 1 FROM app_migrations WHERE version = '001'")).rowCount) {
      await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
      await client.query("INSERT INTO app_migrations (version) VALUES ('001')");
    }
  });
}
export async function upsertTasks(client, tasks) {
  if (!tasks.length) return;
  await client.query(`
    INSERT INTO tasks (id, title, due_date, completed, subtasks, tags, created_at, last_modified,
      recurrence, recurrence_group_id, recurrence_multiplier, custom_frequency, is_last_instance, auto_renew)
    SELECT id, title, "dueDate", completed, subtasks, tags, "createdAt", "lastModified", recurrence,
      "recurrenceGroupId", "recurrenceMultiplier", "customFrequency", "isLastInstance", "autoRenew"
    FROM jsonb_to_recordset($1::jsonb) AS t(id uuid, title text, "dueDate" date, completed boolean,
      subtasks jsonb, tags text[], "createdAt" timestamptz, "lastModified" timestamptz, recurrence text,
      "recurrenceGroupId" uuid, "recurrenceMultiplier" integer, "customFrequency" text, "isLastInstance" boolean, "autoRenew" boolean)
    ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, due_date=EXCLUDED.due_date, completed=EXCLUDED.completed,
      subtasks=EXCLUDED.subtasks, tags=EXCLUDED.tags, last_modified=EXCLUDED.last_modified, recurrence=EXCLUDED.recurrence,
      recurrence_group_id=EXCLUDED.recurrence_group_id, recurrence_multiplier=EXCLUDED.recurrence_multiplier,
      custom_frequency=EXCLUDED.custom_frequency, is_last_instance=EXCLUDED.is_last_instance, auto_renew=EXCLUDED.auto_renew`, [JSON.stringify(tasks)]);
}
export async function upsertColors(client, colors) {
  for (const [tag, color] of Object.entries(colors)) {
    await client.query('INSERT INTO tag_colors (tag, color) VALUES ($1, $2) ON CONFLICT (tag) DO UPDATE SET color=EXCLUDED.color', [tag.toLowerCase(), color]);
  }
}
async function importIntoClient(client, snapshot) {
  const normalizedColors = Object.fromEntries(Object.entries(snapshot.colors).map(([tag, color]) => [tag.toLowerCase(), color]));
  if (Object.keys(normalizedColors).length !== Object.keys(snapshot.colors).length) throw new Error('Duplicate normalized tag colors');
    await client.query('LOCK TABLE tasks, tag_colors IN ACCESS EXCLUSIVE MODE');
    const existing = await client.query('SELECT (SELECT count(*) FROM tasks) + (SELECT count(*) FROM tag_colors) AS count');
    if (Number(existing.rows[0].count)) throw new Error('Import requires an empty destination database; existing data was not changed');
    await upsertTasks(client, snapshot.tasks);
    await upsertColors(client, normalizedColors);
    const actual = (await client.query('SELECT * FROM tasks ORDER BY id')).rows.map(toTask);
    const expected = snapshot.tasks.map(task => ({ ...task, createdAt: new Date(task.createdAt).toISOString(), lastModified: new Date(task.lastModified).toISOString() })).sort((a, b) => a.id.localeCompare(b.id));
    const colors = Object.fromEntries((await client.query('SELECT tag, color FROM tag_colors')).rows.map(row => [row.tag, row.color]));
    if (!isDeepStrictEqual(actual, expected) || !isDeepStrictEqual(colors, normalizedColors)) throw new Error('Import verification failed; transaction rolled back');
    return { tasks: actual.length, colors: Object.keys(colors).length };
}
export async function importSnapshot(pool, input) {
  const snapshot = snapshotSchema.parse(input);
  return transaction(pool, client => importIntoClient(client, snapshot));
}
// A deploy can carry its initial snapshot as a private, compressed Railway variable.
// The marker is committed with the data, so retries and restarts cannot import it twice.
export async function bootstrapSnapshot(pool, input) {
  const snapshot = snapshotSchema.parse(input);
  const version = `data:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}`;
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(74623581)');
    if ((await client.query('SELECT 1 FROM app_migrations WHERE version=$1', [version])).rowCount) return { imported: false };
    const counts = await importIntoClient(client, snapshot);
    await client.query('INSERT INTO app_migrations (version) VALUES ($1)', [version]);
    return { imported: true, ...counts };
  });
}
