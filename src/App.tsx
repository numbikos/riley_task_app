import { useState, useEffect, useMemo, useCallback } from 'react';
import { Task } from './types';
import { isSupabaseConfigured } from './utils/supabase';
import { isDateToday, isDateTomorrow, isDateOverdue, formatDate } from './utils/dateUtils';
import { loadTagColors, saveTasks } from './utils/supabaseStorage';
import { useAuth } from './hooks/useAuth';
import { useViewState } from './hooks/useViewState';
import { useTaskManagement } from './hooks/useTaskManagement';
import { useRecurringTasks } from './hooks/useRecurringTasks';
import { logger } from './utils/logger';
import {
  filterTasksBySearch,
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
import TaskForm from './components/TaskForm';
import TagManager from './components/TagManager';
import UndoNotification from './components/UndoNotification';
import CompletionUndoNotification from './components/CompletionUndoNotification';
import DeleteRecurringDialog from './components/DeleteRecurringDialog';
import Auth from './components/Auth';
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
  const [showTagManager, setShowTagManager] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  // Load tag colors when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      loadTagColors().then(setTagColors);
    } else if (!user) {
      setTagColors({});
    }
  }, [user, loading]);

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
  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const existingTask = tasks.find(t => t.id === id);
    if (!existingTask) return;

    if (existingTask.recurrence || updates.recurrence) {
      updateRecurringTask(id, updates);
    } else {
      updateTaskBase(id, updates);
    }
  }, [tasks, updateRecurringTask, updateTaskBase]);

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
          tasks={filterTasksBySearch(getTodayTasksFiltered(todayViewDate), searchQuery)} 
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
          tasks={filterTasksBySearch(getTomorrowTasksFiltered(tomorrowViewDate), searchQuery)} 
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
          tasks={filterTasksBySearch(getDayTasksFiltered(selectedDayDate), searchQuery)} 
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
          onDeleteGroup={deleteGroup}
          onUpdateTask={updateTask} 
        />;
      case 'completed':
        return <CompletedView 
          tasks={filterTasksBySearch(getCompletedTasksFiltered(), searchQuery)} 
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
              resetToToday();
            }}
          >
            💩 Poop Task
          </h1>
          <div className="app-header-actions">
            <button className="tag-manager-btn desktop-tag-manager-btn" onClick={() => setShowTagManager(true)} title="Manage Tags">
              🏷️
            </button>
            <button 
              className="mobile-menu-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              title="Menu"
              aria-label="Menu"
            >
              <span className="hamburger-icon">☰</span>
            </button>
            <button className="add-task-btn" onClick={() => { setEditingTask(null); setInitialDueDate(null); setShowTaskForm(true); }}>
              <span className="add-task-icon">+</span>
              <span className="add-task-text">Add Task</span>
            </button>
            <div className="user-profile">
              <span className="user-email">{user?.email}</span>
              <button 
                className="logout-btn desktop-logout-btn" 
                onClick={handleLogout} 
                title="Sign Out"
                aria-label="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>
          {showMobileMenu && (
            <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
              <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
                <div className="mobile-menu-header">
                  <span className="mobile-menu-title">Menu</span>
                  <button 
                    className="mobile-menu-close"
                    onClick={() => setShowMobileMenu(false)}
                    aria-label="Close menu"
                  >
                    ×
                  </button>
                </div>
                <div className="mobile-menu-items">
                  <button 
                    className="mobile-menu-item"
                    onClick={() => {
                      setShowTagManager(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <span className="mobile-menu-item-text">Manage Tags</span>
                  </button>
                  <button 
                    className="mobile-menu-item mobile-menu-item-logout"
                    onClick={() => {
                      handleLogout();
                      setShowMobileMenu(false);
                    }}
                  >
                    <span className="mobile-menu-item-text">Sign Out</span>
                  </button>
                  <div className="mobile-menu-version">
                    Version {import.meta.env.VITE_APP_VERSION || '1.0.0'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <nav className="view-nav">
          <button 
            className={currentView === 'today' ? 'active' : ''} 
            onClick={() => { 
              resetToToday();
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
    </div>
  );
}

export default App;
