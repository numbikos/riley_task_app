import { useState, FormEvent } from 'react';
import { supabase } from '../utils/supabase';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage('Check your email for the confirmation link!');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          onAuthSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A0A0A 0%, #121212 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #121212 0%, #1A1A1A 100%)',
        border: '1px solid rgba(64, 224, 208, 0.3)',
        borderRadius: '16px',
        padding: '2.5rem',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      }}>
        <h1 style={{
          fontSize: '2rem',
          marginBottom: '0.5rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center',
        }}>
          💩 Poop Task
        </h1>
        <p style={{
          textAlign: 'center',
          color: '#888',
          marginBottom: '2rem',
          fontSize: '0.9rem',
        }}>
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#E0E0E0',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0A0A0A',
                border: '1px solid rgba(64, 224, 208, 0.2)',
                borderRadius: '8px',
                color: '#E0E0E0',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(64, 224, 208, 0.5)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(64, 224, 208, 0.2)';
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: '#E0E0E0',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0A0A0A',
                border: '1px solid rgba(64, 224, 208, 0.2)',
                borderRadius: '8px',
                color: '#E0E0E0',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(64, 224, 208, 0.5)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(64, 224, 208, 0.2)';
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: '8px',
              color: '#FF6B6B',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(64, 224, 208, 0.1)',
              border: '1px solid rgba(64, 224, 208, 0.3)',
              borderRadius: '8px',
              color: '#40E0D0',
              marginBottom: '1rem',
              fontSize: '0.9rem',
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading
                ? 'rgba(64, 224, 208, 0.3)'
                : 'linear-gradient(135deg, #0080FF 0%, #40E0D0 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '1rem',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
}

