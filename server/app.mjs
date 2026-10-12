import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { tasksSchema, colorsSchema, toTask, transaction, upsertTasks, upsertColors, importSnapshot } from './database.mjs';

const digest = value => createHash('sha256').update(value).digest();
export function createApp({ pool, config }) {
  const app = express();
  app.disable('x-powered-by');
  // Railway terminates TLS at its reverse proxy.
  if (config.production) app.set('trust proxy', 1);
  app.use(helmet({
    strictTransportSecurity: config.production ? undefined : false,
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': config.production ? [] : null } },
  }));
  app.get('/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('Origin') !== config.origin || req.get('X-Requested-With') !== 'RileyTaskApp')) {
      return res.status(403).json({ error: 'Please sign in from the app.' });
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  const PgStore = connectPgSimple(session);
  app.use('/api', session({
    name: 'riley.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false,
    store: new PgStore({ pool, tableName: 'app_sessions', pruneSessionInterval: false }),
    cookie: { httpOnly: true, secure: config.production, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 },
  }));
  const passwordDigest = digest(config.password);
  const credentialVersion = digest(`${config.username}:${config.password}`).toString('hex');
  const validSession = req => req.session?.credentialVersion === credentialVersion;
  const user = { id: 'shared', email: config.username };
  app.get('/api/auth/session', (req, res) => res.json({ user: validSession(req) ? user : null }));
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } }), async (req, res) => {
    const { username, password } = z.object({ username: z.string().max(200), password: z.string().max(1000) }).parse(req.body);
    const passwordMatches = timingSafeEqual(digest(password), passwordDigest);
    if (!passwordMatches || username !== config.username) return res.status(401).json({ error: 'Incorrect username or password.' });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.credentialVersion = credentialVersion;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ user });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('riley.sid', { httpOnly: true, secure: config.production, sameSite: 'lax' }).sendStatus(204);
  });
  app.use('/api', (req, res, next) => {
    if (!validSession(req)) return res.status(401).json({ error: 'Please sign in to continue.' });
    next();
  });
  // The importer verifies every field and refuses to overwrite existing data.
  app.post('/api/migration/import', async (req, res) => {
    res.json(await importSnapshot(pool, req.body));
  });
  app.get('/api/tasks', async (req, res) => {
    const { completed, limit, offset } = z.object({ completed: z.enum(['true', 'false']).optional(),
      limit: z.coerce.number().int().min(1).max(1000).default(1000), offset: z.coerce.number().int().min(0).max(10000000).default(0) }).parse(req.query);
    const filter = completed === undefined ? null : completed === 'true';
    const result = await transaction(pool, async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows } = await client.query('SELECT * FROM tasks WHERE ($1::boolean IS NULL OR completed=$1) ORDER BY CASE WHEN completed THEN last_modified ELSE created_at END DESC, id LIMIT $2 OFFSET $3', [filter, limit, offset]);
      const count = await client.query('SELECT count(*) FROM tasks WHERE ($1::boolean IS NULL OR completed=$1)', [filter]);
      return { tasks: rows.map(toTask), total: Number(count.rows[0].count) };
    });
    res.json(result);
  });
  app.post('/api/tasks/by-ids', async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.uuid()).max(1000) }).parse(req.body);
    res.json((await pool.query('SELECT * FROM tasks WHERE id=ANY($1::uuid[])', [ids])).rows.map(toTask));
  });
  app.put('/api/tasks', async (req, res) => {
    const { tasks } = z.object({ tasks: tasksSchema.refine(value => value.length <= 1000) }).parse(req.body);
    await transaction(pool, client => upsertTasks(client, tasks)); res.sendStatus(204);
  });
  app.delete('/api/tasks', async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.uuid()).max(1000) }).parse(req.body);
    await pool.query('DELETE FROM tasks WHERE id=ANY($1::uuid[])', [ids]); res.sendStatus(204);
  });
  app.get('/api/tags', async (_req, res) => {
    const { rows } = await pool.query('SELECT DISTINCT lower(unnest(tags)) AS tag FROM tasks UNION SELECT tag FROM tag_colors ORDER BY tag');
    res.json(rows.map(row => row.tag));
  });
  app.get('/api/tag-colors', async (_req, res) => {
    res.json(Object.fromEntries((await pool.query('SELECT tag, color FROM tag_colors')).rows.map(row => [row.tag, row.color])));
  });
  app.put('/api/tag-colors', async (req, res) => {
    const { colors } = z.object({ colors: colorsSchema.refine(value => Object.keys(value).length <= 1000) }).parse(req.body);
    await transaction(pool, client => upsertColors(client, colors)); res.sendStatus(204);
  });
  app.delete('/api/tag-colors/:tag', async (req, res) => {
    const tag = z.string().min(1).max(200).parse(req.params.tag);
    await pool.query('DELETE FROM tag_colors WHERE tag=$1', [tag.toLowerCase()]); res.sendStatus(204);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  const dist = path.resolve(import.meta.dirname, '../dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError || error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request. Check the values and try again.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    console.error('[server] Request failed:', error.code ?? error.name);
    res.status(500).json({ error: 'Could not complete the request. Please try again.' });
  });
  return app;
}
