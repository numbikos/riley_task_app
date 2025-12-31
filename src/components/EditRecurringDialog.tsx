import { getDateDisplay } from '../utils/dateUtils';
import { RecurrenceType } from '../types';

interface EditRecurringDialogProps {
  taskTitle: string;
  taskDueDate: string | null;
  oldRecurrence: RecurrenceType;
  newRecurrence: RecurrenceType;
  onThisAndFollowing: () => void;
  onAll: () => void;
  onCancel: () => void;
}

const getRecurrenceLabel = (recurrence: RecurrenceType): string => {
  switch (recurrence) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Annually';
    case 'custom': return 'Custom';
    default: return 'None';
  }
};

export default function EditRecurringDialog({ 
  taskTitle,
  taskDueDate,
  oldRecurrence,
  newRecurrence,
  onThisAndFollowing, 
  onAll, 
  onCancel 
}: EditRecurringDialogProps) {
  return (
    <div 
      className="modal-overlay" 
      onClick={onCancel}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '500px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-bright)'
        }}
      >
        <div className="modal-header">
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: 600,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Change Recurrence
          </h2>
          <button 
            className="modal-close" 
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            Change <strong style={{ color: 'var(--primary-hover)' }}>{taskTitle}</strong> from{' '}
            <strong style={{ color: 'var(--danger)' }}>{getRecurrenceLabel(oldRecurrence)}</strong> to{' '}
            <strong style={{ color: 'var(--success)' }}>{getRecurrenceLabel(newRecurrence)}</strong>
          </p>
          {taskDueDate && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              Starting from {getDateDisplay(taskDueDate)}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={onThisAndFollowing}
            style={{
              padding: '1rem',
              background: 'var(--gradient-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              textAlign: 'left',
              boxShadow: 'var(--shadow-md)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>This and Following Tasks</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {taskDueDate 
                ? `Changes frequency from ${getDateDisplay(taskDueDate)} onwards. Past completed tasks keep the old frequency.`
                : 'Changes frequency from this task onwards. Past completed tasks keep the old frequency.'}
            </div>
          </button>

          <button
            onClick={onAll}
            style={{
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
              e.currentTarget.style.borderColor = 'var(--success)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>All Tasks</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              Regenerates the entire series with the new frequency, starting from the first task's date.
            </div>
          </button>

          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-main)';
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

