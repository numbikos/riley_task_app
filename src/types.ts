export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom' | null;

export interface Task {
  id: string;
  title: string;
  dueDate: string | null; // ISO date string or null for no due date
  completed: boolean;
  subtasks: Subtask[];
  tags: string[];
  createdAt: string; // ISO datetime string
  lastModified: string; // ISO datetime string
  recurrence: RecurrenceType; // Recurrence pattern for the task
  recurrenceGroupId: string | null; // ID to group recurring tasks together
  recurrenceMultiplier?: number; // For custom recurrence: multiplier (1-50) with frequency
  customFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'; // For custom recurrence: the base frequency
  isLastInstance?: boolean; // True if this is the last instance in a recurrence series
  autoRenew?: boolean; // If true, automatically create next batch of instances when last instance is completed
}

export type ViewType = 'today' | 'tomorrow' | 'week' | 'all' | 'completed' | 'day' | 'stats';

/**
 * Internal flags used for task updates (not persisted to database)
 */
export interface TaskUpdateFlags {
  /** Flag to indicate this is a drag-and-drop operation (prevents recurrence regeneration) */
  _dragDrop?: boolean;
  /** Flag to skip subtask propagation to future recurring instances */
  _skipSubtaskPropagation?: boolean;
}

/**
 * Task update type that includes both regular task fields and internal flags
 */
export type TaskUpdate = Partial<Task> & TaskUpdateFlags;

export const DEFAULT_TAG_COLORS: Record<string, string> = {
  'zero': '#6366F1',
  'ollie': '#10B981',
  'personal': '#FB7185',
  'work': '#F59E0B',
  'home': '#8B5CF6',
  'default': '#64748B'
};

// Utility function to get tag color (checks stored colors first, then defaults)
export const getTagColor = (tag: string, storedColors?: Record<string, string>): string => {
  const normalizedTag = tag.toLowerCase();
  if (storedColors && storedColors[normalizedTag]) {
    return storedColors[normalizedTag];
  }
  return DEFAULT_TAG_COLORS[normalizedTag] || DEFAULT_TAG_COLORS.default;
};
