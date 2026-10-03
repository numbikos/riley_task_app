import { useEffect, useRef } from 'react';
import { UNDO_TIMEOUT_MS } from '../hooks/useTaskManagement';

interface CompletionUndoNotificationProps {
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function CompletionUndoNotification({ taskTitle, onUndo, onDismiss }: CompletionUndoNotificationProps) {
  // Parent passes a new onDismiss each render; keep the latest in a ref so re-renders
  // don't restart the auto-dismiss timer
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, UNDO_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

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

