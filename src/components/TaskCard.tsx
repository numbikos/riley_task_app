import { Task, TaskUpdate, getTagColor } from '../types';
import { getDateDisplay, isDateOverdue, formatRecurrenceDisplay } from '../utils/dateUtils';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  tagColors?: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  showDate?: boolean;
  showTags?: boolean;
}

export default function TaskCard({ task, tagColors = {}, onToggleComplete, onEdit, onDelete, onUpdateTask, showDate = false, showTags = true }: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const totalSubtasks = task.subtasks.length;
  const tagColor = task.tags.length > 0 ? getTagColor(task.tags[0], tagColors) : getTagColor('default', tagColors);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger edit if clicking on checkbox, delete button, or subtask checkbox
    const target = e.target as HTMLElement;
    if (
      target.closest('.task-checkbox') ||
      target.closest('.task-action-btn') ||
      target.closest('.subtask-checkbox')
    ) {
      return;
    }
    onEdit(task);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  return (
    <div 
      className={`task-card ${task.completed ? 'completed' : ''}`} 
      style={{ borderLeftColor: tagColor }}
      onClick={handleCardClick}
    >
      <div className="task-header">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.completed}
          onChange={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id);
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="task-title">{task.title}</div>
        <div className="task-actions">
          <button
            className="task-action-btn delete"
            onClick={handleDeleteClick}
            title="Delete task"
          >
            <Trash2 className="icon-sm" />
          </button>
        </div>
      </div>
      
      {showDate && task.dueDate && (
        <div className={`task-description ${isDateOverdue(task.dueDate) && !task.completed ? 'task-date--overdue' : ''}`}>
          Due: {getDateDisplay(task.dueDate)}
          {isDateOverdue(task.dueDate) && !task.completed && ' (Overdue)'}
          {task.recurrence && (
            <span className="task-recurrence-badge">
              <RefreshCw className="icon-sm" /> {formatRecurrenceDisplay(task.recurrence, task.recurrenceMultiplier, task.customFrequency)}
            </span>
          )}
        </div>
      )}
      {!showDate && task.recurrence && (
        <div className="task-description task-recurrence-info">
          <RefreshCw className="icon-sm" /> Repeats {formatRecurrenceDisplay(task.recurrence, task.recurrenceMultiplier, task.customFrequency)}
        </div>
      )}
      {task.isLastInstance && !task.completed && (
        <div className="task-renewal-container" onClick={(e) => e.stopPropagation()}>
          <div className="task-description task-last-occurrence">
            <AlertTriangle className="icon-sm" /> LAST OCCURRENCE
          </div>
          <button 
            className="btn btn-primary btn-small renew-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
          >
            Extend recurring task
          </button>
        </div>
      )}

      {showTags && task.tags.length > 0 && (
        <div className="task-tags">
          {task.tags.map(tag => {
            const displayName = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
            return (
              <span
                key={tag}
                className="task-tag"
                style={{ background: getTagColor(tag, tagColors) }}
              >
                {displayName}
              </span>
            );
          })}
        </div>
      )}

      {task.subtasks.length > 0 && (
        <div className="subtasks">
          {task.subtasks.map(subtask => (
            <div key={subtask.id} className={`subtask-item ${subtask.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                className="subtask-checkbox"
                checked={subtask.completed}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onUpdateTask) {
                    const updatedSubtasks = task.subtasks.map(st =>
                      st.id === subtask.id ? { ...st, completed: !st.completed } : st
                    );
                    onUpdateTask(task.id, { subtasks: updatedSubtasks });
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="subtask-text">{subtask.text}</span>
            </div>
          ))}
          {totalSubtasks > 0 && (
            <div className="subtask-progress-container">
              <div className="subtask-progress-bar-bg">
                <div 
                  className="subtask-progress-bar-fill" 
                  style={{ 
                    width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                    background: tagColor
                  }}
                ></div>
              </div>
              <div className="subtask-progress-text">
                {completedSubtasks}/{totalSubtasks}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
