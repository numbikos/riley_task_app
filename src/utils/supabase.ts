import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if env vars are missing to prevent crash
// The app will show an error in the UI instead
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Clear stale sessions on initialization
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Export a function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Helper function to clear auth cache if needed
export const clearAuthCache = async () => {
  try {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      // Clear any cached auth data
      // Supabase stores auth data with specific key patterns:
      // - sb-<project-ref>-auth-token (access/refresh tokens)
      // - supabase.auth.token (legacy)
      const keys = Object.keys(localStorage);
      const supabaseAuthKeyPattern = /^sb-[a-z0-9]+-auth-token$/;

      keys.forEach(key => {
        // Match exact Supabase auth key patterns only
        if (
          supabaseAuthKeyPattern.test(key) ||
          key === 'supabase.auth.token' ||
          key.startsWith(`sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-`)
        ) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    logger.error('[clearAuthCache] Error clearing cache:', error);
  }
};

