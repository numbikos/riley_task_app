import { useEffect, useState } from 'react';

interface UndoNotificationProps {
  taskTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoNotification({ taskTitle, onUndo, onDismiss }: UndoNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
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
      <div className="undo-notification-timer" style={{ width: `${(timeLeft / 5) * 100}%` }} />
    </div>
  );
}
