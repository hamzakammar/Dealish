import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Use static property access so Expo's Babel plugin can inline these at build time
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Static-export / server context: Node loads this module to harvest exports and has no env vars wired.
// Fall back to placeholders so the module loads; actual API calls won't happen in that context.
const isServer = typeof window === 'undefined' && typeof global === 'object' && !global.navigator;

if (!isServer) {
    const missing: string[] = [];
    if (!url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!anon) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    if (missing.length) {
        throw new Error(
            `Supabase client cannot initialize: missing env var(s) ${missing.join(', ')}. ` +
            `Set these in your .env.local (dev) or EAS build environment (prod).`
        );
    }
}

const supabaseUrl = url || 'https://placeholder.supabase.co';
const supabaseAnonKey = anon || 'placeholder-key';

export const AUTH_REDIRECT_PATH = 'auth/callback';
export const getAuthRedirectUrl = () => {
  // Prevent this from running during static export
  if (typeof window === 'undefined' && typeof global === 'object' && !global.navigator) {
    // We're in a Node.js/server environment (static export)
    throw new Error('Cannot generate auth redirect URL in server environment');
  }
  // Use the app scheme directly for consistent deep linking across dev/prod.
  // Linking.createURL() would generate exp://172.x.x.x:8081/--/auth/callback in dev
  // which breaks email confirmation links sent to users. Using the scheme directly
  // ensures the link always works regardless of dev/prod environment.
  return 'dealish://auth/callback';
};

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