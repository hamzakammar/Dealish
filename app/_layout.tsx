import { supabase } from '@/app/lib/supabase';
import AuthProvider from '@/app/providers/auth';
import { setRecoveryFlow, initRecoveryState } from '@/app/lib/recoveryState';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppErrorBoundary from '@/components/ErrorBoundary';
import { useColorScheme } from '@/components/useColorScheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserSettings } from '@/hooks/useUserSettings';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enableAutoSessionTracking: true,
    // Only send events in production builds; dev errors surface in the console.
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
  });
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [isReady, setIsReady] = useState(false);

  // Initialize auth session and recovery state on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await supabase.auth.getSession();
        await initRecoveryState();
      } catch (err) {
        console.error('Error initializing app:', err);
      } finally {
        setIsReady(true);
      }
    };
    initialize();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Don't hide native splash here — index.tsx will hide it once
      // its own JS splash is mounted, preventing the double-splash overlap.
    }
  }, [loaded]);

  // Wait for both fonts and initialization to complete
  if (!loaded || !isReady) {
    return null;
  }

  return <RootLayoutNav />;
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;

function RootLayoutNav() {
  const systemColorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    // Always declare subscription at the top for consistent hook structure
    let subscription: { remove: () => void } | null = null;

    // Handle OAuth callbacks
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      
      // Check if this is an auth callback
      if (url.includes('auth/callback') || url.includes('#access_token=') || url.includes('?code=') || url.includes('access_token=')) {
        try {
          const urlObj = new URL(url);
          const hash = urlObj.hash.substring(1);
          const params = new URLSearchParams(hash || urlObj.search);
          
          const accessToken = params.get('access_token');
          const type = params.get('type');

          // Route to reset-password screen if this is a recovery link
          if (type === 'recovery') {
            setRecoveryFlow(); // set BEFORE getSession so index.tsx won't redirect away
            await supabase.auth.getSession();
            await SplashScreen.hideAsync().catch(() => {});
            router.replace('/reset-password?type=recovery');
            return;
          }

          if (accessToken) {
            await new Promise(resolve => setTimeout(resolve, 200));
            await supabase.auth.getSession();
          } else {
            await supabase.auth.getSession();
          }
        } catch (error) {
          console.error('Error handling OAuth deep link:', error);
          try {
            await supabase.auth.getSession();
          } catch (sessionError) {
            console.error('Error getting session after deep link:', sessionError);
          }
        }
      }
    };

    // Initialize linking - must always execute to maintain hook consistency
    // Even if it fails, we still need the cleanup function structure to be consistent
    const initializeLinking = () => {
      try {
        // Try to set up the event listener first
        subscription = Linking.addEventListener('url', handleDeepLink);
        
        // Then check for initial URL
        Linking.getInitialURL().then((url) => {
          if (url) {
            handleDeepLink({ url });
          }
        }).catch(() => {
          // Ignore errors
        });
      } catch (err) {
        // If addEventListener fails, subscription remains null
        // This is fine - the cleanup will handle it
        console.error('Error setting up deep linking:', err);
      }
    };

    // Initialize linking
    initializeLinking();

    // Absolute failsafe: if any startup path never calls hideAsync(), the native
    // splash can otherwise stay on screen (recovery early-return, etc.).
    const splashFailsafe = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);

    // ALWAYS return cleanup function - this is critical for hook consistency
    // React expects this cleanup function to exist on every render
    return () => {
      clearTimeout(splashFailsafe);
      if (subscription) {
        try {
          subscription.remove();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      subscription = null;
    };
  }, []);
  
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppErrorBoundary fallbackMessage="The app encountered an error. Tap retry to reload.">
        <ThemeWrapper>
          <NotificationHandler />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="permissions" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="qr-scanner" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="account" options={{ headerShown: false }} />
          <Stack.Screen name="about" options={{ headerShown: false }} />
          <Stack.Screen name="help" options={{ headerShown: false }} />
          <Stack.Screen name="partner" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="admin/deals" options={{ headerShown: false }} />
          <Stack.Screen name="admin/deal-form" options={{ headerShown: false }} />
          <Stack.Screen name="admin/restaurant" options={{ headerShown: false }} />
          <Stack.Screen name="admin/analytics" options={{ headerShown: false }} />
          <Stack.Screen name="admin/integrations" options={{ headerShown: false }} />
          <Stack.Screen name="admin/create-restaurant" options={{ headerShown: false }} />
          <Stack.Screen name="admin/inventory" options={{ headerShown: false }} />
          <Stack.Screen name="admin/inventory/alerts" options={{ headerShown: false }} />
          <Stack.Screen name="admin/partner-requests" options={{ headerShown: false }} />
        </Stack>
        </ThemeWrapper>
        </AppErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Component to handle theme inside AuthProvider
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { settings } = useUserSettings();
  
  // Determine theme based on user settings
  const colorScheme = React.useMemo(() => {
    if (!settings?.appearance?.theme) return systemColorScheme;
    if (settings.appearance.theme === 'auto') return systemColorScheme;
    return settings.appearance.theme;
  }, [settings?.appearance?.theme, systemColorScheme]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </ThemeProvider>
  );
}

// Component to handle push notifications inside AuthProvider context
function NotificationHandler() {
  const router = useRouter();
  
  // Initialize push notifications (now inside AuthProvider)
  const { notification, lastNotificationResponse } = usePushNotifications();

  // Handle notification taps (both foreground and background)
  useEffect(() => {
    try {
      const notificationData = lastNotificationResponse?.notification?.request?.content?.data || 
                             notification?.request?.content?.data;
      
      if (notificationData?.screen) {
        // Navigate to the screen specified in notification data
        router.push(notificationData.screen as any);
      }
    } catch (e) {
      // Ignore errors in notification handling
      console.warn('Error handling notification:', e);
    }
  }, [notification, lastNotificationResponse, router]);

  return null; // This component doesn't render anything
}
