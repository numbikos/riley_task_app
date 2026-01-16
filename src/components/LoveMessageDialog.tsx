import { Heart } from 'lucide-react';

interface LoveMessageDialogProps {
  message: string;
  onDismiss: () => void;
}

export default function LoveMessageDialog({ message, onDismiss }: LoveMessageDialogProps) {
  return (
    <div
      className="modal-overlay"
      onClick={onDismiss}
    >
      <div
        className="modal-content love-message-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '400px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-bright)',
          textAlign: 'center',
          padding: '2rem'
        }}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <Heart
            size={48}
            fill="#f472b6"
            color="#f472b6"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(244, 114, 182, 0.5))',
              animation: 'heartPulse 1.5s ease-in-out infinite'
            }}
          />
        </div>

        <p style={{
          fontSize: '1.5rem',
          fontWeight: 500,
          color: 'var(--text-main)',
          lineHeight: 1.4,
          margin: '0 0 2rem 0'
        }}>
          {message}
        </p>

        <button
          onClick={onDismiss}
          aria-label="Dismiss love message"
          style={{
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(236, 72, 153, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
          }}
        >
          <Heart size={24} fill="white" color="white" />
        </button>
      </div>
    </div>
  );
}
