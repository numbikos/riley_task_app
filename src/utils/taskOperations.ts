import { Task } from '../types';

/**
 * Normalizes tags to lowercase
 */
export const normalizeTags = (tags: string[]): string[] => {
  return tags.map(tag => tag.toLowerCase());
};

/**
 * Filters tasks by search query
 */
export const filterTasksBySearch = (taskList: Task[], query: string): Task[] => {
  if (!query.trim()) return taskList;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return taskList.filter(task => {
    // Search in title
    if (task.title.toLowerCase().includes(lowerQuery)) return true;
    
    // Search in tags
    if (task.tags.some(tag => {
      const normalizedTag = tag.toLowerCase();
      if (normalizedTag === lowerQuery) return true;
      if (normalizedTag.includes(lowerQuery)) return true;
      return false;
    })) return true;
    
    // Search in subtasks
    if (task.subtasks.some(subtask => subtask.text.toLowerCase().includes(lowerQuery))) return true;
    
    return false;
  });
};

/**
 * Gets tasks for today (including overdue tasks)
 */
export const getTodayTasks = (
  tasks: Task[],
  date: Date,
  isDateToday: (date: string) => boolean,
  isDateOverdue: (date: string) => boolean,
  formatDate: (date: Date) => string
): Task[] => {
  const dateStr = formatDate(date);
  const isToday = isDateToday(formatDate(new Date()));
  
  return tasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    
    if (isToday) {
      // For actual today, include tasks due today OR overdue tasks (carryover)
      return isDateToday(task.dueDate) || isDateOverdue(task.dueDate);
    } else {
      // For other dates, only include tasks due on that exact date
      const taskDateStr = task.dueDate.split('T')[0];
      return taskDateStr === dateStr;
    }
  }).sort((a, b) => {
    // Sort by overdue status only if viewing today
    if (isToday) {
      const aIsOverdue = isDateOverdue(a.dueDate);
      const bIsOverdue = isDateOverdue(b.dueDate);
      
      if (aIsOverdue && !bIsOverdue) return 1; // a is overdue, b is today - put a after b
      if (!aIsOverdue && bIsOverdue) return -1; // a is today, b is overdue - put a before b
    }
    return 0; // Both same status, keep original order
  });
};

/**
 * Gets tasks for tomorrow
 */
export const getTomorrowTasks = (
  tasks: Task[],
  date: Date,
  isDateTomorrow: (date: string) => boolean,
  formatDate: (date: Date) => string
): Task[] => {
  const dateStr = formatDate(date);
  const isTomorrow = isDateTomorrow(formatDate(new Date()));
  
  return tasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    
    if (isTomorrow) {
      // For actual tomorrow, use the tomorrow check
      return isDateTomorrow(task.dueDate);
    } else {
      // For other dates, only include tasks due on that exact date
      const taskDateStr = task.dueDate.split('T')[0];
      return taskDateStr === dateStr;
    }
  });
};

/**
 * Gets tasks for a specific date (without overdue tasks)
 */
export const getDayTasks = (
  tasks: Task[],
  date: Date,
  formatDate: (date: Date) => string
): Task[] => {
  const dateStr = formatDate(date);
  return tasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    // Only include tasks due on this exact date, not overdue
    const taskDateStr = task.dueDate.split('T')[0];
    return taskDateStr === dateStr;
  });
};

/**
 * Gets all incomplete tasks with due dates (for week view)
 */
export const getWeekTasks = (tasks: Task[]): Task[] => {
  return tasks.filter(task => {
    if (task.completed) return false;
    return task.dueDate !== null;
  });
};

/**
 * Gets all completed tasks
 */
export const getCompletedTasks = (tasks: Task[]): Task[] => {
  return tasks.filter(task => task.completed);
};

