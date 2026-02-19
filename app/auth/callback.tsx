import { useAuthContext } from '@/app/providers/auth';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session, profile, isLoading } = useAuthContext();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Wait a moment for Supabase to process the callback
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get the current session - Supabase should have processed the callback URL by now
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session in callback:', error);
          // Try to refresh the session
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          if (refreshedSession) {
            // Session refreshed successfully
            setTimeout(() => {
              router.replace('/map');
            }, 200);
          } else {
            // No valid session, redirect to auth
            router.replace('/auth');
          }
        } else if (currentSession) {
          // Session is set, redirect based on profile
          // Small delay to ensure profile is loaded
          setTimeout(() => {
            router.replace('/map');
          }, 200);
        } else {
          // No session, redirect to auth
          router.replace('/auth');
        }
      } catch (error) {
        console.error('Error processing auth callback:', error);
        router.replace('/auth');
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [router]);

  // Show loading screen while processing
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FE902A" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
