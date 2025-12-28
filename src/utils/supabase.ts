import { createClient } from '@supabase/supabase-js';

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
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('[clearAuthCache] Error clearing cache:', error);
  }
};

