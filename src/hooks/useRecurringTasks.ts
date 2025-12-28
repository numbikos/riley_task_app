import { Task, TaskUpdate } from '../types';
import { generateId } from '../utils/supabaseStorage';
import { normalizeTags } from '../utils/taskOperations';
import {
  createRecurringTaskInstances,
  findFirstInstance,
  findLastInstance,
  getTasksToRemoveForRegeneration,
  extendRecurringTaskInstances,
} from '../utils/recurringTaskHelpers';
import { formatDate } from '../utils/dateUtils';
import { logger } from '../utils/logger';

/**
 * Custom hook for managing recurring task logic
 */
export const useRecurringTasks = (
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  setAutoRenewNotification: (notification: { taskTitle: string; count: number } | null) => void
) => {
  
  /**
   * Adds a recurring task by creating all instances
   */
  const addRecurringTask = (taskData: Partial<Task>) => {
    if (!taskData.recurrence || !taskData.dueDate) {
      return;
    }

    const recurrenceGroupId = generateId();
    const newTasks = createRecurringTaskInstances(
      { ...taskData, recurrenceGroupId },
      taskData.dueDate,
      taskData.recurrence
    );

    logger.debug(`[Recurring Task] Creating ${newTasks.length} occurrences for "${taskData.title}" with ${taskData.recurrence} recurrence starting ${taskData.dueDate}`);
    logger.debug(`[Recurring Task] Created ${newTasks.length} tasks. First: ${newTasks[0]?.dueDate}, Last: ${newTasks[newTasks.length - 1]?.dueDate}`);
    
    setTasks([...tasks, ...newTasks]);
  };

  /**
   * Updates a recurring task, handling regeneration if needed
   */
  const updateRecurringTask = (
    id: string,
    updates: TaskUpdate
  ) => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;

    // Check if recurrence settings are being changed
    const recurrenceChanged = updates.recurrence !== undefined && updates.recurrence !== existingTask.recurrence;
    const multiplierChanged = updates.recurrenceMultiplier !== undefined && updates.recurrenceMultiplier !== existingTask.recurrenceMultiplier;
    const customFreqChanged = updates.customFrequency !== undefined && updates.customFrequency !== existingTask.customFrequency;
    const recurrenceSettingsChanged = recurrenceChanged || multiplierChanged || customFreqChanged;
    
    // Check if this is the first instance in the recurrence group
    const isFirstInstance = existingTask.recurrenceGroupId 
      ? findFirstInstance(tasks, existingTask.recurrenceGroupId)?.id === existingTask.id
      : true;
    
    const dueDateChanged = updates.dueDate !== undefined && updates.dueDate !== existingTask.dueDate;
    const isDragDrop = updates._dragDrop === true;
    
    // Only regenerate if recurrence settings changed OR if editing the first instance's due date
    // BUT: Skip regeneration if this is a drag-and-drop operation
    if (!isDragDrop && recurrenceSettingsChanged && (updates.recurrence || existingTask.recurrence) && (updates.dueDate || existingTask.dueDate)) {
      // Delete old recurring group if it exists
      let tasksToRemove: Task[] = [];
      if (existingTask.recurrenceGroupId) {
        tasksToRemove = getTasksToRemoveForRegeneration(tasks, existingTask.recurrenceGroupId);
      } else {
        tasksToRemove = [existingTask];
      }
      
      const taskIdsToRemove = new Set(tasksToRemove.map(t => t.id));
      const remainingTasks = tasks.filter(task => !taskIdsToRemove.has(task.id));
      
      // Create new recurring occurrences
      const recurrenceGroupId = generateId();
      const dueDate = updates.dueDate || existingTask.dueDate;
      const recurrence = updates.recurrence || existingTask.recurrence!;
      
      const newTasks = createRecurringTaskInstances(
        {
          ...existingTask,
          ...updates,
          recurrenceGroupId,
          createdAt: existingTask.createdAt, // Preserve original creation date
        },
        dueDate!,
        recurrence,
        50
      );
      
      setTasks([...remainingTasks, ...newTasks]);
    } else if (!isDragDrop && dueDateChanged && existingTask.recurrence && existingTask.recurrenceGroupId && updates.dueDate && isFirstInstance) {
      // Only regenerate if editing the FIRST instance's due date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tasksToRemove = tasks.filter(task => {
        if (task.recurrenceGroupId !== existingTask.recurrenceGroupId) return false;
        const taskDate = new Date(task.dueDate!);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= today || (!task.completed && taskDate < today);
      });
      const taskIdsToRemove = new Set(tasksToRemove.map(t => t.id));
      const remainingTasks = tasks.filter(task => !taskIdsToRemove.has(task.id));
      
      const newTasks = createRecurringTaskInstances(
        {
          ...existingTask,
          ...updates,
          recurrenceGroupId: existingTask.recurrenceGroupId, // Keep same group ID
          createdAt: existingTask.createdAt, // Preserve original creation date
        },
        updates.dueDate,
        existingTask.recurrence,
        50
      );
      
      setTasks([...remainingTasks, ...newTasks]);
    } else {
      // Regular update - check if this is a recurring task that should propagate updates
      if (existingTask.recurrenceGroupId && !isDragDrop) {
        // For recurring tasks, propagate title, tags, and optionally subtasks to future instances
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;
        
        // Check if subtasks changed and should be propagated
        const subtasksChanged = updates.subtasks !== undefined && 
          JSON.stringify(updates.subtasks) !== JSON.stringify(existingTask.subtasks);
        const skipSubtaskPropagation = updates._skipSubtaskPropagation === true;
        
        // Extract fields that should propagate
        const propagatingUpdates: Partial<Task> = {};
        if (updates.title !== undefined) {
          propagatingUpdates.title = updates.title;
        }
        if (normalizedTags) {
          propagatingUpdates.tags = normalizedTags;
        }
        // Only propagate subtasks if they changed AND user confirmed
        if (subtasksChanged && updates.subtasks && !skipSubtaskPropagation) {
          propagatingUpdates.subtasks = updates.subtasks.map(st => ({ ...st, completed: false }));
        }
        
        setTasks(tasks.map(task => {
          if (task.id === id) {
            // Update the specific task being edited
            const { _dragDrop, _skipSubtaskPropagation, ...cleanUpdates } = updates;
            const updatedTask = { ...task, ...cleanUpdates, lastModified: new Date().toISOString() };
            if (normalizedTags) {
              updatedTask.tags = normalizedTags;
            }
            return updatedTask;
          } else if (task.recurrenceGroupId === existingTask.recurrenceGroupId) {
            // For other instances in the group, propagate title, tags, and subtasks (if user confirmed)
            const taskDate = new Date(task.dueDate!);
            taskDate.setHours(0, 0, 0, 0);
            const isFuture = taskDate >= today || (!task.completed && taskDate < today);
            
            if (isFuture && Object.keys(propagatingUpdates).length > 0) {
              const updatedTask = { ...task, ...propagatingUpdates, lastModified: new Date().toISOString() };
              return updatedTask;
            }
          }
          return task;
        }));
      } else {
        // Regular update - just update the single task
        const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;
        setTasks(tasks.map(task => {
          if (task.id === id) {
            const { _dragDrop, _skipSubtaskPropagation, ...cleanUpdates } = updates;
            const updatedTask = { ...task, ...cleanUpdates, lastModified: new Date().toISOString() };
            if (normalizedTags) {
              updatedTask.tags = normalizedTags;
            }
            return updatedTask;
          }
          return task;
        }));
      }
    }
  };

  /**
   * Extends a recurring task by creating the next batch of instances
   */
  const extendRecurringTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.recurrence || !task.dueDate || !task.recurrenceGroupId) return;

    const newTasks = extendRecurringTaskInstances(task, tasks);
    
    if (newTasks.length === 0) return;

    // Update the previous last instance to not be last anymore
    const lastInstance = findLastInstance(tasks, task.recurrenceGroupId);
    const updatedTasks = lastInstance
      ? tasks.map(t => t.id === lastInstance.id ? { ...t, isLastInstance: false } : t)
      : tasks;
    
    // Add new tasks
    setTasks([...updatedTasks, ...newTasks]);
    
    // Show notification
    setAutoRenewNotification({ taskTitle: task.title, count: 50 });
    setTimeout(() => {
      setAutoRenewNotification(null);
    }, 5000);
  };

  /**
   * Handles auto-renewal when the last instance is completed
   */
  const handleAutoRenewal = (task: Task) => {
    if (!task.isLastInstance || !task.autoRenew || !task.recurrence || !task.dueDate || !task.recurrenceGroupId) {
      return;
    }

    // Calculate next start date (day after current due date)
    const currentDate = new Date(task.dueDate);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextStartDate = formatDate(currentDate);
    
    // Generate next 50 instances
    const newRecurrenceGroupId = generateId();
    const newTasks = createRecurringTaskInstances(
      {
        ...task,
        recurrenceGroupId: newRecurrenceGroupId,
        createdAt: task.createdAt, // Preserve original creation date
      },
      nextStartDate,
      task.recurrence,
      50
    );
    
    // Add new tasks
    setTasks(currentTasks => [...currentTasks, ...newTasks]);
    
    // Show notification
    setAutoRenewNotification({ taskTitle: task.title, count: 50 });
    setTimeout(() => {
      setAutoRenewNotification(null);
    }, 5000);
  };

  return {
    addRecurringTask,
    updateRecurringTask,
    extendRecurringTask,
    handleAutoRenewal,
  };
};

