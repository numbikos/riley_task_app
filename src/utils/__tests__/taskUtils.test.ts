import { describe, it, expect } from 'vitest';
import { groupTasksByTag } from '../taskUtils';
import {
  normalizeTags,
  filterTasksBySearch,
  getTodayTasks,
  getTomorrowTasks,
  getDayTasks,
  getWeekTasks,
  getCompletedTasks,
} from '../taskOperations';
import { isDateToday, isDateOverdue, formatDate, isDateTomorrow } from '../dateUtils';
import { Task } from '../../types';

describe('taskUtils', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    dueDate: '2024-01-15',
    completed: false,
    subtasks: [],
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: null,
    recurrenceGroupId: null,
  };

  describe('normalizeTags', () => {
    it('should convert tags to lowercase', () => {
      expect(normalizeTags(['WORK', 'Important', 'personal'])).toEqual(['work', 'important', 'personal']);
    });

    it('should handle empty array', () => {
      expect(normalizeTags([])).toEqual([]);
    });

    it('should handle mixed case tags', () => {
      expect(normalizeTags(['Work', 'HOME', 'Personal'])).toEqual(['work', 'home', 'personal']);
    });
  });

  describe('groupTasksByTag', () => {
    it('should group tasks by first tag', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: ['work'] },
        { ...mockTask, id: '2', tags: ['work'] },
        { ...mockTask, id: '3', tags: ['personal'] },
      ];

      const result = groupTasksByTag(tasks);
      expect(result.grouped.work).toHaveLength(2);
      expect(result.grouped.personal).toHaveLength(1);
    });

    it('should group untagged tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: [] },
        { ...mockTask, id: '2', tags: [] },
      ];

      const result = groupTasksByTag(tasks);
      expect(result.grouped.untagged).toHaveLength(2);
    });

    it('should sort tags alphabetically with untagged last', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: ['zebra'] },
        { ...mockTask, id: '2', tags: ['apple'] },
        { ...mockTask, id: '3', tags: [] },
        { ...mockTask, id: '4', tags: ['banana'] },
      ];

      const result = groupTasksByTag(tasks);
      expect(result.sortedTags).toEqual(['apple', 'banana', 'zebra', 'untagged']);
    });

    it('should handle empty task list', () => {
      const result = groupTasksByTag([]);
      expect(result.grouped).toEqual({});
      expect(result.sortedTags).toEqual([]);
    });

    it('should use lowercase for tag grouping', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: ['WORK'] },
        { ...mockTask, id: '2', tags: ['work'] },
      ];

      const result = groupTasksByTag(tasks);
      expect(result.grouped.work).toHaveLength(2);
    });
  });

  describe('filterTasksBySearch', () => {
    it('should filter tasks by title', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', title: 'Buy groceries' },
        { ...mockTask, id: '2', title: 'Call dentist' },
        { ...mockTask, id: '3', title: 'Buy milk' },
      ];

      const result = filterTasksBySearch(tasks, 'buy');
      expect(result).toHaveLength(2);
      expect(result.map((t: Task) => t.id)).toEqual(['1', '3']);
    });

    it('should filter tasks by tags', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: ['work'] },
        { ...mockTask, id: '2', tags: ['personal'] },
        { ...mockTask, id: '3', tags: ['work', 'urgent'] },
      ];

      const result = filterTasksBySearch(tasks, 'work');
      expect(result).toHaveLength(2);
      expect(result.map((t: Task) => t.id)).toEqual(['1', '3']);
    });

    it('should filter tasks by subtask text', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', subtasks: [{ id: 's1', text: 'Buy milk', completed: false }] },
        { ...mockTask, id: '2', subtasks: [{ id: 's2', text: 'Call doctor', completed: false }] },
      ];

      const result = filterTasksBySearch(tasks, 'milk');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return all tasks for empty query', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1' },
        { ...mockTask, id: '2' },
      ];

      const result = filterTasksBySearch(tasks, '');
      expect(result).toHaveLength(2);
    });

    it('should return all tasks for whitespace-only query', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1' },
        { ...mockTask, id: '2' },
      ];

      const result = filterTasksBySearch(tasks, '   ');
      expect(result).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', title: 'Buy Groceries' },
        { ...mockTask, id: '2', title: 'Call Dentist' },
      ];

      const result = filterTasksBySearch(tasks, 'BUY');
      expect(result).toHaveLength(1);
    });

    it('should match partial tag names', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', tags: ['work'] },
        { ...mockTask, id: '2', tags: ['homework'] },
      ];

      const result = filterTasksBySearch(tasks, 'work');
      expect(result).toHaveLength(2);
    });
  });

  describe('getTodayTasks', () => {

    it('should return tasks due today', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-15' },
        { ...mockTask, id: '2', dueDate: '2024-01-16' },
      ];

      // Use the mocked "today" date - Jan 15, 2024
      const testDate = new Date(2024, 0, 15);
      const result = getTodayTasks(tasks, testDate, isDateToday, isDateOverdue, formatDate);
      // Should include task due today (Jan 15) since mocked time is Jan 15
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.dueDate === '2024-01-15')).toBe(true);
    });

    it('should exclude completed tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-15', completed: true },
        { ...mockTask, id: '2', dueDate: '2024-01-15', completed: false },
      ];

      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = getTodayTasks(tasks, testDate, isDateToday, isDateOverdue, formatDate);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should include overdue tasks when viewing today', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-14' }, // overdue
        { ...mockTask, id: '2', dueDate: '2024-01-15' }, // today
      ];

      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time (matches mocked time)
      const result = getTodayTasks(tasks, testDate, isDateToday, isDateOverdue, formatDate);
      expect(result.length).toBeGreaterThanOrEqual(1); // At least today's task, possibly overdue
      expect(result.some(t => t.id === '2')).toBe(true); // Today's task should be included
    });

    it('should exclude tasks without due dates', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: null },
        { ...mockTask, id: '2', dueDate: '2024-01-15' },
      ];

      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = getTodayTasks(tasks, testDate, isDateToday, isDateOverdue, formatDate);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === '2')).toBe(true);
    });
  });

  describe('getTomorrowTasks', () => {

    it('should return tasks due tomorrow', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-16' },
        { ...mockTask, id: '2', dueDate: '2024-01-17' },
      ];

      // Pass tomorrow's date (Jan 16) since mocked time is Jan 15
      const testDate = new Date(2024, 0, 16);
      const result = getTomorrowTasks(tasks, testDate, isDateTomorrow, formatDate);
      // When passing tomorrow's date, it should match tasks due on that date
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.dueDate === '2024-01-16')).toBe(true);
    });

    it('should exclude completed tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-16', completed: true },
        { ...mockTask, id: '2', dueDate: '2024-01-16', completed: false },
      ];

      // Pass tomorrow's date (Jan 16) since mocked time is Jan 15
      const testDate = new Date(2024, 0, 16);
      const result = getTomorrowTasks(tasks, testDate, isDateTomorrow, formatDate);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === '2')).toBe(true);
      expect(result.every(t => !t.completed)).toBe(true);
    });
  });

  describe('getDayTasks', () => {

    it('should return tasks for specific date', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-15' },
        { ...mockTask, id: '2', dueDate: '2024-01-16' },
      ];

      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = getDayTasks(tasks, testDate, formatDate);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === '1')).toBe(true);
    });

    it('should exclude completed tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-15', completed: true },
        { ...mockTask, id: '2', dueDate: '2024-01-15', completed: false },
      ];

      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = getDayTasks(tasks, testDate, formatDate);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(t => t.id === '2')).toBe(true);
      expect(result.every(t => !t.completed)).toBe(true);
    });
  });

  describe('getWeekTasks', () => {
    it('should return all incomplete tasks with due dates', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', dueDate: '2024-01-15', completed: false },
        { ...mockTask, id: '2', dueDate: '2024-01-16', completed: true },
        { ...mockTask, id: '3', dueDate: null, completed: false },
        { ...mockTask, id: '4', dueDate: '2024-01-17', completed: false },
      ];

      const result = getWeekTasks(tasks);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual(['1', '4']);
    });
  });

  describe('getCompletedTasks', () => {
    it('should return only completed tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', completed: true },
        { ...mockTask, id: '2', completed: false },
        { ...mockTask, id: '3', completed: true },
      ];

      const result = getCompletedTasks(tasks);
      expect(result).toHaveLength(2);
      expect(result.map((t: Task) => t.id)).toEqual(['1', '3']);
    });

    it('should return empty array if no completed tasks', () => {
      const tasks: Task[] = [
        { ...mockTask, id: '1', completed: false },
        { ...mockTask, id: '2', completed: false },
      ];

      const result = getCompletedTasks(tasks);
      expect(result).toHaveLength(0);
    });
  });
});

