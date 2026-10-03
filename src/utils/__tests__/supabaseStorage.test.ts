import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTasks, loadIncompleteTasks, loadCompletedTasks, loadTags, saveTasks } from '../supabaseStorage';
import { logger } from '../logger';

const { mockGetUser, mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface DbTask {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  subtasks: Array<{ id: string; text: string; completed: boolean }>;
  tags: string[];
  created_at: string;
  last_modified: string;
  recurrence: string | null;
  recurrence_group_id: string | null;
  recurrence_multiplier: number | null;
  custom_frequency: string | null;
  is_last_instance: boolean;
  auto_renew: boolean;
}

const baseDbTask: DbTask = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Test task',
  due_date: '2024-01-01',
  completed: false,
  subtasks: [],
  tags: [],
  created_at: '2024-01-01T00:00:00.000Z',
  last_modified: '2024-01-01T00:00:00.000Z',
  recurrence: null,
  recurrence_group_id: null,
  recurrence_multiplier: null,
  custom_frequency: null,
  is_last_instance: false,
  auto_renew: false,
};

const makeDbTask = (overrides: Partial<DbTask> = {}): DbTask => ({
  ...baseDbTask,
  ...overrides,
});

const setupLoadTasksMocks = (data: DbTask[], count: number | null) => {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  });

  const mockLimit = vi.fn().mockResolvedValue({ data: data.slice(0, 1), error: null });
  const mockOrder = vi.fn().mockResolvedValue({ data, error: null, count });
  const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = vi.fn((columns: string) => {
    if (columns === '*') {
      return { eq: mockEq };
    }
    return { limit: mockLimit };
  });

  mockFrom.mockReturnValue({ select: mockSelect });

  return { mockSelect };
};

describe('loadTasks pagination diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('warns when count exceeds returned rows', async () => {
    const data = [makeDbTask({ id: 'task-1' }), makeDbTask({ id: 'task-2' })];
    const { mockSelect } = setupLoadTasksMocks(data, 5);

    const tasks = await loadTasks();

    expect(tasks).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[loadTasks] Returned 2 of 5 tasks')
    );
  });

  it('does not warn when count matches returned rows', async () => {
    const data = [makeDbTask({ id: 'task-1' }), makeDbTask({ id: 'task-2' })];
    setupLoadTasksMocks(data, 2);

    await loadTasks();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// Helper to setup mocks for loadIncompleteTasks
const setupIncompleteTasksMocks = (batches: DbTask[][]) => {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });

  let callCount = 0;
  const mockRange = vi.fn().mockImplementation(() => {
    const batch = batches[callCount] || [];
    callCount++;
    return Promise.resolve({ data: batch, error: null });
  });
  const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
  const mockEqCompleted = vi.fn().mockReturnValue({ order: mockOrder });
  const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqCompleted });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserId });

  mockFrom.mockReturnValue({ select: mockSelect });

  return { mockSelect, mockEqCompleted, mockRange };
};

// Helper to setup mocks for loadCompletedTasks
const setupCompletedTasksMocks = (data: DbTask[], total: number) => {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });

  const mockRange = vi.fn().mockResolvedValue({ data, error: null, count: total });
  const mockOrderId = vi.fn().mockReturnValue({ range: mockRange });
  const mockOrderLastModified = vi.fn().mockReturnValue({ order: mockOrderId });
  const mockEqCompleted = vi.fn().mockReturnValue({ order: mockOrderLastModified });
  const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqCompleted });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserId });

  mockFrom.mockReturnValue({ select: mockSelect });

  return { mockSelect, mockEqCompleted, mockOrderLastModified, mockOrderId, mockRange };
};

describe('loadIncompleteTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only incomplete tasks', async () => {
    const incompleteTasks = [
      makeDbTask({ id: 'task-1', completed: false }),
      makeDbTask({ id: 'task-2', completed: false }),
    ];
    const { mockEqCompleted } = setupIncompleteTasksMocks([incompleteTasks, []]);

    const tasks = await loadIncompleteTasks();

    expect(tasks).toHaveLength(2);
    expect(mockEqCompleted).toHaveBeenCalledWith('completed', false);
  });

  it('returns empty array when no incomplete tasks exist', async () => {
    setupIncompleteTasksMocks([[]]);

    const tasks = await loadIncompleteTasks();

    expect(tasks).toHaveLength(0);
  });

  it('handles auth errors gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth error' },
    });

    const tasks = await loadIncompleteTasks();

    expect(tasks).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      '[loadIncompleteTasks] Auth error:',
      expect.any(Object)
    );
  });

  it('internally paginates when more than batch size tasks exist', async () => {
    // First batch returns 1000 tasks (full batch), second returns 500 (partial), third returns empty
    const batch1 = Array.from({ length: 1000 }, (_, i) =>
      makeDbTask({ id: `task-${i}`, completed: false })
    );
    const batch2 = Array.from({ length: 500 }, (_, i) =>
      makeDbTask({ id: `task-${1000 + i}`, completed: false })
    );
    const { mockRange } = setupIncompleteTasksMocks([batch1, batch2, []]);

    const tasks = await loadIncompleteTasks();

    expect(tasks).toHaveLength(1500);
    // Should have called range multiple times for pagination
    // New logic continues until receiving empty result (3 calls: 1000, 500, then empty)
    expect(mockRange).toHaveBeenCalledTimes(3);
  });
});

describe('loadCompletedTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated completed tasks with correct limit/offset', async () => {
    const completedTasks = [
      makeDbTask({ id: 'task-1', completed: true }),
      makeDbTask({ id: 'task-2', completed: true }),
    ];
    const { mockRange } = setupCompletedTasksMocks(completedTasks, 50);

    const result = await loadCompletedTasks(25, 0);

    expect(result.tasks).toHaveLength(2);
    expect(result.total).toBe(50);
    expect(mockRange).toHaveBeenCalledWith(0, 24); // offset to offset + limit - 1
  });

  it('returns correct total count for progress display', async () => {
    const completedTasks = [makeDbTask({ id: 'task-1', completed: true })];
    setupCompletedTasksMocks(completedTasks, 100);

    const result = await loadCompletedTasks(25, 0);

    expect(result.total).toBe(100);
  });

  it('handles offset beyond available tasks', async () => {
    setupCompletedTasksMocks([], 50);

    const result = await loadCompletedTasks(25, 100);

    expect(result.tasks).toHaveLength(0);
    expect(result.total).toBe(50);
  });

  it('orders by last_modified desc then id desc for stable pagination', async () => {
    const completedTasks = [makeDbTask({ id: 'task-1', completed: true })];
    const { mockOrderLastModified, mockOrderId } = setupCompletedTasksMocks(completedTasks, 1);

    await loadCompletedTasks(25, 0);

    expect(mockOrderLastModified).toHaveBeenCalledWith('last_modified', { ascending: false });
    expect(mockOrderId).toHaveBeenCalledWith('id', { ascending: false });
  });

  it('handles auth errors gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth error' },
    });

    const result = await loadCompletedTasks(25, 0);

    expect(result.tasks).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('loadTags', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it('collects tags from all task pages and from tag_colors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });

    const firstPage = Array.from({ length: 1000 }, (_, i) => ({ tags: i === 0 ? ['Work'] : [] }));
    const secondPage = [{ tags: ['home'] }, { tags: null }];
    const mockRange = vi.fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const tasksQuery = {
      select: vi.fn(() => tasksQuery),
      eq: vi.fn(() => tasksQuery),
      order: vi.fn(() => tasksQuery),
      range: mockRange,
    };
    const tagColorsQuery = {
      select: vi.fn(() => tagColorsQuery),
      eq: vi.fn().mockResolvedValue({ data: [{ tag: 'Errands' }], error: null }),
    };
    mockFrom.mockImplementation((table: string) => (table === 'tasks' ? tasksQuery : tagColorsQuery));

    const tags = await loadTags();

    expect(tasksQuery.select).toHaveBeenCalledWith('tags');
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(tags.sort()).toEqual(['errands', 'home', 'work']);
  });
});

describe('error reporting for sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveTasks rejects instead of silently succeeding when there is no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'fetch failed' } });

    await expect(saveTasks([{
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Task',
      dueDate: null,
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: null,
      recurrenceGroupId: null,
    }])).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('loadIncompleteTasks throws on auth errors when asked to', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'fetch failed' } });

    await expect(loadIncompleteTasks({ throwOnError: true })).rejects.toThrow();
    await expect(loadIncompleteTasks()).resolves.toEqual([]);
  });
});
