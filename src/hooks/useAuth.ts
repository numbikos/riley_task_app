import { useState, useEffect } from 'react';
import { apiRequest, subscribeAuth, signOut } from '../utils/api';
import type { User } from '../types';
import { logger } from '../utils/logger';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const unsubscribe = subscribeAuth(next => {
      if (active) { setUser(previous => previous?.id === next?.id ? previous : next); setLoading(false); }
    });
    apiRequest<{ user: User | null }>('/auth/session', { signal: controller.signal })
      .then(result => { if (active && !controller.signal.aborted) setUser(result.user); })
      .catch(error => logger.error('[useAuth] Could not check session:', error))
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); unsubscribe(); };
  }, []);
  return { user, loading, signOut };
};
