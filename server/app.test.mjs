import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import { createApp } from './app.mjs';
import { migrate, importSnapshot, bootstrapSnapshot } from './database.mjs';

const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const config = { username: 'riley@example.com', password: 'test-password-12345', sessionSecret: 'a'.repeat(48), origin: 'http://localhost:5181', production: false };
const create = () => createApp({ pool, config });
const mutation = req => req.set('Origin', config.origin).set('X-Requested-With', 'RileyTaskApp');
const task = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', title: 'Recurring task', dueDate: '2026-10-12', completed: false,
  subtasks: [{ id: 'checklist-1', text: 'Do this', completed: false }], tags: ['work'],
  createdAt: '2026-01-01T00:00:00.000Z', lastModified: '2026-10-12T00:00:00.000Z', recurrence: 'custom',
  recurrenceGroupId: '22222222-2222-4222-8222-222222222222', recurrenceMultiplier: 2,
  customFrequency: 'weekly', isLastInstance: true, autoRenew: true, ...overrides,
});
async function login(app = create()) {
  const agent = request.agent(app);
  await mutation(agent.post('/api/auth/login')).send({ username: config.username, password: config.password }).expect(200);
  return agent;
}
before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Use an isolated PostgreSQL database for API tests');
  await migrate(pool);
});
beforeEach(async () => { await pool.query('TRUNCATE tasks, tag_colors, app_sessions'); await pool.query("DELETE FROM app_migrations WHERE version LIKE 'data:%'"); });
after(async () => { await pool.end(); });

test('anonymous callers cannot read or modify task data or colors', async () => {
  const app = create();
  for (const path of ['/api/tasks', '/api/tags', '/api/tag-colors']) await request(app).get(path).expect(401);
  await mutation(request(app).put('/api/tasks')).send({ tasks: [task()] }).expect(401);
  await mutation(request(app).delete('/api/tasks')).send({ ids: [task().id] }).expect(401);
  await mutation(request(app).post('/api/migration/import')).send({}).expect(401);
});
test('shared login rejects invalid passwords, persists across app restarts, and logout revokes access', async () => {
  const app = create();
  await mutation(request(app).post('/api/auth/login')).send({ username: config.username, password: 'wrong' }).expect(401);
  const response = await mutation(request(app).post('/api/auth/login')).send({ username: config.username, password: config.password }).expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  const restarted = create();
  const session = await request(restarted).get('/api/auth/session').set('Cookie', cookie).expect(200);
  assert.equal(session.body.user.email, config.username);
  await mutation(request(restarted).post('/api/auth/logout').set('Cookie', cookie)).expect(204);
  await request(app).get('/api/tasks').set('Cookie', cookie).expect(401);
});
test('credential rotation invalidates existing sessions', async () => {
  const response = await mutation(request(create()).post('/api/auth/login')).send({ username: config.username, password: config.password });
  const rotated = createApp({ pool, config: { ...config, password: 'another-password-12345' } });
  await request(rotated).get('/api/tasks').set('Cookie', response.headers['set-cookie'][0]).expect(401);
});
test('cross-site mutations and malformed tasks are rejected without changing the database', async () => {
  const agent = await login();
  await agent.put('/api/tasks').set('Origin', 'https://evil.example').set('X-Requested-With', 'RileyTaskApp').send({ tasks: [task()] }).expect(403);
  await agent.put('/api/tasks').send({ tasks: [task()] }).expect(403);
  await mutation(agent.put('/api/tasks')).send({ tasks: [task({ dueDate: '2026-02-30' })] }).expect(400);
  assert.equal((await pool.query('SELECT count(*) FROM tasks')).rows[0].count, '0');
});
test('tasks round-trip every recurrence field, paginate completed tasks, and delete only explicit IDs', async () => {
  const agent = await login();
  await mutation(agent.put('/api/tasks')).send({ tasks: [task()] }).expect(204);
  let response = await agent.get('/api/tasks?completed=false').expect(200);
  assert.deepEqual(response.body.tasks, [task()]);
  await mutation(agent.put('/api/tasks')).send({ tasks: [] }).expect(204);
  await mutation(agent.put('/api/tasks')).send({ tasks: [task({ completed: true }), task({ id: '33333333-3333-4333-8333-333333333333', completed: true })] }).expect(204);
  response = await agent.get('/api/tasks?completed=true&limit=1&offset=1').expect(200);
  assert.equal(response.body.total, 2); assert.equal(response.body.tasks.length, 1);
  await mutation(agent.delete('/api/tasks')).send({ ids: [task().id] }).expect(204);
  assert.equal((await agent.get('/api/tasks')).body.total, 1);
});
test('tags include task tags and stored colors; color writes and deletes persist', async () => {
  const agent = await login();
  await mutation(agent.put('/api/tasks')).send({ tasks: [task()] }).expect(204);
  await mutation(agent.put('/api/tag-colors')).send({ colors: { Personal: '#aabbcc' } }).expect(204);
  assert.deepEqual((await agent.get('/api/tags')).body, ['personal', 'work']);
  assert.deepEqual((await agent.get('/api/tag-colors')).body, { personal: '#aabbcc' });
  await mutation(agent.delete('/api/tag-colors/Personal')).expect(204);
  assert.deepEqual((await agent.get('/api/tag-colors')).body, {});
});
test('snapshot import preserves all data, verifies it, and refuses to overwrite existing tasks', async () => {
  const snapshot = { version: 1, sourceUserId: 'source-user', exportedAt: new Date().toISOString(), tasks: [task()], colors: { work: '#123456' } };
  const counts = await importSnapshot(pool, snapshot);
  assert.deepEqual(counts, { tasks: 1, colors: 1 });
  const agent = await login();
  assert.deepEqual((await agent.get('/api/tasks')).body.tasks, snapshot.tasks);
  await assert.rejects(importSnapshot(pool, snapshot), /empty/);
  assert.equal((await agent.get('/api/tasks')).body.total, 1);
});
test('authenticated HTTP import verifies a snapshot through the app private database connection', async () => {
  const agent = await login();
  const snapshot = { version: 1, sourceUserId: 'source-user', exportedAt: new Date().toISOString(), tasks: [task()], colors: { work: '#123456' } };
  const response = await mutation(agent.post('/api/migration/import')).send(snapshot).expect(200);
  assert.deepEqual(response.body, { tasks: 1, colors: 1 });
  assert.deepEqual((await agent.get('/api/tasks')).body.tasks, snapshot.tasks);
});
test('legacy Supabase backups retain recurrence fields and shorthand tag colors', async () => {
  const agent = await login();
  const legacyTask = task({ recurrence: 'daily', recurrenceMultiplier: undefined, customFrequency: null });
  const snapshot = { version: 1, sourceUserId: 'source-user', exportedAt: new Date().toISOString(), tasks: [legacyTask], colors: { work: '#888' } };
  await mutation(agent.post('/api/migration/import')).send(snapshot).expect(200);
  const { customFrequency, ...expected } = JSON.parse(JSON.stringify(legacyTask));
  assert.deepEqual((await agent.get('/api/tasks')).body.tasks, [expected]);
  assert.deepEqual((await agent.get('/api/tag-colors')).body, snapshot.colors);
});
test('deployment bootstrap imports once and preserves subsequent edits across restarts', async () => {
  const snapshot = { version: 1, sourceUserId: 'source-user', exportedAt: new Date().toISOString(), tasks: [task()], colors: {} };
  assert.deepEqual(await bootstrapSnapshot(pool, snapshot), { imported: true, tasks: 1, colors: 0 });
  await pool.query("UPDATE tasks SET title='Edited after migration'");
  assert.deepEqual(await bootstrapSnapshot(pool, snapshot), { imported: false });
  assert.equal((await pool.query('SELECT title FROM tasks')).rows[0].title, 'Edited after migration');
});
