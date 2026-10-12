import { beforeEach, expect, it, vi } from 'vitest';
import { createDataBackup } from '../supabaseStorage';
const { getUser, from, range, eq } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), range: vi.fn(), eq: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth: { getUser }, from } }));
const row = (id: string) => ({ id, user_id: 'owner', title: 'Task', due_date: null, completed: true, subtasks: [], tags: ['work'], created_at: '2026-01-01T00:00:00Z', last_modified: '2026-01-02T00:00:00Z', recurrence: 'weekly', recurrence_group_id: 'group', recurrence_multiplier: null, custom_frequency: null, is_last_instance: false, auto_renew: true });
beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  range.mockReset(); eq.mockReset(); from.mockReset();
  const query = { select: vi.fn(() => query), eq: eq.mockImplementation(() => query), order: vi.fn(() => query), range };
  from.mockReturnValue(query);
});
it('exports all pages, including completed tasks and colors, scoped to the signed-in owner', async () => {
  range.mockResolvedValueOnce({ data: [row('a'), row('b')], count: 3, error: null })
    .mockResolvedValueOnce({ data: [row('c')], count: 3, error: null })
    .mockResolvedValueOnce({ data: [{ id: 'color', tag: 'work', color: '#123456' }], count: 1, error: null });
  const backup = await createDataBackup();
  expect(backup.sourceUserId).toBe('owner');
  expect(backup.tasks.map(task => task.id)).toEqual(['a', 'b', 'c']);
  expect(backup.tasks[0]).toMatchObject({ completed: true, recurrence: 'weekly', recurrenceGroupId: 'group', autoRenew: true });
  expect(backup.colors).toEqual({ work: '#123456' });
  expect(range.mock.calls[1]).toEqual([2, 501]);
  expect(eq).toHaveBeenCalledWith('user_id', 'owner');
});
it('refuses to produce a partial backup or silently miss pages', async () => {
  range.mockResolvedValueOnce({ data: [row('a')], count: 2, error: null }).mockResolvedValueOnce({ data: [], count: 2, error: null });
  await expect(createDataBackup()).rejects.toThrow('Incomplete');
});
it('rejects an unsigned-in session before querying data', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(createDataBackup()).rejects.toThrow('Sign in');
  expect(from).not.toHaveBeenCalled();
});
