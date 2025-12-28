import { useState } from 'react';
import { Task, TaskUpdate, getTagColor } from '../types';
import TaskCard from './TaskCard';
import { formatRecurrenceDisplay, getDateDisplay } from '../utils/dateUtils';

interface RecurringTaskGroupProps {
  tasks: Task[]; // All tasks in this recurrence group
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void; // For individual task deletion (shows dialog)
  onDeleteGroup?: (groupId: string) => void; // For group header deletion (deletes all incomplete)
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  hideActions?: boolean; // If true, hide edit and delete buttons
}

export default function RecurringTaskGroup({ 
  tasks, 
  tagColors, 
  onToggleComplete, 
  onEdit, 
  onDelete, 
  onDeleteGroup,
  onUpdateTask,
  hideActions = false
}: RecurringTaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tasks.length === 0) return null;

  // Sort tasks by due date (earliest first)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Get next incomplete task (earliest incomplete task)
  const nextIncompleteTask = sortedTasks.find(task => !task.completed);
  const nextDueDate = nextIncompleteTask?.dueDate || sortedTasks[0]?.dueDate;

  // Use the earliest incomplete task as representative for deletion, or earliest task if all are complete
  // This ensures "Delete All Future Occurrences" uses the earliest date in the group
  const representativeTask = nextIncompleteTask || sortedTasks[0] || tasks[0];
  const tagColor = representativeTask.tags.length > 0 
    ? getTagColor(representativeTask.tags[0], tagColors)
    : getTagColor('default', tagColors);

  // Count incomplete tasks
  const incompleteCount = tasks.filter(task => !task.completed).length;
  const totalCount = tasks.length;

  // Get recurrence info
  const recurrenceDisplay = formatRecurrenceDisplay(
    representativeTask.recurrence!,
    representativeTask.recurrenceMultiplier,
    representativeTask.customFrequency
  );

  return (
    <div className="recurring-task-group" style={{ marginBottom: '0.5rem' }}>
      <div 
        className="recurring-task-group-header"
        style={{
          background: '#1A1A1A',
          border: `1px solid ${tagColor}40`,
          borderLeft: `4px solid ${tagColor}`,
          borderRadius: '8px',
          padding: '1rem',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#222';
          e.currentTarget.style.borderColor = `${tagColor}60`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#1A1A1A';
          e.currentTarget.style.borderColor = `${tagColor}40`;
        }}
      >
        <span style={{ fontSize: '1rem', color: tagColor }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            marginBottom: '0.25rem'
          }}>
            <span style={{ fontWeight: 600, color: '#E0E0E0' }}>
              {representativeTask.title}
            </span>
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#888',
              background: 'rgba(64, 224, 208, 0.1)',
              padding: '0.125rem 0.375rem',
              borderRadius: '4px',
              border: '1px solid rgba(64, 224, 208, 0.3)'
            }}>
              🔁 {recurrenceDisplay}
            </span>
          </div>
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            {nextDueDate && (
              <span>
                Next: <span style={{ color: nextIncompleteTask ? '#40E0D0' : '#888' }}>
                  {getDateDisplay(nextDueDate)}
                </span>
              </span>
            )}
            <span>
              {hideActions 
                ? `${incompleteCount} remaining`
                : `${incompleteCount} of ${totalCount} incomplete`}
            </span>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          {!hideActions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(representativeTask);
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: '#888',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#40E0D0';
                e.currentTarget.style.color = '#40E0D0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = '#888';
              }}
              title="Edit recurring series"
            >
              Edit
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // If onDeleteGroup is provided, use it (for group header deletion)
              // Otherwise, fall back to onDelete (for individual task deletion)
              if (onDeleteGroup && representativeTask.recurrenceGroupId) {
                onDeleteGroup(representativeTask.recurrenceGroupId);
              } else {
                onDelete(representativeTask.id);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.25rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#FF6B6B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#888';
            }}
            title={onDeleteGroup ? "Delete all incomplete tasks in this group" : "Delete recurring series"}
          >
            🗑️
          </button>
        </div>
      </div>
      {isExpanded && (
        <div style={{ 
          marginTop: '0.5rem', 
          marginLeft: '1.5rem',
          paddingLeft: '1rem',
          borderLeft: `2px solid ${tagColor}40`
        }}>
          {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              tagColors={tagColors}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateTask={onUpdateTask}
              showDate={true}
              showTags={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

