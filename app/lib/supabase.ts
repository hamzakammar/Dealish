import { createClient } from '@supabase/supabase-js';

// Use static property access so Expo's Babel plugin can inline these at build time
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL');
}
if (!anon) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anon, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    }
});
