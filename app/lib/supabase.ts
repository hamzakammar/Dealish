import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

// Use static property access so Expo's Babel plugin can inline these at build time
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL');
}
if (!anon) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

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

export const supabase = createClient(url, anon, {
    auth: {
        storage: isServer ? undefined : AsyncStorage, // Don't use AsyncStorage during static export
        persistSession: !isServer, // Don't persist sessions during static export
        autoRefreshToken: !isServer, // Don't auto-refresh during static export
        detectSessionInUrl: !isServer, // Don't detect session in URL during static export (avoids htmlRoutes error)
    }
});