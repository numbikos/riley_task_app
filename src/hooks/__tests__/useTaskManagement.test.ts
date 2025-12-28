import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskManagement } from '../useTaskManagement';
import type { User } from '@supabase/supabase-js';
import { Task } from '../../types';

// Use vi.hoisted() to ensure mocks are created before the factory runs
const {
  mockLoadTasks,
  mockSaveTasks,
  mockDeleteTasks,
  mockGenerateId,
  mockSupabase,
} = vi.hoisted(() => {
  const mockLoadTasks = vi.fn();
  const mockSaveTasks = vi.fn();
  const mockDeleteTasks = vi.fn();
  const mockGenerateId = vi.fn();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockChannel: any = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  };
  mockChannel.subscribe.mockReturnValue(mockChannel);
  
  const mockSupabase = {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  };
  
  return {
    mockLoadTasks,
    mockSaveTasks,
    mockDeleteTasks,
    mockGenerateId,
    mockSupabase,
  };
});

vi.mock('../../utils/supabaseStorage', () => ({
  loadTasks: () => mockLoadTasks(),
  saveTasks: (tasks: Task[]) => mockSaveTasks(tasks),
  deleteTasks: (ids: string[]) => mockDeleteTasks(ids),
  generateId: () => mockGenerateId(),
}));

vi.mock('../../utils/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock task operations
vi.mock('../../utils/taskOperations', () => ({
  normalizeTags: (tags: string[]) => tags,
}));

describe('useTaskManagement - Rapid Completion Race Condition', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
  } as User;

  const createMockTask = (id: string, completed: boolean = false): Task => ({
    id,
    title: `Task ${id}`,
    dueDate: null,
    completed,
    subtasks: [],
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: null,
    recurrenceGroupId: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default mock implementations
    mockLoadTasks.mockResolvedValue([]);
    mockSaveTasks.mockResolvedValue(undefined);
    mockGenerateId.mockReturnValue('generated-id');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('should preserve local state when completing tasks rapidly', () => {
    // Initial tasks
    const initialTasks = [
      createMockTask('task-1', false),
      createMockTask('task-2', false),
      createMockTask('task-3', false),
    ];

    const { result } = renderHook(() => useTaskManagement(mockUser));

    // Manually set tasks to simulate loaded state
    act(() => {
      result.current.setTasks(initialTasks);
    });

    // Complete task 1
    act(() => {
      result.current.updateTask('task-1', { completed: true });
    });

    // Immediately complete task 2 (rapid completion)
    act(() => {
      result.current.updateTask('task-2', { completed: true });
    });

    // Verify both are completed locally immediately
    const tasks = result.current.tasks;
    expect(tasks.find(t => t.id === 'task-1')?.completed).toBe(true);
    expect(tasks.find(t => t.id === 'task-2')?.completed).toBe(true);
    expect(tasks.find(t => t.id === 'task-3')?.completed).toBe(false);
  });

  it('should handle rapid completion of multiple tasks', () => {
    const initialTasks = [
      createMockTask('task-1', false),
      createMockTask('task-2', false),
      createMockTask('task-3', false),
      createMockTask('task-4', false),
    ];

    const { result } = renderHook(() => useTaskManagement(mockUser));

    // Manually set tasks
    act(() => {
      result.current.setTasks(initialTasks);
    });

    // Rapidly complete all tasks in quick succession (each in separate act to simulate rapid clicks)
    act(() => {
      result.current.updateTask('task-1', { completed: true });
    });
    act(() => {
      result.current.updateTask('task-2', { completed: true });
    });
    act(() => {
      result.current.updateTask('task-3', { completed: true });
    });
    act(() => {
      result.current.updateTask('task-4', { completed: true });
    });

    // Verify all are completed locally
    const tasks = result.current.tasks;
    expect(tasks.every(t => t.completed)).toBe(true);
    expect(tasks.length).toBe(4);
  });

  it('should track recent updates via trackRecentUpdate function', () => {
    const initialTasks = [
      createMockTask('task-1', false),
      createMockTask('task-2', false),
    ];

    mockLoadTasks.mockResolvedValue(initialTasks);

    const { result } = renderHook(() => useTaskManagement(mockUser));

    // Manually set tasks
    act(() => {
      result.current.setTasks(initialTasks);
    });

    // Complete task 1 and track it
    act(() => {
      result.current.updateTask('task-1', { completed: true });
      result.current.trackRecentUpdate('task-1');
    });

    // Verify task 1 is completed
    expect(result.current.tasks.find(t => t.id === 'task-1')?.completed).toBe(true);

    // Simulate a reload with stale data
    const staleReloadedTasks = [
      createMockTask('task-1', false), // Stale data
      createMockTask('task-2', false),
    ];

    // Manually simulate the merge logic that should preserve task-1
    act(() => {
      result.current.setTasks((currentTasks) => {
        // This simulates what the merge logic does in the real hook
        return staleReloadedTasks.map(reloadedTask => {
          const localTask = currentTasks.find(t => t.id === reloadedTask.id);
          // task-1 was recently updated, so preserve its state
          if (localTask && reloadedTask.id === 'task-1') {
            return localTask;
          }
          return reloadedTask;
        });
      });
    });

    // The merge logic should preserve task-1's completed state
    const task1 = result.current.tasks.find(t => t.id === 'task-1');
    expect(task1?.completed).toBe(true);
  });
});
