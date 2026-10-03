import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { Task } from '../../types';
import { useTaskManagement } from '../useTaskManagement';

const {
  mockLoadIncompleteTasks,
  mockLoadCompletedTasks,
  mockLoadTasksByIds,
  mockSaveTasks,
  mockDeleteTasks,
} = vi.hoisted(() => ({
  mockLoadIncompleteTasks: vi.fn(),
  mockLoadCompletedTasks: vi.fn(),
  mockLoadTasksByIds: vi.fn(),
  mockSaveTasks: vi.fn(),
  mockDeleteTasks: vi.fn(),
}));

vi.mock('../../utils/supabaseStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/supabaseStorage')>();
  return {
    ...actual,
    loadIncompleteTasks: mockLoadIncompleteTasks,
    loadCompletedTasks: mockLoadCompletedTasks,
    loadTasksByIds: mockLoadTasksByIds,
    saveTasks: mockSaveTasks,
    deleteTasks: mockDeleteTasks,
  };
});

vi.mock('../../utils/supabase', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const user = { id: 'user-1', email: 'user@example.com' } as User;

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).slice(2, 11)}`,
  title: 'Task',
  dueDate: '2026-03-02',
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-01-01T00:00:00.000Z',
  recurrence: null,
  recurrenceGroupId: null,
  isLastInstance: false,
  autoRenew: false,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
};

const savedTasks = (): Task[] => mockSaveTasks.mock.calls.flatMap(call => call[0] as Task[]);

const renderLoadedHook = async (incompleteTasks: Task[], expectedCount = incompleteTasks.length) => {
  mockLoadIncompleteTasks.mockResolvedValue(incompleteTasks);
  const hook = renderHook(() => useTaskManagement(user));
  await waitFor(() => expect(hook.result.current.tasks.length).toBe(expectedCount));
  return hook;
};

describe('useTaskManagement syncing', () => {
  beforeEach(() => {
    mockLoadIncompleteTasks.mockReset();
    mockLoadCompletedTasks.mockReset();
    mockLoadTasksByIds.mockReset();
    mockSaveTasks.mockReset();
    mockDeleteTasks.mockReset();

    mockLoadCompletedTasks.mockResolvedValue({ tasks: [], total: 0 });
    mockLoadTasksByIds.mockResolvedValue([]);
    mockSaveTasks.mockResolvedValue(undefined);
    mockDeleteTasks.mockResolvedValue(undefined);
  });

  it('does not re-save tasks right after loading them', async () => {
    await renderLoadedHook([createTask({ id: 'a' })]);

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockSaveTasks).not.toHaveBeenCalled();
  });

  it('saves only the tasks that changed', async () => {
    const { result } = await renderLoadedHook([createTask({ id: 'a' }), createTask({ id: 'b' })]);

    act(() => {
      result.current.updateTask('a', { completed: true });
    });

    await waitFor(() => expect(mockSaveTasks).toHaveBeenCalledTimes(1));
    expect(mockSaveTasks.mock.calls[0][0].map((t: Task) => t.id)).toEqual(['a']);
  });

  it('saves a change made while an earlier save is still in flight', async () => {
    const { result } = await renderLoadedHook([createTask({ id: 'a' }), createTask({ id: 'b' })]);

    const firstSave = deferred<void>();
    mockSaveTasks.mockReturnValueOnce(firstSave.promise);

    act(() => {
      result.current.updateTask('a', { completed: true });
    });
    await waitFor(() => expect(mockSaveTasks).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.updateTask('b', { completed: true });
    });

    await act(async () => {
      firstSave.resolve();
    });

    await waitFor(() => expect(mockSaveTasks).toHaveBeenCalledTimes(2));
    expect(mockSaveTasks.mock.calls[1][0].map((t: Task) => t.id)).toEqual(['b']);
  });

  it('keeps and saves edits and new tasks made while a background refresh is running', async () => {
    const taskA = createTask({ id: 'a' });
    const taskB = createTask({ id: 'b' });
    const { result } = await renderLoadedHook([taskA, taskB]);

    const refresh = deferred<Task[]>();
    mockLoadIncompleteTasks.mockReturnValueOnce(refresh.promise);

    // Window focus triggers a background refresh of incomplete tasks
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(mockLoadIncompleteTasks).toHaveBeenCalledTimes(2), { timeout: 2000 });

    // User completes a task and adds a new one while the refresh is in flight
    act(() => {
      result.current.updateTask('b', { completed: true });
    });
    act(() => {
      result.current.addTask({ title: 'Added during refresh', dueDate: '2026-03-03' });
    });

    // Database still has the old state
    await act(async () => {
      refresh.resolve([taskA, taskB]);
    });

    await waitFor(() => {
      const saved = savedTasks();
      expect(saved.some(t => t.id === 'b' && t.completed)).toBe(true);
      expect(saved.some(t => t.title === 'Added during refresh')).toBe(true);
    }, { timeout: 2000 });

    expect(result.current.tasks.find(t => t.id === 'b')?.completed).toBe(true);
    expect(result.current.tasks.some(t => t.title === 'Added during refresh')).toBe(true);
  });

  it('picks up changes from another device on refresh', async () => {
    const taskA = createTask({ id: 'a', title: 'Old title' });
    const { result } = await renderLoadedHook([taskA]);

    mockLoadIncompleteTasks.mockResolvedValueOnce([{ ...taskA, title: 'Renamed elsewhere' }]);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.tasks[0].title).toBe('Renamed elsewhere'), { timeout: 2000 });
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(mockSaveTasks).not.toHaveBeenCalled();
  });

  it('keeps tasks on screen when a background refresh fails', async () => {
    const { result } = await renderLoadedHook([createTask({ id: 'a' }), createTask({ id: 'b' })]);

    mockLoadIncompleteTasks.mockRejectedValueOnce(new Error('Network error'));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(mockLoadIncompleteTasks).toHaveBeenCalledTimes(2), { timeout: 2000 });
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(result.current.tasks.map(t => t.id)).toEqual(['a', 'b']);
  });

  it('retries a failed save automatically', async () => {
    const { result } = await renderLoadedHook([createTask({ id: 'a' })]);

    mockSaveTasks.mockRejectedValueOnce(new Error('Network error'));

    act(() => {
      result.current.updateTask('a', { completed: true });
    });

    await waitFor(() => expect(mockSaveTasks).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(mockSaveTasks.mock.calls[1][0].map((t: Task) => t.id)).toEqual(['a']);
  });

  it('lets remote changes through once a local edit is no longer recent', async () => {
    const { result } = await renderLoadedHook([createTask({ id: 'a', title: 'Local edit' })]);

    act(() => {
      result.current.updateTask('a', { title: 'Edited here' });
    });
    await waitFor(() => expect(mockSaveTasks).toHaveBeenCalled());
    const savedA = result.current.tasks[0];

    // Wait past the "recently updated" window, then another device renames the task
    await new Promise(resolve => setTimeout(resolve, 2100));
    mockLoadIncompleteTasks.mockResolvedValueOnce([{ ...savedA, title: 'Renamed elsewhere' }]);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.tasks[0].title).toBe('Renamed elsewhere'), { timeout: 2000 });
  });

  it('skips completed tasks that are already loaded when loading more', async () => {
    const completed = createTask({ id: 'done-1', completed: true });
    mockLoadCompletedTasks.mockResolvedValueOnce({ tasks: [completed], total: 2 });
    const { result } = await renderLoadedHook([createTask({ id: 'a' })], 2);

    mockLoadCompletedTasks.mockResolvedValueOnce({
      tasks: [completed, createTask({ id: 'done-2', completed: true })],
      total: 2,
    });

    await act(async () => {
      await result.current.loadMoreCompletedTasks();
    });

    expect(result.current.tasks.map(t => t.id)).toEqual(['a', 'done-1', 'done-2']);
  });
});
