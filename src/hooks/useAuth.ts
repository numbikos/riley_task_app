import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const AUTH_CHECK_TIMEOUT_MS = 3000;
const SAFETY_TIMEOUT_MS = 5000;

/**
 * Custom hook for managing authentication state
 */
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId: number | null = null;
    let safetyTimeoutId: number | null = null;
    let isMounted = true;
    
    // Safety net: Always set loading to false after 5 seconds maximum
    safetyTimeoutId = window.setTimeout(() => {
      logger.error('[useAuth] SAFETY NET: Forcing loading to false after 5 seconds');
      if (isMounted) {
        setLoading(false);
      }
    }, SAFETY_TIMEOUT_MS);
    
    const checkUser = async () => {
      // If Supabase is not configured, skip auth check
      if (!isSupabaseConfigured()) {
        logger.warn('[useAuth] Supabase not configured - skipping auth check');
        if (safetyTimeoutId) {
          clearTimeout(safetyTimeoutId);
          safetyTimeoutId = null;
        }
        if (isMounted) {
          setLoading(false);
          setUser(null);
        }
        return;
      }

      try {
        // Set a timeout to prevent infinite loading
        timeoutId = window.setTimeout(() => {
          logger.warn('[useAuth] Auth check timeout after 3 seconds - forcing loading to false');
          if (isMounted) {
            setLoading(false);
            setUser(null);
          }
        }, AUTH_CHECK_TIMEOUT_MS);

        // Use Promise.race to ensure we don't hang forever
        const authPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Auth check timeout')), AUTH_CHECK_TIMEOUT_MS);
        });

        const { data: { user }, error } = await Promise.race([
          authPromise,
          timeoutPromise
        ]).catch((err) => {
          logger.error('[useAuth] Auth check failed:', err);
          return { data: { user: null }, error: err };
        }) as { data: { user: User | null }, error: any };
        
        // Clear timeouts if we got a response
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (safetyTimeoutId) {
          clearTimeout(safetyTimeoutId);
          safetyTimeoutId = null;
        }
        
        if (!isMounted) return;
        
        if (error) {
          logger.error('[useAuth] Error checking user:', error);
          setUser(null);
          setLoading(false);
          return;
        }
        
        setUser(user);
        setLoading(false);
      } catch (error) {
        logger.error('[useAuth] Exception checking user:', error);
        // Clear timeouts on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (safetyTimeoutId) {
          clearTimeout(safetyTimeoutId);
          safetyTimeoutId = null;
        }
        // Always set loading to false, even on error
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (safetyTimeoutId) {
        clearTimeout(safetyTimeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('[useAuth] Failed to sign out:', error);
      throw error;
    }
  };

  return {
    user,
    loading,
    signOut,
  };
};

