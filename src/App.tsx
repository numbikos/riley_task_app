import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, TaskUpdate } from './types';
import { isSupabaseConfigured } from './utils/supabase';
import { isDateToday, isDateTomorrow, isDateOverdue, formatDate } from './utils/dateUtils';
import { loadTagColors, saveTasks } from './utils/supabaseStorage';
import { useAuth } from './hooks/useAuth';
import { useViewState } from './hooks/useViewState';
import { useTaskManagement } from './hooks/useTaskManagement';
import { useRecurringTasks } from './hooks/useRecurringTasks';
import { logger } from './utils/logger';
import {
  getTodayTasks,
  getTomorrowTasks,
  getDayTasks,
  getWeekTasks,
  getCompletedTasks,
} from './utils/taskOperations';
import TodayView from './components/TodayView';
import TomorrowView from './components/TomorrowView';
import DayView from './components/DayView';
import WeekView from './components/WeekView';
import AllTasksView from './components/AllTasksView';
import CompletedView from './components/CompletedView';
import StatsView from './components/StatsView';
import GlobalSearch from './components/GlobalSearch';
import TaskForm from './components/TaskForm';
import TagManager from './components/TagManager';
import UndoNotification from './components/UndoNotification';
import CompletionUndoNotification from './components/CompletionUndoNotification';
import DeleteRecurringDialog from './components/DeleteRecurringDialog';
import EditRecurringDialog from './components/EditRecurringDialog';
import LoveMessageDialog from './components/LoveMessageDialog';
import Auth from './components/Auth';
import { findFirstInstance } from './utils/recurringTaskHelpers';
import { getTodayDateString, getLastLoveMessageDate, setLastLoveMessageDate } from './utils/storage';
import { TARGET_USER_EMAIL, getDailyMessage } from './data/loveMessages';
import './App.css';

function App() {
  // Authentication
  const { user, loading, signOut } = useAuth();
  
  // View state
  const {
    currentView,
    setCurrentView,
    selectedDayDate,
    setSelectedDayDate,
    weekViewDate,
    setWeekViewDate,
    todayViewDate,
    setTodayViewDate,
    tomorrowViewDate,
    setTomorrowViewDate,
    searchQuery,
    setSearchQuery,
    resetToToday,
  } = useViewState(user);

  // Task management
  const {
    tasks,
    setTasks,
    addTask: addTaskBase,
    updateTask: updateTaskBase,
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
  } = useTaskManagement(user);

  // Recurring tasks
  const [autoRenewNotification, setAutoRenewNotification] = useState<{ taskTitle: string; count: number } | null>(null);
  const {
    addRecurringTask,
    updateRecurringTask,
    extendRecurringTask,
    handleAutoRenewal,
  } = useRecurringTasks(tasks, setTasks, setAutoRenewNotification);

  // UI state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDueDate, setInitialDueDate] = useState<string | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [pendingRecurrenceEdit, setPendingRecurrenceEdit] = useState<{
    task: Task;
    updates: TaskUpdate;
  } | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoveMessage, setShowLoveMessage] = useState(false);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  // Track viewport size to conditionally render mobile-only UI
  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  // Load tag colors when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      loadTagColors().then(setTagColors);
    } else if (!user) {
      setTagColors({});
    }
  }, [user, loading]);

  // Show daily love message for target user
  useEffect(() => {
    if (!user?.email) return;
    if (user.email !== TARGET_USER_EMAIL) return;

    const today = getTodayDateString();
    const lastShown = getLastLoveMessageDate();

    if (lastShown !== today) {
      // Consume-on-show: mark as shown immediately
      setLastLoveMessageDate(today);
      setShowLoveMessage(true);
    }
  }, [user?.email]);

  // Handle auth success
  const handleAuthSuccess = useCallback(async () => {
    resetToToday();
    setTimeout(() => {
      loadUserData();
    }, 300);
  }, [resetToToday, loadUserData]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error('Failed to sign out:', error);
    }
  }, [signOut]);

  // Combined add task function (handles both recurring and non-recurring)
  const addTask = useCallback((taskData: Partial<Task>) => {
    if (taskData.recurrence && taskData.dueDate) {
      addRecurringTask(taskData);
    } else {
      addTaskBase(taskData);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  }, [addRecurringTask, addTaskBase]);

  // Combined update task function (handles both recurring and non-recurring)
  const updateTask = useCallback((id: string, updates: TaskUpdate, editMode?: 'all' | 'thisAndFollowing') => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;

    // Track this update to prevent race conditions with real-time reloads
    trackRecentUpdate(id);
    
    // Also track any tasks that might be affected by recurring task updates
    if (existingTask.recurrenceGroupId && (existingTask.recurrence || updates.recurrence)) {
      // Track all tasks in the same recurrence group
      tasks
        .filter(t => t.recurrenceGroupId === existingTask.recurrenceGroupId)
        .forEach(t => trackRecentUpdate(t.id));
    }

    if (existingTask.recurrence || updates.recurrence) {
      // Check if recurrence settings are being changed
      const recurrenceChanged = updates.recurrence !== undefined && updates.recurrence !== existingTask.recurrence;
      const multiplierChanged = updates.recurrenceMultiplier !== undefined && updates.recurrenceMultiplier !== existingTask.recurrenceMultiplier;
      const customFreqChanged = updates.customFrequency !== undefined && updates.customFrequency !== existingTask.customFrequency;
      const recurrenceSettingsChanged = recurrenceChanged || multiplierChanged || customFreqChanged;
      
      // Check if this is the first instance
      const firstInstance = existingTask.recurrenceGroupId 
        ? findFirstInstance(tasks, existingTask.recurrenceGroupId)
        : null;
      const isFirstInstance = firstInstance?.id === existingTask.id || !firstInstance;
      
      // If recurrence settings changed on a non-first instance, show dialog (unless mode already specified)
      if (recurrenceSettingsChanged && !isFirstInstance && !editMode) {
        setPendingRecurrenceEdit({ task: existingTask, updates });
        return;
      }
      
      updateRecurringTask(id, updates, editMode || 'thisAndFollowing');
    } else {
      updateTaskBase(id, updates);
    }
  }, [tasks, updateRecurringTask, updateTaskBase, trackRecentUpdate]);

  // Delete task handler
  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    if (!taskToDelete) return;

    // If this is a recurring task, show dialog to choose deletion option
    if (taskToDelete.recurrenceGroupId) {
      setPendingDeleteTask(taskToDelete);
      return;
    }

    // For non-recurring tasks, delete immediately
    await performDelete([taskToDelete], taskToDelete);
  }, [tasks, performDelete]);

  // Delete group handler
  const deleteGroup = useCallback(async (groupId: string) => {
    const groupTasks = tasks.filter(task => task.recurrenceGroupId === groupId);
    if (groupTasks.length === 0) return;

    const incompleteTasks = groupTasks.filter(task => !task.completed);
    if (incompleteTasks.length === 0) return;

    const representativeTask = groupTasks[0];
    const confirmed = window.confirm(
      `Delete all incomplete tasks in "${representativeTask.title}"? This will delete ${incompleteTasks.length} task${incompleteTasks.length !== 1 ? 's' : ''}.`
    );
    
    if (confirmed) {
      await performDelete(incompleteTasks, representativeTask);
    }
  }, [tasks, performDelete]);

  // Delete future occurrences
  const deleteFutureOccurrences = useCallback(async () => {
    if (!pendingDeleteTask || !pendingDeleteTask.dueDate) return;

    const selectedTaskDateStr = pendingDeleteTask.dueDate.split('T')[0];
    
    const tasksToDelete = tasks.filter(task => {
      if (task.recurrenceGroupId !== pendingDeleteTask.recurrenceGroupId) return false;
      if (!task.dueDate) return false;
      if (task.completed) return false;
      
      const taskDateStr = task.dueDate.split('T')[0];
      return taskDateStr >= selectedTaskDateStr;
    });

    setPendingDeleteTask(null);
    await performDelete(tasksToDelete, pendingDeleteTask);
  }, [pendingDeleteTask, tasks, performDelete]);

  // Delete open occurrences
  const deleteOpenOccurrences = useCallback(async () => {
    if (!pendingDeleteTask) return;

    const tasksToDelete = tasks.filter(task => {
      if (task.recurrenceGroupId !== pendingDeleteTask.recurrenceGroupId) return false;
      return !task.completed;
    });

    setPendingDeleteTask(null);
    await performDelete(tasksToDelete, pendingDeleteTask);
  }, [pendingDeleteTask, tasks, performDelete]);

  // Handle recurrence edit - "This and following"
  const handleRecurrenceEditThisAndFollowing = useCallback(() => {
    if (!pendingRecurrenceEdit) return;
    const { task, updates } = pendingRecurrenceEdit;
    setPendingRecurrenceEdit(null);
    setShowTaskForm(false);
    setEditingTask(null);
    setInitialDueDate(null);
    updateTask(task.id, updates, 'thisAndFollowing');
  }, [pendingRecurrenceEdit, updateTask]);

  // Handle recurrence edit - "All"
  const handleRecurrenceEditAll = useCallback(() => {
    if (!pendingRecurrenceEdit) return;
    const { task, updates } = pendingRecurrenceEdit;
    setPendingRecurrenceEdit(null);
    setShowTaskForm(false);
    setEditingTask(null);
    setInitialDueDate(null);
    updateTask(task.id, updates, 'all');
  }, [pendingRecurrenceEdit, updateTask]);

  // Toggle task complete
  const toggleTaskComplete = useCallback((id: string) => {
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
          return;
        }
        
        const completedSubtasks = task.subtasks.map(st => ({ ...st, completed: true }));
        const previousState = { ...task };
        updateTask(id, { completed: true, subtasks: completedSubtasks });
        
        setCompletedTask({ task: { ...task, completed: true, subtasks: completedSubtasks }, previousState });
        return;
      }
    }
    
    // Normal toggle
    if (newCompletedState) {
      const previousState = { ...task };
      updateTask(id, { completed: true });
      setCompletedTask({ task: { ...task, completed: true }, previousState });
      
      // Handle auto-renewal if this is the last instance
      handleAutoRenewal(task);
    } else {
      setCompletedTask(null);
      updateTask(id, { completed: false });
    }
  }, [tasks, updateTask, handleAutoRenewal]);

  // Edit handler
  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setInitialDueDate(null);
    setShowTaskForm(true);
  }, []);

  // Add task handler
  const handleAddTask = useCallback((date: Date) => {
    setEditingTask(null);
    setInitialDueDate(formatDate(date));
    setShowTaskForm(true);
  }, []);

  // Task filtering functions using utilities (memoized)
  const getTodayTasksFiltered = useMemo(() => {
    return (date?: Date) => getTodayTasks(tasks, date || todayViewDate, isDateToday, isDateOverdue, formatDate);
  }, [tasks, todayViewDate]);

  const getTomorrowTasksFiltered = useMemo(() => {
    return (date?: Date) => getTomorrowTasks(tasks, date || tomorrowViewDate, isDateTomorrow, formatDate);
  }, [tasks, tomorrowViewDate]);

  const getDayTasksFiltered = useMemo(() => {
    return (date: Date) => getDayTasks(tasks, date, formatDate);
  }, [tasks]);

  const getWeekTasksFiltered = useMemo(() => {
    return () => getWeekTasks(tasks);
  }, [tasks]);

  const getCompletedTasksFiltered = useMemo(() => {
    return () => getCompletedTasks(tasks);
  }, [tasks]);

  // Render view
  const renderView = () => {
    switch (currentView) {
      case 'today':
        return <TodayView
          tasks={getTodayTasksFiltered(todayViewDate)}
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
          tasks={getTomorrowTasksFiltered(tomorrowViewDate)}
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
          tasks={getDayTasksFiltered(selectedDayDate)}
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
          tasks={getWeekTasksFiltered()}
          initialWeekDate={weekViewDate}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete}
          onEdit={handleEdit}
          onUpdateTask={updateTask}
          onNavigateToDay={(date, weekDate) => { setSelectedDayDate(date); setWeekViewDate(weekDate); setCurrentView('day', { dayDate: date }); setSearchQuery(''); }}
          onAddTask={handleAddTask}
          onWeekDateChange={setWeekViewDate}
        />;
      case 'all':
        return <AllTasksView
          tasks={tasks.filter(t => !t.completed)}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete}
          onEdit={handleEdit}
          onDelete={deleteTask}
          onDeleteGroup={deleteGroup}
          onUpdateTask={updateTask}
          onAddTask={handleAddTask}
        />;
      case 'completed':
        return <CompletedView
          tasks={getCompletedTasksFiltered()}
          tagColors={tagColors}
          onToggleComplete={toggleTaskComplete}
          onEdit={handleEdit}
          onDelete={deleteTask}
          onUpdateTask={updateTask}
          hasMore={hasMoreCompletedTasks}
          isLoadingMore={isLoadingCompletedTasks}
          onLoadMore={loadMoreCompletedTasks}
          loadedCount={completedTasksLoaded}
          totalCount={completedTasksTotal}
          loadError={completedTasksLoadError}
        />;
      case 'stats':
        return <StatsView
          tasks={tasks}
          tagColors={tagColors}
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
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '600px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--danger)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: 'var(--shadow-xl)',
        }}>
          <h2 style={{ color: 'var(--danger)', marginTop: 0, marginBottom: '1rem' }}>Configuration Error</h2>
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
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
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
        <div className="header-left">
          <div className="app-logo" onClick={() => resetToToday()}>
            <span>Riley's Task Manager</span>
          </div>
          <nav className="main-nav">
            <button 
              className={`nav-tab ${currentView === 'today' ? 'active' : ''}`}
              onClick={() => resetToToday()}
            >
              Today
            </button>
            <button 
              className={`nav-tab ${currentView === 'tomorrow' ? 'active' : ''}`}
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                setTomorrowViewDate(tomorrow);
                setCurrentView('tomorrow');
                setSearchQuery('');
              }}
            >
              Upcoming
            </button>
            <button 
              className={`nav-tab ${currentView === 'week' ? 'active' : ''}`}
              onClick={() => { setCurrentView('week'); setSearchQuery(''); setWeekViewDate(null); }}
            >
              Next 5
            </button>
            <button 
              className={`nav-tab ${currentView === 'all' ? 'active' : ''}`}
              onClick={() => { setCurrentView('all'); setSearchQuery(''); }}
            >
              All Tasks
            </button>
            <button
              className={`nav-tab ${currentView === 'completed' ? 'active' : ''}`}
              onClick={() => { setCurrentView('completed'); setSearchQuery(''); }}
            >
              Completed
            </button>
            <button
              className={`nav-tab ${currentView === 'stats' ? 'active' : ''}`}
              onClick={() => { setCurrentView('stats'); setSearchQuery(''); }}
            >
              Stats
            </button>
          </nav>
        </div>

        <GlobalSearch
          tasks={tasks}
          tagColors={tagColors}
          onSelectTask={handleEdit}
          query={searchQuery}
          setQuery={setSearchQuery}
          currentView={currentView}
          todayViewDate={todayViewDate}
          tomorrowViewDate={tomorrowViewDate}
          selectedDayDate={selectedDayDate}
          weekViewDate={weekViewDate}
          hasMoreCompletedTasks={hasMoreCompletedTasks}
          onLoadMoreCompleted={loadMoreCompletedTasks}
        />

        <div className="header-right">
          <button 
            className="btn-new-task"
            onClick={() => { setEditingTask(null); setInitialDueDate(null); setShowTaskForm(true); }}
            title="New Task"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>New Task</span>
          </button>

          <div className="user-menu-container" style={{ position: 'relative' }}>
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user?.email || 'User'}
            >
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </button>
            
            {showUserMenu && (
              <>
                <div className="menu-overlay" onClick={() => setShowUserMenu(false)} />
                <div className="user-menu-dropdown">
                  <div className="user-menu-email">{user?.email}</div>
                  <button 
                    className="user-menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTagManager(true);
                      setShowUserMenu(false);
                    }}
                  >
                    Manage Tags
                  </button>
                  <button 
                    className="user-menu-item logout"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                  >
                    Sign Out
                  </button>
                  <div style={{ fontSize: '0.75rem', color: '#666', padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.25rem' }}>
                    Version {import.meta.env.VITE_APP_VERSION || '1.0.0'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {renderView()}
      </main>

      {isMobile && (
        <nav className="mobile-bottom-nav">
          <button 
            className={currentView === 'today' ? 'active' : ''} 
            onClick={() => resetToToday()}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Today</span>
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
            <span className="nav-icon">🌅</span>
            <span className="nav-label">Tomorrow</span>
          </button>
          <button 
            className={currentView === 'week' ? 'active' : ''} 
            onClick={() => { setCurrentView('week'); setSearchQuery(''); setWeekViewDate(null); }}
          >
            <span className="nav-icon">🗓️</span>
            <span className="nav-label">Next 5</span>
          </button>
          <button 
            className={currentView === 'completed' ? 'active' : ''} 
            onClick={() => { setCurrentView('completed'); setSearchQuery(''); }}
          >
            <span className="nav-icon">✅</span>
            <span className="nav-label">Done</span>
          </button>
          <button
            className={currentView === 'all' ? 'active' : ''}
            onClick={() => { setCurrentView('all'); setSearchQuery(''); }}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-label">All</span>
          </button>
          <button
            className={currentView === 'stats' ? 'active' : ''}
            onClick={() => { setCurrentView('stats'); setSearchQuery(''); }}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Stats</span>
          </button>
        </nav>
      )}

      <footer className="app-footer">
        <div className="app-footer-content">
          <span className="app-footer-version">Version {import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
        </div>
      </footer>

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
          onExtendRecurring={editingTask?.recurrenceGroupId ? () => {
            if (editingTask) {
              extendRecurringTask(editingTask.id);
            }
          } : undefined}
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
          onUndo={() => undoCompletion(updateTask)}
          onDismiss={() => setCompletedTask(null)}
        />
      )}

      {pendingDeleteTask && (
        <DeleteRecurringDialog
          taskTitle={pendingDeleteTask.title}
          taskDueDate={pendingDeleteTask.dueDate}
          onDeleteFuture={deleteFutureOccurrences}
          onDeleteOpen={deleteOpenOccurrences}
          onCancel={() => setPendingDeleteTask(null)}
        />
      )}

      {pendingRecurrenceEdit && (
        <EditRecurringDialog
          taskTitle={pendingRecurrenceEdit.task.title}
          taskDueDate={pendingRecurrenceEdit.task.dueDate}
          oldRecurrence={pendingRecurrenceEdit.task.recurrence}
          newRecurrence={pendingRecurrenceEdit.updates.recurrence || null}
          onThisAndFollowing={handleRecurrenceEditThisAndFollowing}
          onAll={handleRecurrenceEditAll}
          onCancel={() => {
            setPendingRecurrenceEdit(null);
          }}
        />
      )}

      {autoRenewNotification && (
        <div className="auto-renew-notification">
          <div className="notification-content">
            <div className="notification-body">
              <div className="notification-title">Auto-Renewal</div>
              <div className="notification-message">
                Created {autoRenewNotification.count} new instances of "{autoRenewNotification.taskTitle}"
              </div>
            </div>
            <button
              className="notification-close-btn"
              onClick={() => setAutoRenewNotification(null)}
              aria-label="Close notification"
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
            setTagColors(updatedColors);
          }}
          onClose={async () => {
            setShowTagManager(false);
            const updatedColors = await loadTagColors();
            setTagColors(updatedColors);
          }}
        />
      )}

      {migrationNotification && (
        <div className="migration-notification">
          <div className="notification-content">
            <div className="notification-body">
              <div className="notification-title">Migration</div>
              <div className="notification-message">
                {migrationNotification}
              </div>
            </div>
            <button
              className="notification-close-btn"
              onClick={() => setMigrationNotification(null)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showLoveMessage && (
        <LoveMessageDialog
          message={getDailyMessage(getTodayDateString())}
          onDismiss={() => setShowLoveMessage(false)}
        />
      )}
    </div>
  );
}

export default App;
