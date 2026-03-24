import { useAuthContext } from '@/app/providers/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

export default function Index() {
  // ALL hooks MUST be called unconditionally at the top level
  const { session, isLoading, profile } = useAuthContext();
  const router = useRouter();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasNavigatedRef = useRef(false);
  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide native splash only right before we navigate — keeps native splash visible
  // the entire time we're initializing, no JS splash needed at all.
  // This eliminates the flicker between native splash and JS splash.

  // Safety net: if profile fetch hangs (network failure), unblock after 8s
  useEffect(() => {
    if (session && profile === null) {
      profileTimeoutRef.current = setTimeout(async () => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          await SplashScreen.hideAsync().catch(() => {});
          router.replace('/map');
        }
      }, 8000);
    }
    return () => {
      if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    };
  }, [session, profile]);

  // Initialize: Check session FIRST, then welcome/onboarding status
  useEffect(() => {
    async function initialize() {
      // Wait for session check to complete
      if (isLoading) return;

      // Wait for AsyncStorage checks to complete
      if (hasSeenWelcome === null || hasCompletedOnboarding === null) return;

      // If we have a session but profile hasn't loaded yet, wait for it
      // This prevents routing before we know the user's role
      if (session && profile === null) return;

      // Prevent duplicate navigation
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      // Hide native splash right before navigating — no JS splash needed
      await SplashScreen.hideAsync().catch(() => {});

      if (session) {
        // Validate token freshness
        const isTokenValid = session.expires_at && session.expires_at > Date.now() / 1000;
        
        if (!isTokenValid) {
          router.replace(hasSeenWelcome ? '/auth' : '/welcome');
          setIsInitializing(false);
          return;
        }

        // Valid session - check role and onboarding status
        try {
          if (profile?.role === 'owner' || profile?.role === 'admin') {
            router.replace('/admin');
          } else {
            // Always use profile.display_name as source of truth for onboarding
            // AsyncStorage flag is a fallback only — profile check is definitive
            const needsOnboarding = !profile?.display_name;
            if (needsOnboarding) {
              router.replace('/onboarding');
            } else {
              router.replace('/map');
            }
          }
        } catch (error) {
          if (__DEV__) console.error('Navigation error:', error);
          router.replace('/map');
        }
        setIsInitializing(false);
        return;
      }

      // No session - check welcome screen status
      try {
        router.replace(hasSeenWelcome ? '/auth' : '/welcome');
      } catch (error) {
        if (__DEV__) console.error('Navigation error:', error);
        router.replace('/auth');
      }
      setIsInitializing(false);
    }

    initialize();
  }, [session, isLoading, profile, router, hasSeenWelcome, hasCompletedOnboarding]);

  // Load AsyncStorage flags on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('hasSeenWelcome'),
      AsyncStorage.getItem('hasCompletedOnboarding'),
    ]).then(([seen, completed]) => {
      setHasSeenWelcome(seen === 'true');
      setHasCompletedOnboarding(completed === 'true');
    }).catch(() => {
      setHasSeenWelcome(false);
      setHasCompletedOnboarding(false);
    });
  }, []);

  // Native splash stays visible until hideAsync() fires right before navigation.
  // Return null — nothing to render here.
  return null;
}