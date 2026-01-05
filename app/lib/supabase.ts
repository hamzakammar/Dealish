import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use static property access so Expo's Babel plugin can inline these at build time
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL');
}
if (!anon) {
    throw new Error('Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const redirectUrl = Linking.createURL('/');

export const supabase = createClient(url, anon, {
    auth: {
        storage: AsyncStorage, // ← This is the key part for React Native!
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    }
});
