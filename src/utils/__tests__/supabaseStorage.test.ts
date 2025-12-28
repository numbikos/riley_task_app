import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadTasks,
  saveTasks,
  deleteTask,
  deleteTasks,
  generateId,
} from '../supabaseStorage';
import { Task } from '../../types';

// Use vi.hoisted() to ensure mocks are created before the factory runs
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: mockSupabase,
}));

// Mock logger to avoid console noise
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('supabaseStorage helper functions', () => {
  describe('generateId', () => {
    it('should generate a UUID-like string', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });
});

describe('supabaseStorage core operations', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSession = {
    user: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadTasks', () => {
    it('should load tasks from Supabase', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          user_id: 'user-123',
          title: 'Test Task 1',
          due_date: '2024-01-15',
          completed: false,
          subtasks: [],
          tags: ['work'],
          created_at: '2024-01-01T00:00:00.000Z',
          last_modified: '2024-01-01T00:00:00.000Z',
          recurrence: 'daily',
          recurrence_group_id: 'group-1',
          recurrence_multiplier: null,
          custom_frequency: null,
          is_last_instance: false,
          auto_renew: true,
        },
        {
          id: 'task-2',
          user_id: 'user-123',
          title: 'Test Task 2',
          due_date: null,
          completed: true,
          subtasks: [],
          tags: [],
          created_at: '2024-01-02T00:00:00.000Z',
          last_modified: '2024-01-02T00:00:00.000Z',
          recurrence: null,
          recurrence_group_id: null,
          recurrence_multiplier: null,
          custom_frequency: null,
          is_last_instance: false,
          auto_renew: false,
        },
      ];

      // loadTasks makes two calls to from('tasks'):
      // 1. Debug check: .select('id, title, user_id, completed, due_date').limit(10)
      // 2. Actual query: .select('*').eq('user_id', user.id).order('created_at', ...)
      const mockLimit = vi.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockOrder = vi.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockImplementation(() => ({
        limit: mockLimit,
        eq: mockEq,
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });

      const tasks = await loadTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].title).toBe('Test Task 1');
      expect(tasks[0].dueDate).toBe('2024-01-15');
      expect(tasks[0].recurrence).toBe('daily');
      expect(tasks[0].recurrenceGroupId).toBe('group-1');
      expect(tasks[1].id).toBe('task-2');
      expect(tasks[1].completed).toBe(true);
    });

    it('should return empty array when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const tasks = await loadTasks();
      expect(tasks).toEqual([]);
    });

    it('should return empty array on auth error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const tasks = await loadTasks();
      expect(tasks).toEqual([]);
    });

    it('should return empty array on database error', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const mockEq = vi.fn().mockReturnValue({
        order: mockOrder,
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });

      const tasks = await loadTasks();
      expect(tasks).toEqual([]);
    });

    it('should handle tasks with missing optional fields', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          user_id: 'user-123',
          title: 'Test Task',
          due_date: '2024-01-15',
          completed: false,
          subtasks: null,
          tags: null,
          created_at: '2024-01-01T00:00:00.000Z',
          last_modified: '2024-01-01T00:00:00.000Z',
          recurrence: null,
          recurrence_group_id: null,
          recurrence_multiplier: null,
          custom_frequency: null,
          is_last_instance: false,
          auto_renew: false,
        },
      ];

      // loadTasks makes two calls to from('tasks')
      const mockLimit = vi.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockOrder = vi.fn().mockResolvedValue({ data: mockTasks, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockImplementation(() => ({
        limit: mockLimit,
        eq: mockEq,
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });

      const tasks = await loadTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].subtasks).toEqual([]);
      expect(tasks[0].tags).toEqual([]);
    });
  });

  describe('saveTasks', () => {
    it('should save tasks to Supabase', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Test Task 1',
          dueDate: '2024-01-15',
          completed: false,
          subtasks: [],
          tags: ['work'],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
          recurrence: 'daily',
          recurrenceGroupId: 'group-1',
        },
      ];

      const mockUpsert = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await saveTasks(tasks);

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0];
      expect(upsertCall[0]).toHaveLength(1);
      expect(upsertCall[0][0].user_id).toBe('user-123');
      expect(upsertCall[0][0].title).toBe('Test Task 1');
      expect(upsertCall[1]).toEqual({
        onConflict: 'id',
        ignoreDuplicates: false,
      });
    });

    it('should skip saving when tasks array is empty', async () => {
      await saveTasks([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Test Task',
          dueDate: null,
          completed: false,
          subtasks: [],
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
          recurrence: null,
          recurrenceGroupId: null,
        },
      ];

      const mockUpsert = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await expect(saveTasks(tasks)).rejects.toThrow();
    });

    it('should handle tasks without user authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Test Task',
          dueDate: null,
          completed: false,
          subtasks: [],
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
          recurrence: null,
          recurrenceGroupId: null,
        },
      ];

      await saveTasks(tasks);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should convert task dates to date-only format', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Test Task',
          dueDate: '2024-01-15T10:30:00.000Z',
          completed: false,
          subtasks: [],
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
          recurrence: null,
          recurrenceGroupId: null,
        },
      ];

      const mockUpsert = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert,
      });

      await saveTasks(tasks);

      const upsertCall = mockUpsert.mock.calls[0];
      expect(upsertCall[0][0].due_date).toBe('2024-01-15');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task from Supabase', async () => {
      const mockSecondEq = vi.fn().mockResolvedValue({
        error: null,
      });
      const mockFirstEq = vi.fn().mockReturnValue({
        eq: mockSecondEq,
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockFirstEq,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await deleteTask('task-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const mockSecondEq = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });
      const mockFirstEq = vi.fn().mockReturnValue({
        eq: mockSecondEq,
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockFirstEq,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await expect(deleteTask('task-1')).rejects.toThrow();
    });

    it('should handle tasks without user authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await deleteTask('task-1');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('deleteTasks', () => {
    it('should delete multiple tasks from Supabase', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({
        in: mockIn,
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await deleteTasks(['task-1', 'task-2']);

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockIn).toHaveBeenCalledWith('id', ['task-1', 'task-2']);
    });

    it('should skip deletion when taskIds array is empty', async () => {
      await deleteTasks([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const mockIn = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });
      const mockEq = vi.fn().mockReturnValue({
        in: mockIn,
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await expect(deleteTasks(['task-1'])).rejects.toThrow();
    });
  });
});

