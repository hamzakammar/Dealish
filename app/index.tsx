import { useAuthContext } from '@/app/providers/auth';
import { useProfileSetup } from '@/hooks/useProfileSetup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  // ALL hooks MUST be called unconditionally at the top level
  const { session, isLoading, profile } = useAuthContext();
  const { needsSetup, loading: profileLoading } = useProfileSetup();
  const router = useRouter();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasNavigatedRef = useRef(false);

  // Initialize: Check session FIRST, then welcome screen status
  // This prevents race conditions where hasSeenWelcome resolves before session
  useEffect(() => {
    let isActive = true;

    async function initialize() {
      // CRITICAL: Wait for BOTH session AND welcome check to complete
      // Don't make navigation decisions until both are ready
      // This prevents race conditions where AsyncStorage (fast) beats Supabase (slow)
      
      // Wait for session check to complete (network operation, 300-500ms)
      if (isLoading) {
        return; // Still loading session - wait
      }

      // Wait for welcome check to complete (AsyncStorage, 50-100ms)
      // Even though it's faster, we need to wait for it to avoid race conditions
      if (hasSeenWelcome === null) {
        return; // Still loading welcome status - wait
      }

      // BOTH checks are complete - now make navigation decision
      // Session check takes priority over welcome check
      if (session) {
        // Validate token freshness before trusting session
        // Supabase sessions have expires_at in seconds (Unix timestamp)
        const isTokenValid = session.expires_at && 
                            session.expires_at > Date.now() / 1000;
        
        // If token is expired, treat as no session (Supabase should refresh, but be safe)
        if (!isTokenValid) {
          // Token expired - treat as not authenticated
          // hasSeenWelcome is already checked above (both checks complete)
          if (hasNavigatedRef.current) return;
          hasNavigatedRef.current = true;
          router.replace(hasSeenWelcome ? '/auth' : '/welcome');
          setIsInitializing(false);
          return;
        }

        // Valid session with valid token - user is authenticated
        // Skip welcome screen check entirely for authenticated users
        // Session check wins - authenticated users never see welcome screen
        if (hasNavigatedRef.current) return;
        hasNavigatedRef.current = true;

        try {
          // Check if user is admin or owner - redirect to admin dashboard
          if (profile?.role === 'owner' || profile?.role === 'admin') {
            router.replace('/admin');
            setIsInitializing(false);
            return;
          }
          // Check if profile needs setup
          if (needsSetup && !profileLoading) {
            router.replace('/onboarding');
            setIsInitializing(false);
            return;
          }
          // If profile is still loading but we have a session, go to map anyway
          // Profile will load in background
          router.replace('/map');
          setIsInitializing(false);
        } catch (error) {
          if (__DEV__) {
            console.error('Navigation error:', error);
          }
          router.replace('/map');
          setIsInitializing(false);
        }
        return;
      }

      // No session - user is not authenticated
      // Both checks are already complete (checked at top of function)
      // Make navigation decision based on welcome screen status
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      try {
        // Not logged in - check if they've seen welcome screen
        if (!hasSeenWelcome) {
          router.replace('/welcome');
        } else {
          router.replace('/auth');
        }
        setIsInitializing(false);
      } catch (error) {
        if (__DEV__) {
          console.error('Navigation error:', error);
        }
        router.replace('/auth');
        setIsInitializing(false);
      }
    }

    initialize();

    return () => {
      isActive = false;
    };
  }, [session, isLoading, profileLoading, needsSetup, profile, router, hasSeenWelcome]);

  // Check if user has seen welcome screen (only needed for non-authenticated users)
  // This runs in parallel but navigation logic waits for session check first
  useEffect(() => {
    AsyncStorage.getItem('hasSeenWelcome').then((seen) => {
      setHasSeenWelcome(seen === 'true');
    }).catch(() => {
      // Default to showing welcome if storage fails
      setHasSeenWelcome(false);
    });
  }, []);

  // Show loading while initializing or during redirect
  if (isInitializing || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  // Fallback loading state
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FE902A" />
    </View>
  );
}