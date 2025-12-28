import { useEffect } from 'react';

interface UndoNotificationProps {
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoNotification({ taskTitle, onUndo, onDismiss }: UndoNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000); // Auto-dismiss after 3 seconds

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="undo-notification">
      <div className="undo-notification-content">
        <span className="undo-notification-text">
          Task "{taskTitle}" deleted
        </span>
        <div className="undo-notification-actions">
          <button className="btn btn-primary btn-small" onClick={onUndo}>
            Undo
          </button>
          <button className="btn btn-secondary btn-small" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
