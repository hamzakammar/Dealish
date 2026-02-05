import { useAuthContext } from '@/app/providers/auth';
import { useProfileSetup } from '@/hooks/useProfileSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { session, isLoading, profile } = useAuthContext();
  const { needsSetup, loading: profileLoading } = useProfileSetup();
  const router = useRouter();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

  // Check if user has seen welcome screen
  useEffect(() => {
    checkWelcomeStatus();
  }, []);

  const checkWelcomeStatus = async () => {
    const seen = await AsyncStorage.getItem('hasSeenWelcome');
    setHasSeenWelcome(seen === 'true');
  };

  // Use useEffect for navigation to avoid mounting/unmounting issues with Redirect
  useEffect(() => {
    // Always declare timeoutId at the top for consistent hook structure
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    // Wait until all loading is complete before redirecting
    if (!isLoading && !profileLoading && hasSeenWelcome !== null) {
      // Use requestAnimationFrame to ensure redirect happens after render completes
      timeoutId = setTimeout(() => {
        if (isMounted) {
          try {
            // First time user - show welcome screen
            if (!hasSeenWelcome) {
              router.replace('/welcome');
              return;
            }

            if (session) {
              // Check if user is admin or owner - redirect to admin dashboard
              if (profile?.role === 'owner' || profile?.role === 'admin') {
                router.replace('/admin');
              }
              // Check if profile needs setup
              else if (needsSetup) {
                router.replace('/onboarding');
              } else {
                router.replace('/map');
              }
            } else {
              router.replace('/auth');
            }
          } catch (error) {
            console.error('Navigation error:', error);
            // Fallback to auth screen
            try {
              router.replace('/auth');
            } catch (fallbackError) {
              console.error('Fallback navigation failed:', fallbackError);
            }
          }
        }
      }, 0);
    }

    // ALWAYS return cleanup function for consistent hook structure
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [session, isLoading, profileLoading, needsSetup, profile, router, hasSeenWelcome]);

  // Show loading while checking auth or during redirect
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FE902A" />
    </View>
  );
}