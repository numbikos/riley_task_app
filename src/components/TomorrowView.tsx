import { useState, useMemo } from 'react';
import { Task, TaskUpdate } from '../types';
import NavigationHeader from './NavigationHeader';
import GroupedTaskList from './GroupedTaskList';
import { formatDate, formatFullDate } from '../utils/dateUtils';
import { startOfDay } from 'date-fns';
import { groupTasksByTag } from '../utils/taskUtils';

interface TomorrowViewProps {
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

export default function TomorrowView({ tasks, date, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask, onNavigateDate, onAddTask }: TomorrowViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  const goToPreviousDay = () => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    onNavigateDate(startOfDay(prevDate));
  };

  const goToNextDay = () => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    onNavigateDate(startOfDay(nextDate));
  };

  const fullDateDisplay = formatFullDate(date);
  const isTomorrow = useMemo(() => formatDate(date) === formatDate(new Date(Date.now() + 86400000)), [date]);

  // Memoize grouped tasks
  const { grouped, sortedTags } = useMemo(() => groupTasksByTag(tasks), [tasks]);

  const toggleTagCollapse = (tag: string) => {
    setCollapsedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Early return AFTER all hooks have been called
  if (tasks.length === 0) {
    return (
      <div>
        <NavigationHeader
          title={fullDateDisplay}
          onPrev={goToPreviousDay}
          onNext={goToNextDay}
        />
        <div className="empty-state">
          <h2>No tasks for {isTomorrow ? 'tomorrow' : fullDateDisplay.toLowerCase()}</h2>
          {onAddTask ? (
            <button
              className="empty-state-add-task-btn"
              onClick={() => onAddTask(date)}
            >
              Add task
            </button>
          ) : (
            <p>Add a task and set its due date to {isTomorrow ? 'tomorrow' : fullDateDisplay.toLowerCase()} to see it here.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavigationHeader
        title={fullDateDisplay}
        onPrev={goToPreviousDay}
        onNext={goToNextDay}
      />
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
    </div>
  );
}
