import { useEffect } from 'react';
import { UNDO_TIMEOUT_MS } from '../hooks/useTaskManagement';

interface CompletionUndoNotificationProps {
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function CompletionUndoNotification({ taskTitle, onUndo, onDismiss }: CompletionUndoNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, UNDO_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="completion-undo-notification">
      <div className="completion-undo-notification-content">
        <span className="completion-undo-notification-text">
          Task "{taskTitle}" completed
        </span>
        <button className="btn btn-primary btn-small" onClick={onUndo}>
          Undo
        </button>
      </div>
    </div>
  );
}

