import { useState } from 'react';
import { Task, getTagColor } from '../types';
import TaskCard from './TaskCard';
import { isDateOverdue, formatDate, formatFullDate } from '../utils/dateUtils';
import { groupTasksByTag } from '../utils/taskUtils';

interface TodayViewProps {
  tasks: Task[];
  date: Date;
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onNavigateDate: (date: Date) => void;
  onAddTask?: (date: Date) => void;
}

export default function TodayView({ tasks, date, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask, onNavigateDate: _onNavigateDate, onAddTask }: TodayViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  const fullDateDisplay = formatFullDate(date);
  const isToday = formatDate(date) === formatDate(new Date());

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

  // Separate overdue and today tasks (only when viewing today)
  const overdueTasks = isToday ? tasks.filter(task => isDateOverdue(task.dueDate)) : [];
  const todayTasks = isToday ? tasks.filter(task => !isDateOverdue(task.dueDate)) : tasks;

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

  const renderGroupedTasks = (taskList: Task[]) => {
    const { grouped, sortedTags } = groupTasksByTag(taskList);
    
    return sortedTags.map(tag => {
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
    });
  };

  return (
    <div>
      <div className="task-list">
        {todayTasks.length > 0 && (
          <>
            {renderGroupedTasks(todayTasks)}
          </>
        )}
        {overdueTasks.length > 0 && (
          <>
            <div className="overdue-section-header">
              <h3 style={{ color: '#FF6B6B', margin: '1.5rem 0 0.75rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                Overdue
              </h3>
            </div>
            {renderGroupedTasks(overdueTasks)}
          </>
        )}
      </div>
    </div>
  );
}
