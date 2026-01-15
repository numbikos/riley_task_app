import { useState, useEffect, useRef } from 'react';
import { Task, TaskUpdate } from '../types';
import { loadIncompleteTasks, loadCompletedTasks, loadTasksByIds, saveTasks, deleteTasks as deleteTasksFromDatabase, generateId } from '../utils/supabaseStorage';
import { supabase } from '../utils/supabase';
import { normalizeTags } from '../utils/taskOperations';
import { logger } from '../utils/logger';
import type { User } from '@supabase/supabase-js';

const RELOAD_DEBOUNCE_MS = 2000;
const AUTH_DELAY_MS = 300;
const LOAD_TIMEOUT_MS = 30000;
export const UNDO_TIMEOUT_MS = 3000;
const COMPLETED_TASKS_PAGE_SIZE = 25;
const countCompletedTasks = (taskList: Task[]): number => {
  return taskList.reduce((count, task) => count + (task.completed ? 1 : 0), 0);
};

interface DeletedTaskState {
  task: Task;
  tasks: Task[];
  timeoutId: number;
}

interface CompletedTaskState {
  task: Task;
  previousState: Task;
}

/**
 * Custom hook for managing tasks (CRUD operations)
 */
export const useTaskManagement = (user: User | null) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isLoadingFromDatabase, setIsLoadingFromDatabase] = useState(false);
  const [migrationNotification, setMigrationNotification] = useState<string | null>(null);
  const [deletedTask, setDeletedTask] = useState<DeletedTaskState | null>(null);
  const [completedTask, setCompletedTask] = useState<CompletedTaskState | null>(null);

  // Progressive loading state for completed tasks
  const [completedTasksLoaded, setCompletedTasksLoaded] = useState(0);
  const [completedTasksTotal, setCompletedTasksTotal] = useState<number | null>(null);
  const [hasMoreCompletedTasks, setHasMoreCompletedTasks] = useState(true);
  const [isLoadingCompletedTasks, setIsLoadingCompletedTasks] = useState(false);
  const [completedTasksLoadError, setCompletedTasksLoadError] = useState<string | null>(null);

  const isSavingRef = useRef(false);
  const lastSavedTasksRef = useRef<string>('');
  const isLoadingUserDataRef = useRef(false);
  const recentlyUpdatedTasksRef = useRef<Map<string, number>>(new Map()); // Track task IDs and timestamps

  // Load user data when authenticated (split loading: incomplete first, then first page of completed)
  const loadUserData = async (showNotification = false) => {
    // Prevent multiple simultaneous calls
    if (isLoadingUserDataRef.current) {
      logger.debug('[loadUserData] Already loading, skipping duplicate call');
      return;
    }

    let timeoutId: number | null = null;
    isLoadingUserDataRef.current = true;

    try {
      setIsLoadingFromDatabase(true); // Prevent save effect from running
      logger.debug('[loadUserData] Loading tasks from Supabase (split loading)...');

      // Set a timeout to prevent infinite loading
      const loadWithTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> => {
        return Promise.race<T>([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error(`${label} timed out after 30 seconds`));
            }, LOAD_TIMEOUT_MS);
          })
        ]);
      };

      // Load incomplete tasks first (all of them via internal pagination)
      const incompleteTasks = await loadWithTimeout(loadIncompleteTasks(), 'Loading incomplete tasks');

      // Clear timeout and reset for next load
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Load first page of completed tasks (get total count from this query)
      const { tasks: completedTasksPage, total: completedTotal } = await loadWithTimeout(
        loadCompletedTasks(COMPLETED_TASKS_PAGE_SIZE, 0),
        'Loading completed tasks'
      );

      // Clear timeout if we got a response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Combine incomplete and first page of completed tasks
      const allTasks = [...incompleteTasks, ...completedTasksPage];

      logger.debug(`[loadUserData] Loaded ${incompleteTasks.length} incomplete + ${completedTasksPage.length} of ${completedTotal} completed tasks`);
      setTasks(allTasks);

      // Update completed tasks pagination state
      setCompletedTasksLoaded(completedTasksPage.length);
      setCompletedTasksTotal(completedTotal);
      setHasMoreCompletedTasks(completedTasksPage.length < completedTotal);

      // Update the last saved ref to prevent triggering save after initial load
      lastSavedTasksRef.current = JSON.stringify(allTasks);
      if (showNotification) {
        const totalLoaded = incompleteTasks.length + completedTasksPage.length;
        setMigrationNotification(`Refreshed! Loaded ${totalLoaded} task${totalLoaded !== 1 ? 's' : ''}`);
        setTimeout(() => {
          setMigrationNotification(null);
        }, 2000);
      }
      // Mark that we've loaded tasks at least once
      setHasLoadedTasks(true);
    } catch (error) {
      logger.error('[loadUserData] Failed to load tasks:', error);
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Only show error if it's a real error, not just a timeout that might recover
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeoutError = errorMessage.includes('timed out');

      // For timeout errors, don't show notification - just log it
      if (!isTimeoutError) {
        setMigrationNotification(`Failed to load tasks: ${errorMessage}. Try refreshing the page.`);
        setTimeout(() => {
          setMigrationNotification(null);
        }, 5000);
      } else {
        logger.warn('[loadUserData] Timeout occurred, but continuing without error notification');
      }

      // Still mark as loaded to prevent infinite retries
      setHasLoadedTasks(true);
      // Set empty tasks so app can still function
      setTasks([]);
      lastSavedTasksRef.current = JSON.stringify([]);
      // Reset completed tasks pagination state
      setCompletedTasksLoaded(0);
      setCompletedTasksTotal(null);
      setHasMoreCompletedTasks(false);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsLoadingFromDatabase(false); // Re-enable save effect
      isLoadingUserDataRef.current = false; // Allow future calls
    }
  };

  // Load more completed tasks (pagination)
  const loadMoreCompletedTasks = async () => {
    if (isLoadingCompletedTasks || !hasMoreCompletedTasks) {
      return;
    }

    setIsLoadingFromDatabase(true); // Prevent redundant saveTasks upserts
    setIsLoadingCompletedTasks(true);
    setCompletedTasksLoadError(null); // Clear any previous error

    try {
      const offset = countCompletedTasks(tasks);
      logger.debug(`[loadMoreCompletedTasks] Loading more completed tasks (offset: ${offset})`);

      const { tasks: newCompletedTasks, total } = await loadCompletedTasks(
        COMPLETED_TASKS_PAGE_SIZE,
        offset
      );

      if (newCompletedTasks.length > 0) {
        // Append new completed tasks to existing tasks
        setTasks(currentTasks => {
          const updatedTasks = [...currentTasks, ...newCompletedTasks];
          lastSavedTasksRef.current = JSON.stringify(updatedTasks);
          return updatedTasks;
        });

        const newLoaded = offset + newCompletedTasks.length;
        const effectiveTotal = Math.max(total, newLoaded);
        setCompletedTasksLoaded(newLoaded);
        setCompletedTasksTotal(effectiveTotal);
        setHasMoreCompletedTasks(newLoaded < effectiveTotal);

        logger.debug(`[loadMoreCompletedTasks] Loaded ${newCompletedTasks.length} more, now ${newLoaded} of ${effectiveTotal}`);
      } else {
        setCompletedTasksTotal(total);
        setHasMoreCompletedTasks(false);
      }
    } catch (error) {
      logger.error('[loadMoreCompletedTasks] Failed to load more completed tasks:', error);
      setCompletedTasksLoadError('Failed to load more tasks. Please try again.');
    } finally {
      setIsLoadingFromDatabase(false);
      setIsLoadingCompletedTasks(false);
    }
  };

  const mergeIncompleteTasks = (
    currentTasks: Task[],
    updatedIncompleteTasks: Task[],
    remotelyModifiedTasks: Task[],
    source: string
  ): Task[] => {
    if (!Array.isArray(currentTasks)) {
      logger.warn(`[${source}] currentTasks is not an array, using reloaded incomplete tasks`);
      lastSavedTasksRef.current = JSON.stringify(updatedIncompleteTasks);
      return updatedIncompleteTasks;
    }

    const recentlyUpdatedIds = Array.from(recentlyUpdatedTasksRef.current.keys());

    const mergedIncompleteTasks = updatedIncompleteTasks.map(reloadedTask => {
      const localTask = currentTasks.find(t => t.id === reloadedTask.id);
      if (localTask && recentlyUpdatedIds.includes(reloadedTask.id)) {
        logger.debug(`[${source}] Preserving local state for recently updated task: ${reloadedTask.id}`);
        return localTask;
      }
      return reloadedTask;
    });

    const reloadedIds = new Set(updatedIncompleteTasks.map(t => t.id));
    const remotelyModifiedIds = new Set(remotelyModifiedTasks.map(t => t.id));

    const missingLocalIncompleteTasks = currentTasks
      .filter(t => !t.completed && !reloadedIds.has(t.id) && !remotelyModifiedIds.has(t.id))
      .filter(t => recentlyUpdatedIds.includes(t.id));

    // Keep existing completed tasks that weren't reloaded or remotely modified
    const currentCompletedTasks = currentTasks.filter(
      t => t.completed && !reloadedIds.has(t.id) && !remotelyModifiedIds.has(t.id)
    );

    // Add remotely completed tasks (tasks completed on another device)
    const remotelyCompletedTasks = remotelyModifiedTasks.filter(t => t.completed);
    if (remotelyCompletedTasks.length > 0) {
      logger.debug(`[${source}] Adding ${remotelyCompletedTasks.length} tasks completed on another device`);
    }

    const finalTasks = [
      ...mergedIncompleteTasks,
      ...missingLocalIncompleteTasks,
      ...currentCompletedTasks,
      ...remotelyCompletedTasks,
    ];
    lastSavedTasksRef.current = JSON.stringify(finalTasks);
    return finalTasks;
  };

  const refreshIncompleteTasks = async (source: string) => {
    if (isLoadingUserDataRef.current) {
      logger.debug(`[${source}] Skipping refresh - full load in progress`);
      return;
    }

    setIsLoadingFromDatabase(true);
    try {
      // Capture current tasks snapshot for detecting remotely-modified tasks
      // We need this before the async load to know which tasks might have been modified elsewhere
      const currentTasksSnapshot = tasks;
      const recentlyUpdatedIds = Array.from(recentlyUpdatedTasksRef.current.keys());

      const updatedIncompleteTasks = await loadIncompleteTasks();
      logger.debug(`[${source}] Reloaded ${updatedIncompleteTasks.length} incomplete tasks`);

      // Find tasks that were locally incomplete but missing from reload (and not recently updated locally)
      // These are candidates for being completed/modified on another device
      const reloadedIds = new Set(updatedIncompleteTasks.map(t => t.id));
      const potentiallyRemotelyModifiedIds = currentTasksSnapshot
        .filter(t => !t.completed && !reloadedIds.has(t.id) && !recentlyUpdatedIds.includes(t.id))
        .map(t => t.id);

      // Fetch current state of these tasks from the database
      let remotelyModifiedTasks: Task[] = [];
      if (potentiallyRemotelyModifiedIds.length > 0) {
        logger.debug(`[${source}] Fetching ${potentiallyRemotelyModifiedIds.length} potentially remotely-modified tasks`);
        remotelyModifiedTasks = await loadTasksByIds(potentiallyRemotelyModifiedIds);
      }

      setTasks(currentTasks => mergeIncompleteTasks(currentTasks, updatedIncompleteTasks, remotelyModifiedTasks, source));
    } catch (error) {
      logger.error(`[${source}] Error reloading tasks:`, error);
    } finally {
      setTimeout(() => {
        setIsLoadingFromDatabase(false);
      }, 500);
    }
  };

  useEffect(() => {
    const completedCount = countCompletedTasks(tasks);
    setCompletedTasksLoaded(prev => (prev === completedCount ? prev : completedCount));

    if (completedTasksTotal !== null) {
      const effectiveTotal = Math.max(completedTasksTotal, completedCount);
      if (effectiveTotal !== completedTasksTotal) {
        setCompletedTasksTotal(effectiveTotal);
      }
      setHasMoreCompletedTasks(completedCount < effectiveTotal);
    }
  }, [tasks, completedTasksTotal]);

  // Load tasks when user is authenticated
  useEffect(() => {
    if (user) {
      // Add a small delay to ensure auth session is fully established
      const loadTimer = setTimeout(() => {
        loadUserData();
      }, AUTH_DELAY_MS);
      
      return () => {
        clearTimeout(loadTimer);
      };
    } else {
      // Reset tasks when user logs out
      setTasks([]);
      setHasLoadedTasks(false);
      lastSavedTasksRef.current = '';
    }
  }, [user]);

  // Save tasks to Supabase whenever they change
  useEffect(() => {
    if (!user || !hasLoadedTasks || isLoadingFromDatabase || isSavingRef.current) {
      return;
    }

    // Check if tasks actually changed by comparing serialized versions
    const currentTasksJson = JSON.stringify(tasks);
    if (currentTasksJson === lastSavedTasksRef.current) {
      logger.debug('[Save Effect] Skipping save - tasks unchanged');
      return;
    }

    logger.debug(`[Save Effect] Saving ${tasks.length} tasks to Supabase`);
    isSavingRef.current = true;
    lastSavedTasksRef.current = currentTasksJson;
    
    saveTasks(tasks)
      .then(() => {
        logger.debug('[Save Effect] Successfully saved tasks');
      })
      .catch(error => {
        logger.error('[Save Effect] Failed to save tasks:', error);
        // Reset the ref on error so we can retry
        lastSavedTasksRef.current = '';
      })
      .finally(() => {
        isSavingRef.current = false;
      });
  }, [tasks, user, hasLoadedTasks, isLoadingFromDatabase]);

  // Real-time subscription for task updates
  useEffect(() => {
    if (!user) return;

    logger.debug('[Real-time] Setting up subscription for user:', user.id);

    // Debounce reloads to avoid excessive queries
    let reloadTimeout: number | null = null;
    const debouncedReload = async () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      reloadTimeout = window.setTimeout(async () => {
        logger.debug('[Real-time] Debounced reload triggered');
        await refreshIncompleteTasks('Real-time');
      }, 1000); // Increased debounce to 1000ms to allow rapid completions to settle
    };
    
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newRecord = payload.new as { id?: string; title?: string; user_id?: string; completed?: boolean } | null;
          const oldRecord = payload.old as { id?: string; user_id?: string } | null;
          
          logger.debug('[Real-time] Change detected:', {
            eventType: payload.eventType,
            table: payload.table,
            new: newRecord ? {
              id: newRecord.id,
              title: newRecord.title,
              user_id: newRecord.user_id,
              completed: newRecord.completed,
            } : null,
            old: oldRecord ? {
              id: oldRecord.id,
              user_id: oldRecord.user_id,
            } : null,
          });
          
          // Check if the change is actually for this user
          const changedUserId = newRecord?.user_id || oldRecord?.user_id;
          if (changedUserId !== user.id) {
            logger.warn(`[Real-time] Change detected for different user: ${changedUserId} vs ${user.id}`);
            return;
          }
          
          // Skip reload if we're currently saving (to prevent loop)
          if (isSavingRef.current) {
            logger.debug('[Real-time] Skipping reload - currently saving');
            return;
          }
          
          // Debounced reload to avoid excessive queries
          debouncedReload();
        }
      )
      .subscribe((status) => {
        logger.debug('[Real-time] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          logger.debug('[Real-time] Successfully subscribed to task changes');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[Real-time] Channel error - real-time updates may not work');
        }
      });

    return () => {
      logger.debug('[Real-time] Cleaning up subscription');
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Reload tasks when page becomes visible (helps with mobile)
  useEffect(() => {
    if (!user) return;

    let reloadTimeout: number | null = null;
    let lastReloadTime = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Only reload if enough time has passed since last reload
        if (now - lastReloadTime > RELOAD_DEBOUNCE_MS) {
          // Clear any pending reload
          if (reloadTimeout) {
            clearTimeout(reloadTimeout);
          }
          // Debounce the reload slightly
          reloadTimeout = window.setTimeout(() => {
            logger.debug('[Visibility] Page became visible, reloading tasks...');
            lastReloadTime = Date.now();
            refreshIncompleteTasks('Visibility'); // Don't reset completed task pagination
          }, 500); // Small delay to prevent rapid-fire reloads
        }
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      // Only reload if enough time has passed since last reload
      if (now - lastReloadTime > RELOAD_DEBOUNCE_MS) {
        // Clear any pending reload
        if (reloadTimeout) {
          clearTimeout(reloadTimeout);
        }
        // Debounce the reload slightly
        reloadTimeout = window.setTimeout(() => {
          logger.debug('[Focus] Window focused, reloading tasks...');
          lastReloadTime = Date.now();
          refreshIncompleteTasks('Focus'); // Don't reset completed task pagination
        }, 500); // Small delay to prevent rapid-fire reloads
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  // Add a new non-recurring task
  // Note: Recurring tasks should be handled by useRecurringTasks hook
  const addTask = (taskData: Partial<Task>) => {
    // Don't handle recurring tasks here - they should be handled by useRecurringTasks
    if (taskData.recurrence) {
      logger.warn('[useTaskManagement] Recurring tasks should be handled by useRecurringTasks hook');
      return;
    }
    
    const normalizedTags = normalizeTags(taskData.tags || []);
    
    const newTask: Task = {
      id: generateId(),
      title: taskData.title || '',
      dueDate: taskData.dueDate || null,
      completed: false,
      subtasks: taskData.subtasks || [],
      tags: normalizedTags,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      recurrence: null,
      recurrenceGroupId: null,
    };
    
    logger.debug(`[Add Task] Adding 1 task to the list. Total tasks will be: ${tasks.length + 1}`);
    setTasks([...tasks, newTask]);
  };

  // Update a non-recurring task
  // Note: Recurring tasks should be handled by useRecurringTasks hook
  const updateTask = (id: string, updates: TaskUpdate) => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;

    // Don't handle recurring tasks here - they should be handled by useRecurringTasks
    if (existingTask.recurrence || updates.recurrence) {
      logger.warn('[useTaskManagement] Recurring task updates should be handled by useRecurringTasks hook');
      return;
    }

    // Track this task as recently updated to prevent reload from overwriting it
    recentlyUpdatedTasksRef.current.set(id, Date.now());
    // Clean up old entries (older than 2 seconds)
    const twoSecondsAgo = Date.now() - 2000;
    for (const [taskId, timestamp] of recentlyUpdatedTasksRef.current.entries()) {
      if (timestamp < twoSecondsAgo) {
        recentlyUpdatedTasksRef.current.delete(taskId);
      }
    }

    // Update pagination counters if completion status changed
    if (updates.completed !== undefined && updates.completed !== existingTask.completed) {
      if (updates.completed) {
        // Task was marked as completed - increment counters
        setCompletedTasksLoaded(prev => prev + 1);
        setCompletedTasksTotal(prev => prev !== null ? prev + 1 : 1);
        logger.debug('[updateTask] Task completed, incremented pagination counters');
      } else {
        // Task was unmarked as completed - decrement counters (not below 0)
        setCompletedTasksLoaded(prev => Math.max(0, prev - 1));
        setCompletedTasksTotal(prev => prev !== null ? Math.max(0, prev - 1) : null);
        logger.debug('[updateTask] Task uncompleted, decremented pagination counters');
      }
    }

    const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;

    setTasks(tasks.map(task => {
      if (task.id === id) {
        // Remove internal flags before saving
        const { _dragDrop, _skipSubtaskPropagation, ...cleanUpdates } = updates;
        const updatedTask = { ...task, ...cleanUpdates, lastModified: new Date().toISOString() };
        if (normalizedTags) {
          updatedTask.tags = normalizedTags;
        }
        return updatedTask;
      }
      return task;
    }));
  };

  // Delete tasks
  const performDelete = async (tasksToDelete: Task[], taskToDelete: Task) => {
    // Clear any existing undo timeout
    if (deletedTask) {
      clearTimeout(deletedTask.timeoutId);
    }

    // Capture original tasks before modification for error recovery
    const originalTasks = tasks;

    // Count completed tasks being deleted for pagination counter update
    const completedTasksBeingDeleted = tasksToDelete.filter(t => t.completed).length;

    // Remove tasks from list
    const taskIdsToDelete = new Set(tasksToDelete.map(t => t.id));
    const remainingTasks = tasks.filter(task => !taskIdsToDelete.has(task.id));
    setTasks(remainingTasks);

    // Update pagination counters for deleted completed tasks
    if (completedTasksBeingDeleted > 0) {
      setCompletedTasksLoaded(prev => Math.max(0, prev - completedTasksBeingDeleted));
      setCompletedTasksTotal(prev => prev !== null ? Math.max(0, prev - completedTasksBeingDeleted) : null);
      logger.debug(`[performDelete] Deleted ${completedTasksBeingDeleted} completed task(s), decremented pagination counters`);
    }

    // Delete from database
    try {
      await deleteTasksFromDatabase(Array.from(taskIdsToDelete));
      logger.debug(`[deleteTask] Successfully deleted ${taskIdsToDelete.size} task(s) from database`);
    } catch (error) {
      logger.error('[deleteTask] Failed to delete tasks from database:', error);
      // Restore original tasks if database delete failed
      setTasks(originalTasks);
      // Restore pagination counters on error
      if (completedTasksBeingDeleted > 0) {
        setCompletedTasksLoaded(prev => prev + completedTasksBeingDeleted);
        setCompletedTasksTotal(prev => prev !== null ? prev + completedTasksBeingDeleted : completedTasksBeingDeleted);
        logger.debug(`[performDelete] Restored pagination counters after delete failure`);
      }
      return;
    }

    // Set up undo with timeout
    const timeoutId = window.setTimeout(() => {
      setDeletedTask(null);
    }, UNDO_TIMEOUT_MS) as unknown as number;

    setDeletedTask({ task: taskToDelete, tasks: tasksToDelete, timeoutId });
  };

  const undoDelete = async () => {
    if (deletedTask) {
      clearTimeout(deletedTask.timeoutId);

      // Count completed tasks being restored for pagination counter update
      const completedTasksBeingRestored = deletedTask.tasks.filter(t => t.completed).length;

      // Restore all deleted tasks
      const restoredTasks = [...tasks, ...deletedTask.tasks];
      setTasks(restoredTasks);

      // Restore pagination counters for restored completed tasks
      if (completedTasksBeingRestored > 0) {
        setCompletedTasksLoaded(prev => prev + completedTasksBeingRestored);
        setCompletedTasksTotal(prev => prev !== null ? prev + completedTasksBeingRestored : completedTasksBeingRestored);
        logger.debug(`[undoDelete] Restored ${completedTasksBeingRestored} completed task(s), incremented pagination counters`);
      }

      // Save restored tasks to database
      try {
        await saveTasks(restoredTasks);
        logger.debug(`[undoDelete] Successfully restored ${deletedTask.tasks.length} task(s) to database`);
      } catch (error) {
        logger.error('[undoDelete] Failed to restore tasks to database:', error);
        // Revert local state if save failed
        setTasks(tasks.filter(task => !deletedTask.tasks.some(dt => dt.id === task.id)));
        // Revert pagination counters on error
        if (completedTasksBeingRestored > 0) {
          setCompletedTasksLoaded(prev => Math.max(0, prev - completedTasksBeingRestored));
          setCompletedTasksTotal(prev => prev !== null ? Math.max(0, prev - completedTasksBeingRestored) : null);
          logger.debug(`[undoDelete] Reverted pagination counters after restore failure`);
        }
      }

      setDeletedTask(null);
    }
  };

  const undoCompletion = (updateTaskFn?: (id: string, updates: TaskUpdate) => void) => {
    if (completedTask) {
      // Restore the task to its previous state
      const taskToRestore = completedTask.previousState;
      // Use provided update function if available (for recurring tasks), otherwise use local one
      if (updateTaskFn) {
        updateTaskFn(taskToRestore.id, {
          completed: taskToRestore.completed,
          subtasks: taskToRestore.subtasks
        });
      } else {
        updateTask(taskToRestore.id, {
          completed: taskToRestore.completed,
          subtasks: taskToRestore.subtasks
        });
      }
      setCompletedTask(null);
    }
  };

  // Expose function to track recent updates (for use by recurring tasks hook)
  const trackRecentUpdate = (id: string) => {
    recentlyUpdatedTasksRef.current.set(id, Date.now());
    // Clean up old entries (older than 2 seconds)
    const twoSecondsAgo = Date.now() - 2000;
    for (const [taskId, timestamp] of recentlyUpdatedTasksRef.current.entries()) {
      if (timestamp < twoSecondsAgo) {
        recentlyUpdatedTasksRef.current.delete(taskId);
      }
    }
  };

  return {
    tasks,
    setTasks,
    addTask,
    updateTask,
    performDelete,
    undoDelete,
    undoCompletion,
    loadUserData,
    deletedTask,
    setDeletedTask,
    completedTask,
    setCompletedTask,
    migrationNotification,
    setMigrationNotification,
    trackRecentUpdate,
    // Progressive loading for completed tasks
    loadMoreCompletedTasks,
    hasMoreCompletedTasks,
    isLoadingCompletedTasks,
    completedTasksLoaded,
    completedTasksTotal,
    completedTasksLoadError,
  };
};
