import { useAuthContext } from '@/app/providers/auth';
import { useProfileSetup } from '@/hooks/useProfileSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { session, isLoading, profile } = useAuthContext();
  const { needsSetup, loading: profileLoading } = useProfileSetup();
  const router = useRouter();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const hasNavigatedRef = useRef(false);

  // Check if user has seen welcome screen immediately (parallel with auth check)
  useEffect(() => {
    AsyncStorage.getItem('hasSeenWelcome').then((seen) => {
      setHasSeenWelcome(seen === 'true');
    }).catch(() => {
      // Default to showing welcome if storage fails
      setHasSeenWelcome(false);
    });
  }, []);

  // Only show welcome screen if user hasn't seen it AND is not logged in
  // If user is logged in, skip welcome screen

  // Use useEffect for navigation to avoid mounting/unmounting issues with Redirect
  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigatedRef.current) return;
    
    // Wait until critical loading is complete before redirecting
    // Don't wait for profileLoading if we don't have a session (faster for logged-out users)
    const canNavigate = !isLoading && hasSeenWelcome !== null && (!session || !profileLoading);
    
    if (canNavigate) {
      hasNavigatedRef.current = true;
      try {
        if (session) {
          // If user is logged in, skip welcome screen
          // Check if user is admin or owner - redirect to admin dashboard
          if (profile?.role === 'owner' || profile?.role === 'admin') {
            router.replace('/admin');
            return;
          }
          // Check if profile needs setup (don't wait for profileLoading to complete)
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
  }, [session, isLoading, profileLoading, needsSetup, profile, router, hasSeenWelcome]);

  // Show loading while checking auth or during redirect
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FE902A" />
    </View>
  );
}