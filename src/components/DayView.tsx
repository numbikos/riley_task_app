import { useMemo } from 'react';
import { Task } from '../types';
import TaskCard from './TaskCard';
import { startOfDay } from 'date-fns';
import { formatFullDate } from '../utils/dateUtils';

interface DayViewProps {
  tasks: Task[];
  date: Date;
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onBackToWeek?: () => void;
  onNavigateDate?: (date: Date) => void;
  onAddTask?: (date: Date) => void;
}

export default function DayView({ tasks, date, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask, onBackToWeek, onNavigateDate, onAddTask }: DayViewProps) {
  const fullDateDisplay = formatFullDate(date);

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

  // Sort tasks by tag: untagged last, others alphabetically
  // This will automatically re-run whenever tasks change (e.g., after drag and drop)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const tagA = a.tags.length > 0 ? a.tags[0].toLowerCase() : 'untagged';
      const tagB = b.tags.length > 0 ? b.tags[0].toLowerCase() : 'untagged';
      
      if (tagA === 'untagged' && tagB !== 'untagged') return 1;
      if (tagB === 'untagged' && tagA !== 'untagged') return -1;
      return tagA.localeCompare(tagB);
    });
  }, [tasks]);

  return (
    <div>
      {onBackToWeek && (
        <div className="day-back-button-container" style={{ marginBottom: '1rem' }}>
          <button
            onClick={onBackToWeek}
            className="day-back-button"
            style={{
              background: 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#0A0A0A',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              width: '100%',
              boxShadow: '0 4px 16px rgba(0, 128, 255, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #1080FF 0%, #50F0E0 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 128, 255, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 128, 255, 0.4)';
            }}
          >
            ← Back to Week
          </button>
        </div>
      )}
      {onNavigateDate && (
        <div className="day-nav-header">
          <div className="day-nav">
            <button className="day-nav-btn" onClick={goToPreviousDay}>← Previous</button>
            <h2 className="day-nav-title">{fullDateDisplay}</h2>
            <button className="day-nav-btn" onClick={goToNextDay}>Next →</button>
          </div>
        </div>
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
          {sortedTasks.map(task => (
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
}

