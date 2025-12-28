import { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { loadTasks, saveTasks, deleteTasks as deleteTasksFromDatabase, generateId } from '../utils/supabaseStorage';
import { supabase } from '../utils/supabase';
import { normalizeTags } from '../utils/taskOperations';
import { logger } from '../utils/logger';

const RELOAD_DEBOUNCE_MS = 2000;
const AUTH_DELAY_MS = 300;
const LOAD_TIMEOUT_MS = 30000;

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
export const useTaskManagement = (user: any) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isLoadingFromDatabase, setIsLoadingFromDatabase] = useState(false);
  const [migrationNotification, setMigrationNotification] = useState<string | null>(null);
  const [deletedTask, setDeletedTask] = useState<DeletedTaskState | null>(null);
  const [completedTask, setCompletedTask] = useState<CompletedTaskState | null>(null);
  
  const isSavingRef = useRef(false);
  const lastSavedTasksRef = useRef<string>('');
  const isLoadingUserDataRef = useRef(false);

  // Load user data when authenticated
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
      logger.debug('[loadUserData] Loading tasks from Supabase...');
      
      // Set a timeout to prevent infinite loading
      const loadTasksWithTimeout = Promise.race<Task[]>([
        loadTasks(),
        new Promise<Task[]>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error('Loading tasks timed out after 30 seconds'));
          }, LOAD_TIMEOUT_MS);
        })
      ]);
      
      const loadedTasks = await loadTasksWithTimeout;
      
      // Clear timeout if we got a response
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      logger.debug(`[loadUserData] Loaded ${loadedTasks.length} tasks from Supabase`);
      setTasks(loadedTasks);
      // Update the last saved ref to prevent triggering save after initial load
      lastSavedTasksRef.current = JSON.stringify(loadedTasks);
      if (showNotification) {
        setMigrationNotification(`Refreshed! Loaded ${loadedTasks.length} task${loadedTasks.length !== 1 ? 's' : ''}`);
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
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsLoadingFromDatabase(false); // Re-enable save effect
      isLoadingUserDataRef.current = false; // Allow future calls
    }
  };

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
        setIsLoadingFromDatabase(true);
        try {
          const updatedTasks = await loadTasks();
          logger.debug(`[Real-time] Reloaded ${updatedTasks.length} tasks after change`);
          
          // Update the last saved ref to prevent triggering save after reload
          lastSavedTasksRef.current = JSON.stringify(updatedTasks);
          
          setTasks(updatedTasks);
        } catch (error) {
          logger.error('[Real-time] Error reloading tasks:', error);
        } finally {
          // Wait a bit longer to ensure state updates are complete
          setTimeout(() => {
            setIsLoadingFromDatabase(false);
          }, 500);
        }
      }, 500); // Wait 500ms before reloading
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
            loadUserData(false); // Don't show notification for auto-refresh
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
          loadUserData(false); // Don't show notification for auto-refresh
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
  const updateTask = (id: string, updates: Partial<Task>) => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;
    
    // Don't handle recurring tasks here - they should be handled by useRecurringTasks
    if (existingTask.recurrence || updates.recurrence) {
      logger.warn('[useTaskManagement] Recurring task updates should be handled by useRecurringTasks hook');
      return;
    }
    
    const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;
    
    setTasks(tasks.map(task => {
      if (task.id === id) {
        // Remove internal flags before saving
        const { _dragDrop, _skipSubtaskPropagation, ...cleanUpdates } = updates as any;
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

    // Remove tasks from list
    const taskIdsToDelete = new Set(tasksToDelete.map(t => t.id));
    const remainingTasks = tasks.filter(task => !taskIdsToDelete.has(task.id));
    setTasks(remainingTasks);

    // Delete from database
    try {
      await deleteTasksFromDatabase(Array.from(taskIdsToDelete));
      logger.debug(`[deleteTask] Successfully deleted ${taskIdsToDelete.size} task(s) from database`);
    } catch (error) {
      logger.error('[deleteTask] Failed to delete tasks from database:', error);
      // Restore original tasks if database delete failed
      setTasks(originalTasks);
      return;
    }

    // Set up undo with 3 second timeout
    const timeoutId = window.setTimeout(() => {
      setDeletedTask(null);
    }, 3000) as unknown as number;

    setDeletedTask({ task: taskToDelete, tasks: tasksToDelete, timeoutId });
  };

  const undoDelete = async () => {
    if (deletedTask) {
      clearTimeout(deletedTask.timeoutId);
      // Restore all deleted tasks
      const restoredTasks = [...tasks, ...deletedTask.tasks];
      setTasks(restoredTasks);
      
      // Save restored tasks to database
      try {
        await saveTasks(restoredTasks);
        logger.debug(`[undoDelete] Successfully restored ${deletedTask.tasks.length} task(s) to database`);
      } catch (error) {
        logger.error('[undoDelete] Failed to restore tasks to database:', error);
        // Revert local state if save failed
        setTasks(tasks.filter(task => !deletedTask.tasks.some(dt => dt.id === task.id)));
      }
      
      setDeletedTask(null);
    }
  };

  const undoCompletion = (updateTaskFn?: (id: string, updates: Partial<Task>) => void) => {
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
  };
};

