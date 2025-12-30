import { useState, useCallback } from 'react';
import { Task, TaskUpdate } from '../types';
import NavigationHeader from './NavigationHeader';
import GroupedTaskList from './GroupedTaskList';
import { startOfDay } from 'date-fns';
import { formatFullDate } from '../utils/dateUtils';

interface DayViewProps {
  tasks: Task[];
  date: Date;
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  onBackToWeek?: () => void;
  onNavigateDate?: (date: Date) => void;
  onAddTask?: (date: Date) => void;
}

export default function DayView({ tasks, date, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask, onBackToWeek, onNavigateDate, onAddTask }: DayViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const fullDateDisplay = formatFullDate(date);

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

  const goToPreviousDay = () => {
    if (onNavigateDate) {
      const prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      onNavigateDate(startOfDay(prevDate));
    }
  };

  const goToNextDay = () => {
    if (onNavigateDate) {
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      onNavigateDate(startOfDay(nextDate));
    }
  };

  return (
    <div>
      {onNavigateDate && (
        <NavigationHeader
          title={fullDateDisplay}
          onPrev={goToPreviousDay}
          onNext={goToNextDay}
          onToday={onBackToWeek}
          todayLabel="← Back to Week"
        />
      )}
      {tasks.length === 0 ? (
        <div className="empty-state">
          <h2>No tasks for {fullDateDisplay}</h2>
          {onAddTask ? (
            <button
              className="empty-state-add-task-btn"
              onClick={() => onAddTask(date)}
            >
              Add task
            </button>
          ) : (
            <p>Add a task and set its due date to {fullDateDisplay} to see it here.</p>
          )}
        </div>
      ) : (
        <div className="task-list">
          <GroupedTaskList
            tasks={tasks}
            tagColors={tagColors}
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateTask={onUpdateTask}
            collapsedTags={collapsedTags}
            onToggleTagCollapse={toggleTagCollapse}
          />
        </div>
      )}
    </div>
  );
}

