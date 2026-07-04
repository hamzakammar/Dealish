import { supabase } from '@/app/lib/supabase';
import AuthProvider from '@/app/providers/auth';
import { initRecoveryState } from '@/app/lib/recoveryState';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useUserSettings } from '@/hooks/useUserSettings';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [isReady, setIsReady] = useState(false);

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

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded || !isReady) {
    return null;
  }

  return <RootLayoutNav />;
}

export default RootLayout;

function RootLayoutNav() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeWrapper>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="map" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="admin/deals" options={{ headerShown: false }} />
            <Stack.Screen name="admin/deal-form" options={{ headerShown: false }} />
            <Stack.Screen name="admin/restaurant" options={{ headerShown: false }} />
            <Stack.Screen name="admin/analytics" options={{ headerShown: false }} />
            <Stack.Screen name="admin/integrations" options={{ headerShown: false }} />
            <Stack.Screen name="admin/create-restaurant" options={{ headerShown: false }} />
            <Stack.Screen name="admin/inventory" options={{ headerShown: false }} />
            <Stack.Screen name="admin/partner-requests" options={{ headerShown: false }} />
          </Stack>
        </ThemeWrapper>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const { settings } = useUserSettings();

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
