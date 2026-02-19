import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

// Use static property access so Expo's Babel plugin can inline these at build time
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Log warnings instead of throwing to prevent app crashes
// Environment variables should be set in EAS build configuration
if (!url) {
    console.error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL');
    console.error('Please set EXPO_PUBLIC_SUPABASE_URL in your EAS build environment variables');
}
if (!anon) {
    console.error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY');
    console.error('Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in your EAS build environment variables');
}

// Use fallback values to prevent crashes (app will still fail but won't crash immediately)
// This allows error boundaries to catch the issue
const supabaseUrl = url || 'https://placeholder.supabase.co';
const supabaseAnonKey = anon || 'placeholder-key';

export const AUTH_REDIRECT_PATH = 'auth/callback';
export const getAuthRedirectUrl = () => {
  // Prevent this from running during static export
  if (typeof window === 'undefined' && typeof global === 'object' && !global.navigator) {
    // We're in a Node.js/server environment (static export)
    throw new Error('Cannot generate auth redirect URL in server environment');
  }
  return Linking.createURL(AUTH_REDIRECT_PATH);
};

// Determine if we're in a static export/server environment
const isServer = typeof window === 'undefined' && typeof global === 'object' && !global.navigator;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: isServer ? undefined : AsyncStorage, // Don't use AsyncStorage during static export
        persistSession: !isServer, // Don't persist sessions during static export
        autoRefreshToken: !isServer, // Auto-refresh tokens to keep session alive
        detectSessionInUrl: !isServer, // Don't detect session in URL during static export (avoids htmlRoutes error)
        // Session persistence:
        // - Access tokens expire after 1 hour (default)
        // - Refresh tokens expire after 2 weeks (default) 
        // - autoRefreshToken will automatically refresh access tokens using refresh tokens
        // - Sessions persist in AsyncStorage and will be restored on app restart
        // - If refresh token expires (after 2 weeks of inactivity), user will need to sign in again
        storageKey: 'dealish-auth-token', // Custom storage key for better isolation
    }
});