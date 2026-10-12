import pg from 'pg';
import { gunzipSync } from 'node:zlib';
import { createApp } from './app.mjs';
import { migrate, bootstrapSnapshot } from './database.mjs';

const production = process.env.NODE_ENV === 'production';
const config = {
  production, username: process.env.AUTH_USERNAME, password: process.env.AUTH_PASSWORD,
  sessionSecret: process.env.SESSION_SECRET, origin: process.env.APP_ORIGIN ?? (production ? undefined : 'http://localhost:5181'),
};
if (!process.env.DATABASE_URL || !config.username || !config.password || !config.sessionSecret || !config.origin) {
  throw new Error('Configure DATABASE_URL, AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET and APP_ORIGIN before starting.');
}
if (config.password.length < 8 || config.sessionSecret.length < 32) throw new Error('AUTH_PASSWORD needs at least 8 characters; SESSION_SECRET needs at least 32.');
const origin = new URL(config.origin);
if (origin.origin !== config.origin || (production && origin.protocol !== 'https:')) throw new Error('APP_ORIGIN must be an origin without a trailing slash, using HTTPS in production.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
pool.on('error', error => console.error('[database] Connection failed:', error.code));
await migrate(pool);
if (process.env.DATA_IMPORT_GZIP_BASE64) {
  const snapshot = JSON.parse(gunzipSync(Buffer.from(process.env.DATA_IMPORT_GZIP_BASE64, 'base64'), { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8'));
  const result = await bootstrapSnapshot(pool, snapshot);
  console.info('[migration] Initial data:', result);
  delete process.env.DATA_IMPORT_GZIP_BASE64;
}
const prune = setInterval(() => { pool.query('DELETE FROM app_sessions WHERE expire < now()').catch(error => console.error('[session] Cleanup failed:', error.code)); }, 60 * 60 * 1000).unref();
const server = createApp({ pool, config }).listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => console.info('[server] Ready'));
async function shutdown() { clearInterval(prune); server.close(async () => { await pool.end(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
