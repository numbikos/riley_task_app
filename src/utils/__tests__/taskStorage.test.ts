import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadIncompleteTasks, loadCompletedTasks, loadTasksByIds, saveTasks, deleteTasks } from '../taskStorage';
import { apiRequest } from '../api';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
describe('PostgreSQL task API storage', () => {
  beforeEach(() => { request.mockReset(); });
  it('loads every page and rejects a partial result', async () => {
    request.mockResolvedValueOnce({ tasks: [{ id: 'a' }], total: 2 }).mockResolvedValueOnce({ tasks: [{ id: 'b' }], total: 2 });
    expect(await loadIncompleteTasks()).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(request.mock.calls[1][0]).toContain('offset=1');
    request.mockResolvedValueOnce({ tasks: [{ id: 'a' }], total: 2 }).mockRejectedValueOnce(new Error('Offline'));
    await expect(loadIncompleteTasks()).rejects.toThrow('Offline');
  });
  it('does not interpret network errors as an empty task list', async () => {
    request.mockRejectedValue(new Error('Offline'));
    await expect(loadIncompleteTasks()).rejects.toThrow('Offline');
    await expect(loadTasksByIds(['a'], { throwOnError: true })).rejects.toThrow('Offline');
  });
  it('passes completed task pagination and propagates failures', async () => {
    request.mockResolvedValue({ tasks: [], total: 42 });
    expect(await loadCompletedTasks(25, 25)).toEqual({ tasks: [], total: 42 });
    expect(request).toHaveBeenCalledWith('/tasks?completed=true&limit=25&offset=25');
    request.mockRejectedValue(new Error('Offline'));
    await expect(loadCompletedTasks()).rejects.toThrow('Offline');
  });
  it('empty mutations do not erase data and writes never hide failures', async () => {
    await saveTasks([]); await deleteTasks([]);
    expect(request).not.toHaveBeenCalled();
    request.mockRejectedValue(new Error('Offline'));
    await expect(deleteTasks(['a'])).rejects.toThrow('Offline');
  });
});
