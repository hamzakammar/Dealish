import { useAuthContext } from '@/app/providers/auth';
import { supabase } from '@/app/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuthContext();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check if this is a password recovery callback
        const isRecovery = params.type === 'recovery';
        if (isRecovery) {
          router.replace('/reset-password?type=recovery');
          return;
        }

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          router.replace(refreshedSession ? '/map' : '/auth');
        } else if (currentSession) {
          router.replace('/');
        } else {
          router.replace('/auth');
        }
      } catch (error) {
        router.replace('/auth');
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [router, params]);

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
