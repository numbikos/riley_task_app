import { Task } from '../types';
import { startOfDay, subDays, startOfWeek, startOfMonth, isAfter, isBefore, isEqual } from 'date-fns';
import { formatDate } from './dateUtils';

/**
 * Statistics about task completion
 */
export interface TaskStats {
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  overdueCount: number;
  totalActive: number;
  totalCompleted: number;
  completionRate: number;
  tagDistribution: TagDistribution[];
}

export interface TagDistribution {
  tag: string;
  count: number;
  percentage: number;
}

/**
 * Parses a YYYY-MM-DD date string as local midnight
 */
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Checks if a date string (YYYY-MM-DD) is within a date range (inclusive)
 */
const isDateInRange = (dateStr: string | null, start: Date, end: Date): boolean => {
  if (!dateStr) return false;
  // Parse as local date to avoid timezone issues
  const date = parseLocalDate(dateStr);
  const normalizedDate = startOfDay(date);
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  return (isAfter(normalizedDate, normalizedStart) || isEqual(normalizedDate, normalizedStart)) &&
         (isBefore(normalizedDate, normalizedEnd) || isEqual(normalizedDate, normalizedEnd));
};

/**
 * Checks if a date string (YYYY-MM-DD) is before today
 */
const isBeforeToday = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  // Parse as local date to avoid timezone issues
  const date = startOfDay(parseLocalDate(dateStr));
  const today = startOfDay(new Date());
  return isBefore(date, today);
};

/**
 * Groups tasks by recurrenceGroupId. Tasks without a recurrenceGroupId are treated individually.
 * Returns an array of task groups, where each group is an array of tasks.
 */
const groupTasksByRecurrence = (tasks: Task[]): Task[][] => {
  const groups: Map<string, Task[]> = new Map();
  const individualTasks: Task[] = [];

  tasks.forEach(task => {
    if (task.recurrenceGroupId) {
      const existing = groups.get(task.recurrenceGroupId) || [];
      existing.push(task);
      groups.set(task.recurrenceGroupId, existing);
    } else {
      individualTasks.push(task);
    }
  });

  // Convert map to array and add individual tasks as single-item arrays
  const result: Task[][] = Array.from(groups.values());
  individualTasks.forEach(task => result.push([task]));

  return result;
};

/**
 * Calculates comprehensive task statistics.
 * Recurring tasks with the same recurrenceGroupId are counted as a single task.
 */
export const calculateTaskStats = (tasks: Task[]): TaskStats => {
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const monthStart = startOfMonth(now);

  // Group tasks by recurrence (each group counts as 1 task)
  const taskGroups = groupTasksByRecurrence(tasks);

  // A group is "completed" if all its instances are completed
  const completedGroups = taskGroups.filter(group => group.every(t => t.completed));
  const activeGroups = taskGroups.filter(group => group.some(t => !t.completed));

  // Groups with at least one task completed today
  const completedToday = taskGroups.filter(group =>
    group.some(t => {
      if (!t.completed) return false;
      const lastModified = new Date(t.lastModified);
      return isDateInRange(formatDate(lastModified), today, today);
    })
  ).length;

  // Groups with at least one task completed this week
  const completedThisWeek = taskGroups.filter(group =>
    group.some(t => {
      if (!t.completed) return false;
      const lastModified = new Date(t.lastModified);
      return isDateInRange(formatDate(lastModified), weekStart, today);
    })
  ).length;

  // Groups with at least one task completed this month
  const completedThisMonth = taskGroups.filter(group =>
    group.some(t => {
      if (!t.completed) return false;
      const lastModified = new Date(t.lastModified);
      return isDateInRange(formatDate(lastModified), monthStart, today);
    })
  ).length;

  // Overdue groups (has at least one active task that's overdue)
  const overdueCount = activeGroups.filter(group =>
    group.some(t => !t.completed && isBeforeToday(t.dueDate))
  ).length;

  // Completion rate (fully completed groups / total groups)
  const totalGroups = taskGroups.length;
  const completionRate = totalGroups > 0 ? (completedGroups.length / totalGroups) * 100 : 0;

  // Tag distribution (count each group once per tag, using first task's tags as representative)
  const tagCounts: Record<string, number> = {};
  taskGroups.forEach(group => {
    // Use the first task's tags as representative for the group
    const representativeTask = group[0];
    representativeTask.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const totalTaggedGroups = Object.values(tagCounts).reduce((sum, count) => sum + count, 0);
  const tagDistribution: TagDistribution[] = Object.entries(tagCounts)
    .map(([tag, count]) => ({
      tag,
      count,
      percentage: totalTaggedGroups > 0 ? (count / totalTaggedGroups) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    completedToday,
    completedThisWeek,
    completedThisMonth,
    overdueCount,
    totalActive: activeGroups.length,
    totalCompleted: completedGroups.length,
    completionRate,
    tagDistribution,
  };
};

/**
 * Gets completion data for the last N days (for charts).
 * Recurring tasks with the same recurrenceGroupId are counted as a single task.
 */
export const getCompletionHistory = (tasks: Task[], days: number = 7): { date: string; count: number }[] => {
  const history: { date: string; count: number }[] = [];
  const now = new Date();
  const taskGroups = groupTasksByRecurrence(tasks);

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(now, i);
    const dateStr = formatDate(date);

    // Count groups that had at least one task completed on this date
    const count = taskGroups.filter(group =>
      group.some(t => {
        if (!t.completed) return false;
        const lastModified = formatDate(new Date(t.lastModified));
        return lastModified === dateStr;
      })
    ).length;

    history.push({
      date: dateStr,
      count,
    });
  }

  return history;
};
