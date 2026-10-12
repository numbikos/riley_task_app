import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrate, importSnapshot } from '../server/database.mjs';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the destination PostgreSQL database.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
try {
  await migrate(pool);
  const [command, filename] = process.argv.slice(2);
  if (command === 'migrate') console.info('[database] Schema is current.');
  else if (command === 'import' && filename) {
    const counts = await importSnapshot(pool, JSON.parse(await readFile(filename, 'utf8')));
    console.info(`[database] Imported and verified ${counts.tasks} tasks and ${counts.colors} tag colors.`);
  } else throw new Error('Usage: database.mjs migrate | import <snapshot.json>');
} finally { await pool.end(); }
