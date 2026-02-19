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

  // Only show welcome screen if user hasn't seen it AND is not logged in
  // If user is logged in, skip welcome screen

  // Use useEffect for navigation to avoid mounting/unmounting issues with Redirect
  useEffect(() => {
    // Always declare timeoutId at the top for consistent hook structure
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    // Wait until all loading is complete before redirecting
    if (!isLoading && !profileLoading && hasSeenWelcome !== null) {
      // Immediate redirect for better performance
      if (isMounted) {
        try {
          if (session) {
            // If user is logged in, skip welcome screen
            // Only show welcome screen for first-time users who aren't logged in
            // Check if user is admin or owner - redirect to admin dashboard
            if (profile?.role === 'owner' || profile?.role === 'admin') {
              router.replace('/admin');
              return;
            }
            // Check if profile needs setup
            if (needsSetup) {
              router.replace('/onboarding');
              return;
            }
            router.replace('/map');
          } else {
            // Not logged in - check if they've seen welcome screen
            if (!hasSeenWelcome) {
              router.replace('/welcome');
            } else {
              router.replace('/auth');
            }
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