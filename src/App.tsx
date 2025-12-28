import { useState, useEffect, useRef } from 'react';
import { Task, ViewType, RecurrenceType } from './types';
import { loadTasks as loadTasksFromStorage, loadTagColors as loadTagColorsFromStorage, loadViewState, saveViewState } from './utils/storage';
import { loadTasks, saveTasks, generateId, loadTagColors, saveTagColors, deleteTasks as deleteTasksFromDatabase } from './utils/supabaseStorage';
import { supabase, isSupabaseConfigured } from './utils/supabase';
import { isDateToday, isDateTomorrow, isDateOverdue, generateRecurringDates, formatDate } from './utils/dateUtils';
import TodayView from './components/TodayView';
import TomorrowView from './components/TomorrowView';
import DayView from './components/DayView';
import WeekView from './components/WeekView';
import AllTasksView from './components/AllTasksView';
import CompletedView from './components/CompletedView';
import TaskForm from './components/TaskForm';
import TagManager from './components/TagManager';
import UndoNotification from './components/UndoNotification';
import CompletionUndoNotification from './components/CompletionUndoNotification';
import Auth from './components/Auth';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  
  // Load view state from localStorage on initialization
  const savedViewState = loadViewState();
  const [currentView, setCurrentView] = useState<ViewType>(savedViewState?.currentView || 'today');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDueDate, setInitialDueDate] = useState<string | null>(null);
  const [deletedTask, setDeletedTask] = useState<{ task: Task; tasks: Task[]; timeoutId: number } | null>(null);
  const [completedTask, setCompletedTask] = useState<{ task: Task; previousState: Task } | null>(null);
  const [autoRenewNotification, setAutoRenewNotification] = useState<{ taskTitle: string; count: number } | null>(null);
  const [migrationNotification, setMigrationNotification] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTagManager, setShowTagManager] = useState(false);
  const [hasLoadedTasks, setHasLoadedTasks] = useState(false);
  const [isLoadingFromDatabase, setIsLoadingFromDatabase] = useState(false);
  const isSavingRef = useRef(false);
  const lastSavedTasksRef = useRef<string>('');
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(() => {
    if (savedViewState?.selectedDayDate) {
      const date = new Date(savedViewState.selectedDayDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  });
  const [weekViewDate, setWeekViewDate] = useState<Date | null>(() => {
    if (savedViewState?.weekViewDate) {
      const date = new Date(savedViewState.weekViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  });
  const [todayViewDate, setTodayViewDate] = useState<Date>(() => {
    if (savedViewState?.todayViewDate) {
      const date = new Date(savedViewState.todayViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [tomorrowViewDate, setTomorrowViewDate] = useState<Date>(() => {
    if (savedViewState?.tomorrowViewDate) {
      const date = new Date(savedViewState.tomorrowViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  });

  // Check authentication state on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserData();
      } else {
        setTasks([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Save view state to localStorage whenever it changes
  useEffect(() => {
    if (user) { // Only save if user is authenticated
      saveViewState({
        currentView,
        selectedDayDate: selectedDayDate ? selectedDayDate.toISOString() : null,
        weekViewDate: weekViewDate ? weekViewDate.toISOString() : null,
        todayViewDate: todayViewDate.toISOString(),
        tomorrowViewDate: tomorrowViewDate.toISOString(),
      });
    }
  }, [currentView, selectedDayDate, weekViewDate, todayViewDate, tomorrowViewDate, user]);

  // Load user data when authenticated
  const loadUserData = async (showNotification = false) => {
    try {
      setIsLoadingFromDatabase(true); // Prevent save effect from running
      console.log('[loadUserData] Loading tasks from Supabase...');
      const loadedTasks = await loadTasks();
      console.log(`[loadUserData] Loaded ${loadedTasks.length} tasks from Supabase`);
      if (loadedTasks.length === 0) {
        // Check if there's localStorage data to migrate
        const localTasks = loadTasksFromStorage();
        if (localTasks.length > 0) {
          // Migrate localStorage data
          await migrateLocalStorageData(localTasks);
        } else {
          // Start with empty task list
          setTasks([]);
          lastSavedTasksRef.current = JSON.stringify([]);
        }
      } else {
        setTasks(loadedTasks);
        // Update the last saved ref to prevent triggering save after initial load
        lastSavedTasksRef.current = JSON.stringify(loadedTasks);
        if (showNotification) {
          setMigrationNotification(`Refreshed! Loaded ${loadedTasks.length} task${loadedTasks.length !== 1 ? 's' : ''}`);
          setTimeout(() => {
            setMigrationNotification(null);
          }, 2000);
        }
      }
      // Mark that we've loaded tasks at least once
      setHasLoadedTasks(true);
    } catch (error) {
      console.error('[loadUserData] Failed to load tasks:', error);
      // Show error to user
      setMigrationNotification(`Failed to load tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => {
        setMigrationNotification(null);
      }, 5000);
    } finally {
      setIsLoadingFromDatabase(false); // Re-enable save effect
    }
  };

  // Migrate localStorage data to Supabase
  const migrateLocalStorageData = async (localTasks: Task[]) => {
    try {
      setMigrationNotification('Migrating your tasks...');
      
      // Migrate tasks
      await saveTasks(localTasks);
      
      // Migrate tag colors
      const localTagColors = loadTagColorsFromStorage();
      if (Object.keys(localTagColors).length > 0) {
        await saveTagColors(localTagColors);
      }
      
      // Clear localStorage after successful migration
      localStorage.removeItem('riley-tasks');
      localStorage.removeItem('riley-tags');
      localStorage.removeItem('riley-tag-colors');
      
      // Reload tasks from database to get the new UUIDs
      const migratedTasks = await loadTasks();
      setTasks(migratedTasks);
      
      setMigrationNotification('Migration complete! Your tasks have been synced to the cloud.');
      setTimeout(() => {
        setMigrationNotification(null);
      }, 5000);
    } catch (error: any) {
      console.error('Migration failed:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setMigrationNotification(`Migration failed: ${errorMessage}. Check the browser console for details.`);
      setTimeout(() => {
        setMigrationNotification(null);
      }, 8000);
    }
  };

  // Load tag colors when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      loadTagColors().then(setTagColors);
    } else if (!user) {
      setTagColors({});
    }
  }, [user, loading]);

  // Load tasks when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      loadUserData();
    }
  }, [user, loading]);

  // Save tasks to Supabase whenever they change
  // BUT: Only save if:
  // 1. We've loaded tasks at least once (to avoid deleting tasks on initial empty state)
  // 2. We're not currently loading from database (to prevent infinite loop)
  // 3. We're not already saving (to prevent concurrent saves)
  // 4. Tasks actually changed (to prevent unnecessary saves)
  useEffect(() => {
    if (!user || !hasLoadedTasks || isLoadingFromDatabase || isSavingRef.current) {
      if (user && !hasLoadedTasks) {
        console.log('[Save Effect] Skipping save - tasks not loaded yet');
      } else if (user && isLoadingFromDatabase) {
        console.log('[Save Effect] Skipping save - currently loading from database');
      } else if (user && isSavingRef.current) {
        console.log('[Save Effect] Skipping save - already saving');
      }
      return;
    }

    // Check if tasks actually changed by comparing serialized versions
    const currentTasksJson = JSON.stringify(tasks);
    if (currentTasksJson === lastSavedTasksRef.current) {
      console.log('[Save Effect] Skipping save - tasks unchanged');
      return;
    }

    console.log(`[Save Effect] Saving ${tasks.length} tasks to Supabase`);
    isSavingRef.current = true;
    lastSavedTasksRef.current = currentTasksJson;
    
    saveTasks(tasks)
      .then(() => {
        console.log('[Save Effect] Successfully saved tasks');
      })
      .catch(error => {
        console.error('[Save Effect] Failed to save tasks:', error);
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

    console.log('[Real-time] Setting up subscription for user:', user.id);
    
    // Debounce reloads to avoid excessive queries
    let reloadTimeout: number | null = null;
    const debouncedReload = async () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      reloadTimeout = window.setTimeout(async () => {
        console.log('[Real-time] Debounced reload triggered');
        setIsLoadingFromDatabase(true);
        try {
          const updatedTasks = await loadTasks();
          console.log(`[Real-time] Reloaded ${updatedTasks.length} tasks after change`);
          
          // Update the last saved ref to prevent triggering save after reload
          lastSavedTasksRef.current = JSON.stringify(updatedTasks);
          
          setTasks(updatedTasks);
        } catch (error) {
          console.error('[Real-time] Error reloading tasks:', error);
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
          
          console.log('[Real-time] Change detected:', {
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
            console.warn(`[Real-time] Change detected for different user: ${changedUserId} vs ${user.id}`);
            return;
          }
          
          // Skip reload if we're currently saving (to prevent loop)
          if (isSavingRef.current) {
            console.log('[Real-time] Skipping reload - currently saving');
            return;
          }
          
          // Debounced reload to avoid excessive queries
          debouncedReload();
        }
      )
      .subscribe((status) => {
        console.log('[Real-time] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Real-time] Successfully subscribed to task changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Real-time] Channel error - real-time updates may not work');
        }
      });

    return () => {
      console.log('[Real-time] Cleaning up subscription');
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Reload tasks when page becomes visible (helps with mobile)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Visibility] Page became visible, reloading tasks...');
        loadUserData(false); // Don't show notification for auto-refresh
      }
    };

    const handleFocus = () => {
      console.log('[Focus] Window focused, reloading tasks...');
      loadUserData(false); // Don't show notification for auto-refresh
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const handleAuthSuccess = async () => {
    await loadUserData();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // The auth state change listener will handle clearing the user state
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const normalizeTags = (tags: string[]): string[] => {
    return tags.map(tag => tag.toLowerCase());
  };

  const addTask = (taskData: Partial<Task>) => {
    const recurrenceGroupId = taskData.recurrence ? generateId() : null;
    const dueDate = taskData.dueDate || null;
    const normalizedTags = normalizeTags(taskData.tags || []);
    
    const newTasks: Task[] = [];
    
    if (taskData.recurrence && dueDate) {
      // Generate all recurring occurrences (exactly 50 instances)
      const multiplier = taskData.recurrence === 'custom' ? (taskData.recurrenceMultiplier || 1) : 1;
      const customFreq = taskData.recurrence === 'custom' ? taskData.customFrequency : undefined;
      const recurringDates = generateRecurringDates(
        dueDate, 
        taskData.recurrence, 
        50,
        multiplier,
        customFreq
      );
      console.log(`[Recurring Task] Creating ${recurringDates.length} occurrences for "${taskData.title}" with ${taskData.recurrence} recurrence starting ${dueDate}`);
      
      recurringDates.forEach((date, index) => {
        const isLastInstance = index === recurringDates.length - 1;
        newTasks.push({
          id: generateId(),
          title: taskData.title || '',
          dueDate: date,
          completed: false,
          subtasks: index === 0 ? (taskData.subtasks || []) : (taskData.subtasks || []).map(st => ({ ...st, completed: false })),
          tags: normalizedTags,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          recurrence: (taskData.recurrence as RecurrenceType) || null,
          recurrenceGroupId,
          recurrenceMultiplier: taskData.recurrence === 'custom' ? multiplier : undefined,
          customFrequency: taskData.recurrence === 'custom' ? customFreq : undefined,
          isLastInstance,
          autoRenew: taskData.autoRenew || false,
        });
      });
    } else if (taskData.recurrence && !dueDate) {
      console.warn(`[Recurring Task] Cannot create recurring task "${taskData.title}" without a due date`);
    } else {
      // Single non-recurring task
      newTasks.push({
        id: generateId(),
        title: taskData.title || '',
        dueDate,
        completed: false,
        subtasks: taskData.subtasks || [],
        tags: normalizedTags,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        recurrence: null,
        recurrenceGroupId: null,
      });
      console.log(`[Recurring Task] Created ${newTasks.length} tasks. First: ${newTasks[0]?.dueDate}, Last: ${newTasks[newTasks.length - 1]?.dueDate}`);
    }
    
    console.log(`[Add Task] Adding ${newTasks.length} task(s) to the list. Total tasks will be: ${tasks.length + newTasks.length}`);
    setTasks([...tasks, ...newTasks]);
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;

    // Check if recurrence settings are being changed
    const recurrenceChanged = updates.recurrence !== undefined && updates.recurrence !== existingTask.recurrence;
    const multiplierChanged = updates.recurrenceMultiplier !== undefined && updates.recurrenceMultiplier !== existingTask.recurrenceMultiplier;
    const customFreqChanged = updates.customFrequency !== undefined && updates.customFrequency !== existingTask.customFrequency;
    const recurrenceSettingsChanged = recurrenceChanged || multiplierChanged || customFreqChanged;
    
    // Check if this is the first instance in the recurrence group (earliest due date)
    const isFirstInstance = existingTask.recurrenceGroupId ? (() => {
      const groupTasks = tasks.filter(t => t.recurrenceGroupId === existingTask.recurrenceGroupId);
      if (groupTasks.length === 0) return true;
      const earliestTask = groupTasks.reduce((earliest, current) => {
        if (!earliest.dueDate) return current;
        if (!current.dueDate) return earliest;
        return new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest;
      });
      return earliestTask.id === existingTask.id;
    })() : true;
    
    const dueDateChanged = updates.dueDate !== undefined && updates.dueDate !== existingTask.dueDate;
    const isDragDrop = (updates as any)._dragDrop === true;
    
    // Only regenerate if recurrence settings changed OR if editing the first instance's due date
    // BUT: Skip regeneration if this is a drag-and-drop operation (just update the single instance)
    if (!isDragDrop && recurrenceSettingsChanged && (updates.recurrence || existingTask.recurrence) && (updates.dueDate || existingTask.dueDate)) {
      // Delete old recurring group if it exists
      let tasksToRemove: Task[] = [];
      if (existingTask.recurrenceGroupId) {
        // Find all future instances (due date >= today OR incomplete and overdue)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        tasksToRemove = tasks.filter(task => {
          if (task.recurrenceGroupId !== existingTask.recurrenceGroupId) return false;
          const taskDate = new Date(task.dueDate!);
          taskDate.setHours(0, 0, 0, 0);
          return taskDate >= today || (!task.completed && taskDate < today);
        });
      } else {
        tasksToRemove = [existingTask];
      }
      
      const taskIdsToRemove = new Set(tasksToRemove.map(t => t.id));
      const remainingTasks = tasks.filter(task => !taskIdsToRemove.has(task.id));
      
      // Create new recurring occurrences
      const recurrenceGroupId = generateId();
      const dueDate = updates.dueDate || existingTask.dueDate;
      const multiplier = updates.recurrence === 'custom' ? (updates.recurrenceMultiplier || existingTask.recurrenceMultiplier || 1) : 1;
      const customFreq = updates.recurrence === 'custom' ? (updates.customFrequency || existingTask.customFrequency) : undefined;
      const recurringDates = generateRecurringDates(dueDate!, updates.recurrence || existingTask.recurrence!, 50, multiplier, customFreq);
      
      const normalizedTags = normalizeTags(updates.tags || existingTask.tags);
      const autoRenewValue = updates.autoRenew !== undefined ? updates.autoRenew : existingTask.autoRenew || false;
      const newTasks: Task[] = recurringDates.map((date, index) => {
        const isLastInstance = index === recurringDates.length - 1;
        return {
          id: generateId(),
          title: updates.title || existingTask.title,
          dueDate: date,
          completed: false,
          subtasks: index === 0 ? (updates.subtasks || existingTask.subtasks) : (updates.subtasks || existingTask.subtasks || []).map(st => ({ ...st, completed: false })),
          tags: normalizedTags,
          createdAt: existingTask.createdAt,
          lastModified: new Date().toISOString(),
          recurrence: updates.recurrence || existingTask.recurrence || null,
          recurrenceGroupId,
          recurrenceMultiplier: updates.recurrence === 'custom' ? multiplier : undefined,
          customFrequency: updates.recurrence === 'custom' ? customFreq : undefined,
          isLastInstance,
          autoRenew: autoRenewValue,
        };
      });
      
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
      
      const multiplier = existingTask.recurrence === 'custom' ? (existingTask.recurrenceMultiplier || 1) : 1;
      const customFreq = existingTask.recurrence === 'custom' ? existingTask.customFrequency : undefined;
      const recurringDates = generateRecurringDates(updates.dueDate, existingTask.recurrence, 50, multiplier, customFreq);
      const normalizedTags = normalizeTags(updates.tags || existingTask.tags);
      const newTasks: Task[] = recurringDates.map((date, index) => {
        const isLastInstance = index === recurringDates.length - 1;
        return {
          id: generateId(),
          title: updates.title || existingTask.title,
          dueDate: date,
          completed: false,
          subtasks: index === 0 ? (updates.subtasks || existingTask.subtasks) : (updates.subtasks || existingTask.subtasks || []).map(st => ({ ...st, completed: false })),
          tags: normalizedTags,
          createdAt: existingTask.createdAt,
          lastModified: new Date().toISOString(),
          recurrence: existingTask.recurrence,
          recurrenceGroupId: existingTask.recurrenceGroupId,
          recurrenceMultiplier: existingTask.recurrenceMultiplier,
          customFrequency: existingTask.customFrequency,
          isLastInstance,
          autoRenew: existingTask.autoRenew || false,
        };
      });
      
      setTasks([...remainingTasks, ...newTasks]);
    } else {
      // Regular update - check if this is a recurring task that should propagate updates
      if (existingTask.recurrenceGroupId && !isDragDrop) {
        // For recurring tasks, propagate title, tags, and optionally subtasks to future instances
        // Due dates are independent per instance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;
        
        // Check if subtasks changed and should be propagated (user confirmed in prompt)
        const subtasksChanged = updates.subtasks !== undefined && 
          JSON.stringify(updates.subtasks) !== JSON.stringify(existingTask.subtasks);
        const skipSubtaskPropagation = (updates as any)._skipSubtaskPropagation === true;
        
        // Extract fields that should propagate (title, tags, and subtasks if user confirmed)
        const propagatingUpdates: Partial<Task> = {};
        if (updates.title !== undefined) {
          propagatingUpdates.title = updates.title;
        }
        if (normalizedTags) {
          propagatingUpdates.tags = normalizedTags;
        }
        // Only propagate subtasks if they changed AND user confirmed (not skipped)
        if (subtasksChanged && updates.subtasks && !skipSubtaskPropagation) {
          propagatingUpdates.subtasks = updates.subtasks.map(st => ({ ...st, completed: false }));
        }
        
        setTasks(tasks.map(task => {
          if (task.id === id) {
            // Update the specific task being edited with all updates
            // Remove the _dragDrop flag before saving (if present)
            const { _dragDrop, ...cleanUpdates } = updates as any;
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
        // For drag-and-drop or non-recurring tasks, always update just this instance
        const normalizedTags = updates.tags ? normalizeTags(updates.tags) : undefined;
        setTasks(tasks.map(task => {
          if (task.id === id) {
            // Remove the _dragDrop flag before saving (if present)
            const { _dragDrop, ...cleanUpdates } = updates as any;
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

  const deleteTask = async (id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    if (!taskToDelete) return;

    // Clear any existing undo timeout
    if (deletedTask) {
      clearTimeout(deletedTask.timeoutId);
    }

    // Capture original tasks before modification for error recovery
    const originalTasks = tasks;

    // If this is a recurring task, delete all future occurrences (due date >= today OR incomplete and overdue)
    let tasksToDelete: Task[] = [];
    if (taskToDelete.recurrenceGroupId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tasksToDelete = tasks.filter(task => {
        if (task.recurrenceGroupId !== taskToDelete.recurrenceGroupId) return false;
        const taskDate = new Date(task.dueDate!);
        taskDate.setHours(0, 0, 0, 0);
        // Delete if future (>= today) OR incomplete and overdue
        return taskDate >= today || (!task.completed && taskDate < today);
      });
    } else {
      tasksToDelete = [taskToDelete];
    }

    // Remove tasks from list
    const taskIdsToDelete = new Set(tasksToDelete.map(t => t.id));
    const remainingTasks = tasks.filter(task => !taskIdsToDelete.has(task.id));
    setTasks(remainingTasks);

    // Delete from database
    try {
      await deleteTasksFromDatabase(Array.from(taskIdsToDelete));
      console.log(`[deleteTask] Successfully deleted ${taskIdsToDelete.size} task(s) from database`);
    } catch (error) {
      console.error('[deleteTask] Failed to delete tasks from database:', error);
      // Restore original tasks if database delete failed
      setTasks(originalTasks);
      return;
    }

    // Set up undo with 3 second timeout (store all deleted tasks)
    const timeoutId = window.setTimeout(() => {
      setDeletedTask(null);
    }, 3000) as unknown as number;

    setDeletedTask({ task: taskToDelete, tasks: tasksToDelete, timeoutId });
  };

  const undoDelete = async () => {
    if (deletedTask) {
      clearTimeout(deletedTask.timeoutId);
      // Restore all deleted tasks (including all occurrences if it was a recurring task)
      const restoredTasks = [...tasks, ...deletedTask.tasks];
      setTasks(restoredTasks);
      
      // Save restored tasks to database
      try {
        await saveTasks(restoredTasks);
        console.log(`[undoDelete] Successfully restored ${deletedTask.tasks.length} task(s) to database`);
      } catch (error) {
        console.error('[undoDelete] Failed to restore tasks to database:', error);
        // Revert local state if save failed
        setTasks(tasks.filter(task => !deletedTask.tasks.some(dt => dt.id === task.id)));
      }
      
      setDeletedTask(null);
    }
  };

  const toggleTaskComplete = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newCompletedState = !task.completed;
    
    // If completing the task and there are incomplete subtasks, prompt for confirmation
    if (newCompletedState && task.subtasks.length > 0) {
      const incompleteSubtasks = task.subtasks.filter(st => !st.completed);
      if (incompleteSubtasks.length > 0) {
        const confirmed = window.confirm(
          `This task has ${incompleteSubtasks.length} incomplete subtask${incompleteSubtasks.length > 1 ? 's' : ''}. ` +
          `Do you want to complete the task and mark all subtasks as complete?`
        );
        
        if (!confirmed) {
          return; // User cancelled, don't complete the task
        }
        
        // Complete the task and all subtasks
        const completedSubtasks = task.subtasks.map(st => ({ ...st, completed: true }));
        const previousState = { ...task };
        updateTask(id, { completed: true, subtasks: completedSubtasks });
        
        // Set up undo notification
        setCompletedTask({ task: { ...task, completed: true, subtasks: completedSubtasks }, previousState });
        return;
      }
    }
    
    // Normal toggle (no incomplete subtasks or uncompleting)
    if (newCompletedState) {
      // Task is being completed - save previous state for undo
      const previousState = { ...task };
      updateTask(id, { completed: true });
      setCompletedTask({ task: { ...task, completed: true }, previousState });
      
      // Check if this is the last instance with auto-renew enabled
      if (task.isLastInstance && task.autoRenew && task.recurrence && task.dueDate && task.recurrenceGroupId) {
        // Calculate next start date (day after current due date)
        const currentDate = new Date(task.dueDate);
        currentDate.setDate(currentDate.getDate() + 1);
        const nextStartDate = formatDate(currentDate);
        
        // Generate next 50 instances
        const multiplier = task.recurrence === 'custom' ? (task.recurrenceMultiplier || 1) : 1;
        const customFreq = task.recurrence === 'custom' ? task.customFrequency : undefined;
        const recurringDates = generateRecurringDates(
          nextStartDate,
          task.recurrence,
          50,
          multiplier,
          customFreq
        );
        
        const normalizedTags = normalizeTags(task.tags);
        const newRecurrenceGroupId = generateId();
        const newTasks: Task[] = recurringDates.map((date, index) => {
          const isLastInstance = index === recurringDates.length - 1;
          return {
            id: generateId(),
            title: task.title,
            dueDate: date,
            completed: false,
            subtasks: task.subtasks.map(st => ({ ...st, completed: false })),
            tags: normalizedTags,
            createdAt: task.createdAt,
            lastModified: new Date().toISOString(),
            recurrence: task.recurrence,
            recurrenceGroupId: newRecurrenceGroupId,
            recurrenceMultiplier: task.recurrenceMultiplier,
            customFrequency: task.customFrequency,
            isLastInstance,
            autoRenew: true,
          };
        });
        
        // Add new tasks
        setTasks(currentTasks => [...currentTasks, ...newTasks]);
        
        // Show notification
        setAutoRenewNotification({ taskTitle: task.title, count: 50 });
        setTimeout(() => {
          setAutoRenewNotification(null);
        }, 5000);
      }
    } else {
      // Task is being uncompleted - clear any undo notification
      setCompletedTask(null);
      updateTask(id, { completed: false });
    }
  };

  const undoCompletion = () => {
    if (completedTask) {
      // Restore the task to its previous state
      const taskToRestore = completedTask.previousState;
      updateTask(taskToRestore.id, {
        completed: taskToRestore.completed,
        subtasks: taskToRestore.subtasks
      });
      setCompletedTask(null);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setInitialDueDate(null);
    setShowTaskForm(true);
  };

  const handleAddTask = (date: Date) => {
    setEditingTask(null);
    setInitialDueDate(formatDate(date));
    setShowTaskForm(true);
  };

  const getTodayTasks = (date?: Date) => {
    const targetDate = date || todayViewDate;
    const dateStr = formatDate(targetDate);
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

  const getTomorrowTasks = (date?: Date) => {
    const targetDate = date || tomorrowViewDate;
    const dateStr = formatDate(targetDate);
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

  const getDayTasks = (date: Date) => {
    // Get tasks for a specific date (without overdue tasks)
    const dateStr = formatDate(date);
    return tasks.filter(task => {
      if (task.completed) return false;
      if (!task.dueDate) return false;
      // Only include tasks due on this exact date, not overdue
      const taskDateStr = task.dueDate.split('T')[0];
      return taskDateStr === dateStr;
    });
  };

  const getWeekTasks = () => {
    // Return all incomplete tasks with due dates - WeekView will filter by the selected week
    return tasks.filter(task => {
      if (task.completed) return false;
      return task.dueDate !== null;
    });
  };

  const getCompletedTasks = () => {
    return tasks.filter(task => task.completed);
  };

  const filterTasksBySearch = (taskList: Task[], query: string): Task[] => {
    if (!query.trim()) return taskList;
    
    const lowerQuery = query.toLowerCase().trim();
    
    return taskList.filter(task => {
      // Search in title
      if (task.title.toLowerCase().includes(lowerQuery)) return true;
      
      // Search in tags - check for exact match first, then substring match
      // Tags are stored in lowercase, so we can compare directly
      if (task.tags.some(tag => {
        const normalizedTag = tag.toLowerCase();
        // Exact match (case-insensitive)
        if (normalizedTag === lowerQuery) return true;
        // Substring match for flexibility
        if (normalizedTag.includes(lowerQuery)) return true;
        return false;
      })) return true;
      
      // Search in subtasks
      if (task.subtasks.some(subtask => subtask.text.toLowerCase().includes(lowerQuery))) return true;
      
      return false;
    });
  };

  const renderView = () => {
    switch (currentView) {
      case 'today':
        return <TodayView 
          tasks={filterTasksBySearch(getTodayTasks(todayViewDate), searchQuery)} 
          date={todayViewDate}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onDelete={deleteTask} 
          onUpdateTask={updateTask}
          onNavigateDate={(date) => setTodayViewDate(date)}
          onAddTask={handleAddTask}
        />;
      case 'tomorrow':
        return <TomorrowView 
          tasks={filterTasksBySearch(getTomorrowTasks(tomorrowViewDate), searchQuery)} 
          date={tomorrowViewDate}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onDelete={deleteTask} 
          onUpdateTask={updateTask}
          onNavigateDate={(date) => setTomorrowViewDate(date)}
          onAddTask={handleAddTask}
        />;
      case 'day':
        if (!selectedDayDate) return null;
        return <DayView 
          tasks={filterTasksBySearch(getDayTasks(selectedDayDate), searchQuery)} 
          date={selectedDayDate}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onDelete={deleteTask} 
          onUpdateTask={updateTask} 
          onBackToWeek={() => { setCurrentView('week'); setSearchQuery(''); }}
          onNavigateDate={(date) => setSelectedDayDate(date)}
          onAddTask={handleAddTask}
        />;
      case 'week':
        return <WeekView 
          tasks={getWeekTasks()} 
          initialWeekDate={weekViewDate}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onUpdateTask={updateTask} 
          onNavigateToDay={(date, weekDate) => { setSelectedDayDate(date); setWeekViewDate(weekDate); setCurrentView('day'); setSearchQuery(''); }} 
          onAddTask={handleAddTask} 
        />;
      case 'all':
        return <AllTasksView 
          tasks={filterTasksBySearch(tasks.filter(t => !t.completed), searchQuery)} 
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onDelete={deleteTask} 
          onUpdateTask={updateTask} 
        />;
      case 'completed':
        return <CompletedView 
          tasks={filterTasksBySearch(getCompletedTasks(), searchQuery)} 
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete} 
          onEdit={handleEdit} 
          onDelete={deleteTask} 
          onUpdateTask={updateTask} 
        />;
      default:
        return null;
    }
  };

  // Show configuration error if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #121212 100%)',
        color: '#E0E0E0',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '600px',
          background: '#1A1A1A',
          border: '1px solid rgba(255, 0, 0, 0.3)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}>
          <h2 style={{ color: '#FF6B6B', marginTop: 0, marginBottom: '1rem' }}>Configuration Error</h2>
          <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
            Missing Supabase environment variables. Please create a <code style={{ background: '#2A2A2A', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>.env</code> file in the root directory with:
          </p>
          <pre style={{
            background: '#2A2A2A',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}>
{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>
          <p style={{ marginBottom: 0, fontSize: '0.9rem', color: '#888' }}>
            See the README.md file for detailed setup instructions.
          </p>
        </div>
      </div>
    );
  }

  // Show loading screen
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #121212 100%)',
        color: '#E0E0E0',
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1 
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              setTodayViewDate(today);
              setCurrentView('today');
              setSearchQuery('');
            }}
          >
             Poop Task
          </h1>
          <div className="app-header-actions">
            <button className="tag-manager-btn" onClick={() => setShowTagManager(true)} title="Manage Tags">
              🏷️
            </button>
            <button className="add-task-btn" onClick={() => { setEditingTask(null); setInitialDueDate(null); setShowTaskForm(true); }}>
              <span className="add-task-icon">+</span>
              <span className="add-task-text">Add Task</span>
            </button>
            <div className="user-profile">
              <span className="user-email">{user?.email}</span>
              <button 
                className="logout-btn" 
                onClick={handleLogout} 
                title="Sign Out"
                aria-label="Sign Out"
              >
                <span className="logout-icon">🚪</span>
                <span className="logout-text">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
        <nav className="view-nav">
          <button 
            className={currentView === 'today' ? 'active' : ''} 
            onClick={() => { 
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              setTodayViewDate(today);
              setCurrentView('today'); 
              setSearchQuery(''); 
            }}
          >
            Today
          </button>
          <button 
            className={currentView === 'tomorrow' ? 'active' : ''} 
            onClick={() => { 
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(0, 0, 0, 0);
              setTomorrowViewDate(tomorrow);
              setCurrentView('tomorrow'); 
              setSearchQuery(''); 
            }}
          >
            Tomorrow
          </button>
          <button 
            className={currentView === 'week' ? 'active' : ''} 
            onClick={() => { setCurrentView('week'); setSearchQuery(''); setWeekViewDate(null); }}
          >
            Next 5
          </button>
          <button 
            className={currentView === 'all' ? 'active' : ''} 
            onClick={() => { setCurrentView('all'); setSearchQuery(''); }}
          >
            All Tasks
          </button>
          <button 
            className={currentView === 'completed' ? 'active' : ''} 
            onClick={() => { setCurrentView('completed'); setSearchQuery(''); }}
          >
            Completed
          </button>
        </nav>
      </header>

      {currentView !== 'week' && (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <main className="app-main">
        {renderView()}
      </main>

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          onSave={(taskData) => {
            if (editingTask) {
              updateTask(editingTask.id, taskData);
            } else {
              addTask(taskData);
            }
            setShowTaskForm(false);
            setEditingTask(null);
            setInitialDueDate(null);
          }}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(null);
            setInitialDueDate(null);
          }}
          initialDueDate={initialDueDate}
        />
      )}

      {deletedTask && (
        <UndoNotification
          taskTitle={deletedTask.tasks.length > 1 
            ? `${deletedTask.task.title} (${deletedTask.tasks.length} tasks)`
            : deletedTask.task.title}
          onUndo={undoDelete}
          onDismiss={() => {
            if (deletedTask) {
              clearTimeout(deletedTask.timeoutId);
              setDeletedTask(null);
            }
          }}
        />
      )}

      {completedTask && (
        <CompletionUndoNotification
          taskTitle={completedTask.task.title}
          onUndo={undoCompletion}
          onDismiss={() => setCompletedTask(null)}
        />
      )}

      {autoRenewNotification && (
        <div className="auto-renew-notification" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1A1A1A',
          border: '1px solid rgba(64, 224, 208, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          zIndex: 2000,
          minWidth: '300px',
          maxWidth: '400px',
          borderLeft: '4px solid #40E0D0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#40E0D0', fontWeight: 600, marginBottom: '0.25rem' }}>Auto-Renewal</div>
              <div style={{ color: '#F8FAFC', fontSize: '0.9rem' }}>
                Created {autoRenewNotification.count} new instances of "{autoRenewNotification.taskTitle}"
              </div>
            </div>
            <button
              onClick={() => setAutoRenewNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#888';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showTagManager && (
        <TagManager
          tasks={tasks}
          onUpdateTasks={async (updatedTasks) => {
            setTasks(updatedTasks);
            await saveTasks(updatedTasks);
          }}
          onTagColorsChange={(updatedColors) => {
            // Update tag colors immediately when changed in TagManager
            setTagColors(updatedColors);
          }}
          onClose={async () => {
            setShowTagManager(false);
            // Reload tag colors when TagManager closes to ensure we have the latest
            const updatedColors = await loadTagColors();
            setTagColors(updatedColors);
          }}
        />
      )}

      {migrationNotification && (
        <div className="auto-renew-notification" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1A1A1A',
          border: '1px solid rgba(64, 224, 208, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          zIndex: 2000,
          minWidth: '300px',
          maxWidth: '400px',
          borderLeft: '4px solid #40E0D0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#40E0D0', fontWeight: 600, marginBottom: '0.25rem' }}>Migration</div>
              <div style={{ color: '#F8FAFC', fontSize: '0.9rem' }}>
                {migrationNotification}
              </div>
            </div>
            <button
              onClick={() => setMigrationNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#888';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
