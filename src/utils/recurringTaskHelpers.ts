import { Task, Subtask, RecurrenceType } from '../types';
import { generateRecurringDates, formatDate } from './dateUtils';
import { generateId } from './supabaseStorage';

const RECURRING_INSTANCE_COUNT = 10;

/**
 * Normalizes tags to lowercase
 */
const normalizeTags = (tags: string[]): string[] => {
  return tags.map(tag => tag.toLowerCase());
};

/**
 * Checks whether the subtask list itself changed (added/removed/renamed/reordered),
 * ignoring completion state. Checking off a subtask is not a structural change.
 */
export const haveSubtasksChanged = (a: Subtask[], b: Subtask[]): boolean => {
  const structure = (subtasks: Subtask[]) => JSON.stringify(subtasks.map(st => [st.id, st.text]));
  return structure(a) !== structure(b);
};

/**
 * Creates recurring task instances based on recurrence settings
 * @param taskData Partial task data to use as template
 * @param startDate Starting date for the recurrence
 * @param recurrence Recurrence type
 * @param count Number of instances to create (default: 10)
 * @returns Array of Task instances
 */
export const createRecurringTaskInstances = (
  taskData: Partial<Task>,
  startDate: string,
  recurrence: RecurrenceType,
  count: number = RECURRING_INSTANCE_COUNT
): Task[] => {
  if (!recurrence || !startDate) {
    return [];
  }

  const recurrenceGroupId = taskData.recurrenceGroupId || generateId();
  const multiplier = taskData.recurrence === 'custom' ? (taskData.recurrenceMultiplier ?? 1) : 1;
  const customFreq = taskData.recurrence === 'custom' ? taskData.customFrequency : undefined;
  const recurringDates = generateRecurringDates(
    startDate,
    recurrence,
    count,
    multiplier,
    customFreq
  );

  const normalizedTags = normalizeTags(taskData.tags || []);
  
  return recurringDates.map((date, index) => {
    const isLastInstance = index === recurringDates.length - 1;
    return {
      id: generateId(),
      title: taskData.title || '',
      dueDate: date,
      completed: false,
      subtasks: index === 0 
        ? (taskData.subtasks || []) 
        : (taskData.subtasks || []).map(st => ({ ...st, completed: false })),
      tags: normalizedTags,
      createdAt: taskData.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      recurrence: recurrence,
      recurrenceGroupId,
      recurrenceMultiplier: taskData.recurrence === 'custom' ? multiplier : undefined,
      customFrequency: taskData.recurrence === 'custom' ? customFreq : undefined,
      isLastInstance,
      autoRenew: true, // Always enable auto-renewal for recurring tasks
    };
  });
};

/**
 * Finds the first instance in a recurrence group (earliest due date)
 */
export const findFirstInstance = (tasks: Task[], recurrenceGroupId: string): Task | null => {
  const groupTasks = tasks.filter(t => t.recurrenceGroupId === recurrenceGroupId);
  if (groupTasks.length === 0) return null;
  
  return groupTasks.reduce((earliest, current) => {
    if (!earliest.dueDate) return current;
    if (!current.dueDate) return earliest;
    return new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest;
  });
};

/**
 * Finds the last instance in a recurrence group (latest due date)
 */
export const findLastInstance = (tasks: Task[], recurrenceGroupId: string): Task | null => {
  const groupTasks = tasks.filter(t => t.recurrenceGroupId === recurrenceGroupId);
  if (groupTasks.length === 0) return null;
  
  return groupTasks.reduce((latest, current) => {
    if (!latest.dueDate) return current;
    if (!current.dueDate) return latest;
    return new Date(current.dueDate) > new Date(latest.dueDate) ? current : latest;
  });
};

/**
 * Gets tasks to remove when regenerating a recurrence group
 * Removes future instances and incomplete overdue instances, but keeps completed past instances
 */
export const getTasksToRemoveForRegeneration = (
  tasks: Task[],
  recurrenceGroupId: string
): Task[] => {
  // Local date (not UTC) so "today" matches the user's calendar day
  const todayStr = formatDate(new Date());
  
  return tasks.filter(task => {
    if (task.recurrenceGroupId !== recurrenceGroupId) return false;
    if (!task.dueDate) return false;
    
    // Compare date strings directly to avoid timezone issues
    const taskDateStr = task.dueDate.split('T')[0];
    
    // Delete all future instances (including today, regardless of completion)
    if (taskDateStr >= todayStr) return true;
    
    // Delete incomplete overdue instances
    if (!task.completed && taskDateStr < todayStr) return true;
    
    // Keep completed past instances
    return false;
  });
};

/**
 * Gets the next occurrence date after a given instance date, following the task's recurrence
 * (e.g. weekly on a Monday -> the following Monday). Returns null if the task doesn't recur.
 */
export const getNextRecurrenceDate = (task: Task, afterDate: string): string | null => {
  if (!task.recurrence || !afterDate) return null;
  const multiplier = task.recurrence === 'custom' ? (task.recurrenceMultiplier ?? 1) : 1;
  const customFreq = task.recurrence === 'custom' ? task.customFrequency : undefined;
  const [, next] = generateRecurringDates(afterDate.split('T')[0], task.recurrence, 2, multiplier, customFreq);
  return next ?? null;
};

/**
 * Extends a recurring task by creating the next batch of instances
 */
export const extendRecurringTaskInstances = (
  task: Task,
  tasks: Task[]
): Task[] => {
  if (!task.recurrence || !task.dueDate || !task.recurrenceGroupId) {
    return [];
  }

  // Find the last instance in the recurrence group
  const lastInstance = findLastInstance(tasks, task.recurrenceGroupId);
  if (!lastInstance || !lastInstance.dueDate) {
    return [];
  }

  // Next batch starts at the next occurrence after the last instance
  const nextStartDate = getNextRecurrenceDate(task, lastInstance.dueDate);
  if (!nextStartDate) {
    return [];
  }

  // Generate next batch of instances
  return createRecurringTaskInstances(
    {
      ...task,
      recurrenceGroupId: task.recurrenceGroupId, // Keep same group ID
      subtasks: task.subtasks.map(st => ({ ...st, completed: false })),
    },
    nextStartDate,
    task.recurrence,
    RECURRING_INSTANCE_COUNT
  );
};
