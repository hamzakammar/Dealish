import { useAuthContext } from '@/app/providers/auth';
import { isRecoveryFlow } from '@/app/lib/recoveryState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

export default function Index() {
  // ALL hooks MUST be called unconditionally at the top level
  const { session, isLoading, profile } = useAuthContext();
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const hasNavigatedRef = useRef(false);
  const hasSeenWelcomeRef = useRef<boolean | null>(null);
  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide native splash only right before we navigate — keeps native splash visible
  // the entire time we're initializing, no JS splash needed at all.
  // This eliminates the flicker between native splash and JS splash.

  // Safety net: if profile fetch hangs (network failure), unblock after 8s
  useEffect(() => {
    if (session && (profile === null || profile === undefined)) {
      profileTimeoutRef.current = setTimeout(async () => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          await SplashScreen.hideAsync().catch(() => {});
          routerRef.current.replace('/map');
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

      // While auth is still resolving session/profile, isLoading is true and we return above.
      // Do NOT block on `session && profile === null`: after a failed/missing profile fetch,
      // profile stays null and isLoading is false — the old check caused an infinite splash.

      // Prevent duplicate navigation
      if (hasNavigatedRef.current) return;

      // If this is a password recovery deep link, _layout.tsx owns navigation.
      // Must still hide the native splash, or it stays up forever (was the main "infinite" splash bug).
      if (isRecoveryFlow()) {
        await SplashScreen.hideAsync().catch(() => {});
        return;
      }

      hasNavigatedRef.current = true;

      // Hide native splash right before navigating — no JS splash needed
      await SplashScreen.hideAsync().catch(() => {});

      if (session) {
        // profile === undefined means the fetch hasn't started yet (initial state).
        // Wait for it — the 8s timeout in this file handles the case where it never resolves.
        if (profile === undefined) return;

        // Validate token freshness
        const isTokenValid = session.expires_at && session.expires_at > Date.now() / 1000;
        
        if (!isTokenValid) {
          // Expired session — drop to public map. Re-auth is offered from
          // the account panel; we never block browsing on auth.
          routerRef.current.replace(hasSeenWelcome ? '/map' : '/welcome');
          return;
        }

        // Valid session - check role and onboarding status
        try {
          if (profile?.role === 'owner' || profile?.role === 'admin') {
            routerRef.current.replace('/admin');
          } else {
            // profile is defined (not undefined/null) here.
            // If profile has a display_name → onboarding was done, go to map.
            // If profile has no display_name AND no AsyncStorage flag → needs onboarding.
            // If profile fetch failed (null) → default to map, never block on failed fetch.
            const profileHasName = Boolean(profile?.display_name?.trim());
            // Backfill AsyncStorage flag for existing users who have a name in DB
            // but never had the flag written (signed up before this code existed).
            if (profileHasName && !hasCompletedOnboarding) {
              AsyncStorage.setItem('hasCompletedOnboarding', 'true').catch(() => {});
            }
            const needsOnboarding = !profileHasName && !hasCompletedOnboarding && profile !== null;
            if (needsOnboarding) {
              routerRef.current.replace('/onboarding');
            } else {
              routerRef.current.replace('/map');
            }
          }
        } catch (error) {
          if (__DEV__) console.error('Navigation error:', error);
          routerRef.current.replace('/map');
        }
        return;
      }

      // No session - allow unauthenticated browsing per App Store
      // 5.1.1(v). First launch shows welcome carousel; afterwards land on map.
      // Sign-in is offered through the account panel and gated actions.
      try {
        routerRef.current.replace(hasSeenWelcome ? '/map' : '/welcome');
      } catch (error) {
        if (__DEV__) console.error('Navigation error:', error);
        routerRef.current.replace('/map');
      }
    }

    initialize();
  }, [session, isLoading, profile, hasSeenWelcome, hasCompletedOnboarding]);

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

  // Keep a ref for the one-shot max-wait so we use the real AsyncStorage value at fire time
  useEffect(() => {
    hasSeenWelcomeRef.current = hasSeenWelcome;
  }, [hasSeenWelcome]);

  // Last-resort: never leave the user on a permanent native splash.
  // Must run once on mount — a changing `router` reference would otherwise reset the timer forever.
  const STARTUP_MAX_MS = 15_000;
  useEffect(() => {
    const t = setTimeout(async () => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      await SplashScreen.hideAsync().catch(() => {});
      if (__DEV__) {
        console.warn('Startup took too long; routing to welcome/auth fallback');
      }
      const seen = hasSeenWelcomeRef.current;
      routerRef.current.replace(seen ? '/map' : '/welcome');
    }, STARTUP_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  // Native splash stays visible until hideAsync() fires right before navigation.
  // Return null — nothing to render here.
  return null;
}