import { getDateDisplay } from '../utils/dateUtils';

interface DeleteRecurringDialogProps {
  taskTitle: string;
  taskDueDate: string | null;
  onDeleteFuture: () => void;
  onDeleteOpen: () => void;
  onCancel: () => void;
}

export default function DeleteRecurringDialog({ 
  taskTitle,
  taskDueDate,
  onDeleteFuture, 
  onDeleteOpen, 
  onCancel 
}: DeleteRecurringDialogProps) {
  return (
    <div 
      className="modal-overlay" 
      onClick={onCancel}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div className="modal-header">
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: 600,
            background: 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Delete Recurring Task
          </h2>
          <button 
            className="modal-close" 
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem', color: '#E0E0E0' }}>
          <p style={{ marginBottom: '1rem' }}>
            How would you like to delete <strong style={{ color: '#40E0D0' }}>{taskTitle}</strong>
            {taskDueDate && (
              <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#888', marginLeft: '0.5rem' }}>
                (due {getDateDisplay(taskDueDate)})
              </span>
            )}?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={onDeleteFuture}
            style={{
              padding: '1rem',
              background: 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#0A0A0A',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Delete All Future Occurrences</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {taskDueDate 
                ? `Deletes all tasks from ${getDateDisplay(taskDueDate)} onwards. Past tasks remain.`
                : 'Deletes all tasks from the selected task\'s due date onwards. Past tasks remain.'}
            </div>
          </button>

          <button
            onClick={onDeleteOpen}
            style={{
              padding: '1rem',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '2px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '8px',
              color: '#FF6B6B',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.5)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 107, 107, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Delete All Open Occurrences</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              Deletes all incomplete tasks (past, present, and future). Completed tasks remain.
            </div>
          </button>

          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#888',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#E0E0E0';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#888';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

