import { Task, ViewType } from '../types';

const STORAGE_KEY = 'riley-tasks';
const TAGS_STORAGE_KEY = 'riley-tags';
const TAG_COLORS_STORAGE_KEY = 'riley-tag-colors';
const VIEW_STATE_KEY = 'riley-view-state';

export const loadTasks = (): Task[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const tasks = JSON.parse(stored);
    // Migrate old tasks that don't have recurrence, recurrenceGroupId, recurrenceMultiplier, customFrequency, isLastInstance, or autoRenew fields
    return tasks.map((task: Task) => ({
      ...task,
      recurrence: task.recurrence || null,
      recurrenceGroupId: task.recurrenceGroupId || null,
      recurrenceMultiplier: task.recurrenceMultiplier,
      customFrequency: task.customFrequency,
      isLastInstance: task.isLastInstance || false,
      autoRenew: task.autoRenew || false,
    }));
  } catch {
    return [];
  }
};

export const saveTasks = (tasks: Task[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    
    // Extract all unique tags from tasks and save them
    const allTags = new Set<string>();
    tasks.forEach(task => {
      task.tags.forEach(tag => allTags.add(tag.toLowerCase()));
    });
    saveTags(Array.from(allTags));
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
};

export const loadTags = (): string[] => {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveTags = (tags: string[]): void => {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save tags:', error);
  }
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const loadTagColors = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(TAG_COLORS_STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

export const saveTagColors = (colors: Record<string, string>): void => {
  try {
    localStorage.setItem(TAG_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch (error) {
    console.error('Failed to save tag colors:', error);
  }
};

export interface ViewState {
  currentView: ViewType;
  selectedDayDate: string | null;
  weekViewDate: string | null;
  todayViewDate: string | null;
  tomorrowViewDate: string | null;
}

export const loadViewState = (): ViewState | null => {
  try {
    const stored = localStorage.getItem(VIEW_STATE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveViewState = (state: ViewState): void => {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save view state:', error);
  }
};
