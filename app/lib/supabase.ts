import { createClient } from '@supabase/supabase-js';

function getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
const url = getRequiredEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const anon = getRequiredEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(url, anon, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    }
});
