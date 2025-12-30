import { useState, useMemo, useCallback } from 'react';
import { Task, TaskUpdate } from '../types';
import GroupedTaskList from './GroupedTaskList';
import { isDateOverdue, formatDate, formatFullDate } from '../utils/dateUtils';

interface TodayViewProps {
  tasks: Task[];
  date: Date;
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  onNavigateDate: (date: Date) => void;
  onAddTask?: (date: Date) => void;
}

export default function TodayView({ tasks, date, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask, onNavigateDate: _onNavigateDate, onAddTask }: TodayViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  const fullDateDisplay = formatFullDate(date);
  const isToday = useMemo(() => formatDate(date) === formatDate(new Date()), [date]);

  // Separate overdue and today tasks (only when viewing today) - memoized
  const { overdueTasks, todayTasks } = useMemo(() => {
    if (isToday) {
      const overdue = tasks.filter(task => isDateOverdue(task.dueDate));
      const today = tasks.filter(task => !isDateOverdue(task.dueDate));
      return { overdueTasks: overdue, todayTasks: today };
    }
    return { overdueTasks: [], todayTasks: tasks };
  }, [tasks, isToday]);

  // Move toggleTagCollapse to useCallback to ensure hooks are always called in same order
  const toggleTagCollapse = useCallback((tag: string) => {
    setCollapsedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  }, []);

  // Early return AFTER all hooks have been called
  if (tasks.length === 0) {
    return (
      <div>
        <div className="empty-state">
          <h2>No tasks for {isToday ? 'today' : fullDateDisplay.toLowerCase()}</h2>
          {onAddTask ? (
            <button
              className="empty-state-add-task-btn"
              onClick={() => onAddTask(date)}
            >
              Add task
            </button>
          ) : (
            <p>Add a task and set its due date to {isToday ? 'today' : fullDateDisplay.toLowerCase()} to see it here.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="task-list">
        {todayTasks.length > 0 && (
          <GroupedTaskList
            tasks={todayTasks}
            tagColors={tagColors}
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateTask={onUpdateTask}
            collapsedTags={collapsedTags}
            onToggleTagCollapse={toggleTagCollapse}
          />
        )}
        {overdueTasks.length > 0 && (
          <>
            <div className="overdue-section-header">
              <h3 style={{ color: 'var(--danger)', margin: '1.5rem 0 0.75rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                Overdue
              </h3>
            </div>
            <GroupedTaskList
              tasks={overdueTasks}
              tagColors={tagColors}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateTask={onUpdateTask}
              collapsedTags={collapsedTags}
              onToggleTagCollapse={toggleTagCollapse}
              showDate={true}
            />
          </>
        )}
      </div>
    </div>
  );
}
