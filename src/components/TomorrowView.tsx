import { useState, useMemo } from 'react';
import { Task, TaskUpdate, getTagColor } from '../types';
import TaskCard from './TaskCard';
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

  if (tasks.length === 0) {
    return (
      <div>
        <div className="day-nav-header">
          <div className="day-nav">
            <button className="day-nav-btn" onClick={goToPreviousDay}>← Previous</button>
            <h2 className="day-nav-title">{fullDateDisplay}</h2>
            <button className="day-nav-btn" onClick={goToNextDay}>Next →</button>
          </div>
        </div>
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

  return (
    <div>
      <div className="day-nav-header">
        <div className="day-nav">
          <button className="day-nav-btn" onClick={goToPreviousDay}>← Previous</button>
          <h2 className="day-nav-title">{fullDateDisplay}</h2>
          <button className="day-nav-btn" onClick={goToNextDay}>Next →</button>
        </div>
      </div>
      <div className="task-list">
        {sortedTags.map(tag => {
        const tagTasks = grouped[tag];
        const tagColor = tag === 'untagged' 
          ? getTagColor('default', tagColors)
          : getTagColor(tag, tagColors);
        const tagDisplay = tag === 'untagged' ? 'Untagged' : tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
        const isCollapsed = collapsedTags.has(tag);

        return (
          <div key={tag} className="tag-group">
            <div 
              className="tag-group-header" 
              style={{ borderLeftColor: tagColor }}
              onClick={() => toggleTagCollapse(tag)}
            >
              <span className="tag-group-collapse-icon">
                {isCollapsed ? '▶' : '▼'}
              </span>
              <span className="tag-group-name" style={{ color: tagColor }}>
                {tagDisplay}
              </span>
              <span className="tag-group-count" style={{ color: tagColor }}>{tagTasks.length}</span>
            </div>
            {!isCollapsed && (
              <div className="tag-group-tasks">
                {tagTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    tagColors={tagColors}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onUpdateTask={onUpdateTask}
                    showTags={false}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
