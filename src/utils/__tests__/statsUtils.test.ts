import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { calculateTaskStats, getCompletionHistory } from '../statsUtils';
import { Task } from '../../types';

// Helper to create a task with defaults
const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Task',
  dueDate: null,
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  recurrence: null,
  recurrenceGroupId: null,
  ...overrides,
});

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('statsUtils', () => {
  describe('calculateTaskStats', () => {
    it('returns zeros for empty task list', () => {
      const stats = calculateTaskStats([]);

      expect(stats.completedToday).toBe(0);
      expect(stats.completedThisWeek).toBe(0);
      expect(stats.completedThisMonth).toBe(0);
      expect(stats.overdueCount).toBe(0);
      expect(stats.totalActive).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.tagDistribution).toEqual([]);
    });

    it('counts active and completed tasks correctly', () => {
      const tasks: Task[] = [
        createTask({ completed: false }),
        createTask({ completed: false }),
        createTask({ completed: true }),
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.totalActive).toBe(2);
      expect(stats.totalCompleted).toBe(1);
    });

    it('calculates completion rate correctly', () => {
      const tasks: Task[] = [
        createTask({ completed: true }),
        createTask({ completed: true }),
        createTask({ completed: false }),
        createTask({ completed: false }),
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.completionRate).toBe(50);
    });

    it('counts tasks completed today', () => {
      // Use noon today to avoid any timezone edge cases
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const todayStr = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString();

      const tasks: Task[] = [
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: true, lastModified: yesterdayStr }),
      ];

      const stats = calculateTaskStats(tasks);

      // 3 individual tasks (no recurrence), 2 completed today
      expect(stats.completedToday).toBe(2);
    });

    it('groups recurring tasks by recurrenceGroupId', () => {
      const groupId = 'recurring-group-1';
      const tasks: Task[] = [
        // Recurring task group with 3 instances, 2 completed
        createTask({ completed: true, recurrenceGroupId: groupId }),
        createTask({ completed: true, recurrenceGroupId: groupId }),
        createTask({ completed: false, recurrenceGroupId: groupId }),
        // Individual tasks
        createTask({ completed: true }),
        createTask({ completed: false }),
      ];

      const stats = calculateTaskStats(tasks);

      // 1 recurring group + 2 individual tasks = 3 total task groups
      // 1 individual completed, recurring group not fully completed = 1 completed
      expect(stats.totalCompleted).toBe(1);
      // 1 active individual + 1 active recurring group = 2 active
      expect(stats.totalActive).toBe(2);
    });

    it('counts recurring task as completed only when all instances are completed', () => {
      const groupId = 'recurring-group-1';
      const tasks: Task[] = [
        createTask({ completed: true, recurrenceGroupId: groupId }),
        createTask({ completed: true, recurrenceGroupId: groupId }),
        createTask({ completed: true, recurrenceGroupId: groupId }),
      ];

      const stats = calculateTaskStats(tasks);

      // All instances completed = 1 completed task
      expect(stats.totalCompleted).toBe(1);
      expect(stats.totalActive).toBe(0);
      expect(stats.completionRate).toBe(100);
    });

    it('counts tasks completed this week', () => {
      const now = new Date();
      const todayStr = now.toISOString();

      // 2 weeks ago
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const twoWeeksAgoStr = twoWeeksAgo.toISOString();

      const tasks: Task[] = [
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: true, lastModified: twoWeeksAgoStr }),
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.completedThisWeek).toBe(2);
    });

    it('counts overdue tasks correctly', () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks: Task[] = [
        createTask({ completed: false, dueDate: formatDate(yesterday) }), // overdue
        createTask({ completed: false, dueDate: formatDate(yesterday) }), // overdue
        createTask({ completed: false, dueDate: formatDate(tomorrow) }), // not overdue
        createTask({ completed: true, dueDate: formatDate(yesterday) }), // completed, not counted
        createTask({ completed: false, dueDate: null }), // no due date
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.overdueCount).toBe(2);
    });

    it('calculates tag distribution correctly', () => {
      const tasks: Task[] = [
        createTask({ tags: ['work', 'urgent'] }),
        createTask({ tags: ['work'] }),
        createTask({ tags: ['personal'] }),
        createTask({ tags: ['work', 'personal'] }),
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.tagDistribution).toHaveLength(3);

      const workTag = stats.tagDistribution.find(t => t.tag === 'work');
      const personalTag = stats.tagDistribution.find(t => t.tag === 'personal');
      const urgentTag = stats.tagDistribution.find(t => t.tag === 'urgent');

      expect(workTag?.count).toBe(3);
      expect(personalTag?.count).toBe(2);
      expect(urgentTag?.count).toBe(1);
    });

    it('sorts tag distribution by count descending', () => {
      const tasks: Task[] = [
        createTask({ tags: ['a'] }),
        createTask({ tags: ['b', 'b'] }), // b appears in task with 2 tags but still counts as 1 per task
        createTask({ tags: ['c'] }),
        createTask({ tags: ['c'] }),
        createTask({ tags: ['c'] }),
      ];

      const stats = calculateTaskStats(tasks);

      expect(stats.tagDistribution[0].tag).toBe('c');
      expect(stats.tagDistribution[0].count).toBe(3);
    });

    it('calculates tag percentages correctly', () => {
      const tasks: Task[] = [
        createTask({ tags: ['work'] }),
        createTask({ tags: ['work'] }),
        createTask({ tags: ['personal'] }),
        createTask({ tags: ['personal'] }),
      ];

      const stats = calculateTaskStats(tasks);

      const workTag = stats.tagDistribution.find(t => t.tag === 'work');
      const personalTag = stats.tagDistribution.find(t => t.tag === 'personal');

      expect(workTag?.percentage).toBe(50);
      expect(personalTag?.percentage).toBe(50);
    });
  });

  describe('getCompletionHistory', () => {
    it('returns correct number of days', () => {
      const history = getCompletionHistory([], 7);

      expect(history).toHaveLength(7);
    });

    it('returns zeros when no tasks completed', () => {
      const history = getCompletionHistory([], 7);

      history.forEach(day => {
        expect(day.count).toBe(0);
      });
    });

    it('counts completed tasks by date', () => {
      const now = new Date();
      const todayStr = now.toISOString();

      const tasks: Task[] = [
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: true, lastModified: todayStr }),
        createTask({ completed: false, lastModified: todayStr }), // not completed
      ];

      const history = getCompletionHistory(tasks, 7);
      const todayEntry = history[history.length - 1];

      expect(todayEntry.count).toBe(2);
    });

    it('includes dates in YYYY-MM-DD format', () => {
      const history = getCompletionHistory([], 3);

      history.forEach(day => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('orders history from oldest to newest', () => {
      const history = getCompletionHistory([], 3);

      const dates = history.map(h => new Date(h.date).getTime());

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThan(dates[i - 1]);
      }
    });

    it('handles custom day range', () => {
      const history = getCompletionHistory([], 14);

      expect(history).toHaveLength(14);
    });
  });
});
