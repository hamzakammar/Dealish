import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Check if we're in Expo Go (where notifications don't work)
function isExpoGo(): boolean {
  try {
    // Expo Go has Constants.executionEnvironment === 'storeClient'
    return Constants.executionEnvironment === 'storeClient';
  } catch (e) {
    return false;
  }
}

// Lazy load Notifications to avoid errors in Expo Go
function getNotifications() {
  // Don't even try to load in Expo Go
  if (isExpoGo()) {
    return null;
  }
  
  try {
    const Notifications = require('expo-notifications');
    // Try to access a property to see if it actually works
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      return Notifications;
    }
    return null;
  } catch (e: unknown) {
    // Check if it's the specific Expo Go error
    const message = e instanceof Error ? e.message : '';
    if (message.includes('removed from Expo Go') || message.includes('SDK 53')) {
      return null;
    }
    // For other errors, still return null
    return null;
  }
}

// Configure notification handler - only if Notifications is available
// Do this lazily to avoid errors in Expo Go
let notificationHandlerConfigured = false;
function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  
  const Notifications = getNotifications();
  if (Notifications) {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationHandlerConfigured = true;
    } catch (e) {
      // Silently fail - notifications not available in Expo Go
    }
  }
}

export function usePushNotifications() {
  const { profile, isLoggedIn } = useAuthContext();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notification, setNotification] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastNotificationResponse, setLastNotificationResponse] = useState<Record<string, any> | null>(null);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    // Lazy load and configure notifications
    const NotificationsModule = getNotifications();
    if (!NotificationsModule) {
      return;
    }

    // Configure handler on first use
    configureNotificationHandler();

    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Save token to database if user is logged in
        if (isLoggedIn && profile?.id) {
          savePushToken(profile.id, token);
        }
      }
    });

    // Listen for notifications received while app is foregrounded
    try {
      notificationListener.current = NotificationsModule.addNotificationReceivedListener((notification: Record<string, unknown>) => {
        setNotification(notification);
      });

      // Listen for notification taps (when app is in background/closed)
      responseListener.current = NotificationsModule.addNotificationResponseReceivedListener((response: Record<string, unknown>) => {
        if (__DEV__) {
          console.log('Notification tapped:', response);
        }
        setLastNotificationResponse(response);
      });
    } catch (e) {
      // Silently fail - notifications not available in Expo Go
    }

    return () => {
      try {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [isLoggedIn, profile?.id]);

  // Update push token when user logs in or profile changes
  useEffect(() => {
    if (isLoggedIn && profile?.id && expoPushToken) {
      savePushToken(profile.id, expoPushToken);
    }
  }, [isLoggedIn, profile?.id, expoPushToken]);

  return {
    expoPushToken,
    notification,
    lastNotificationResponse,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) {
    return null;
  }

  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FE902A',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        
        // If permission was denied, show guidance (but don't block - notifications are optional)
        if (status !== 'granted') {
          try {
            const { getPermissionInfo } = require('@/utils/permissions');
            const info = getPermissionInfo('notifications');
            console.warn(`Notification permission ${status}. ${info.settingsDescription}`);
          } catch (e) {
            console.warn(`Notification permission ${status}`);
          }
        }
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return null;
      }

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          console.warn('Project ID not found. Push notifications may not work.');
          return null;
        }

        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
      } catch (e) {
        console.error('Error getting push token:', e);
        return null;
      }
    } else {
      console.warn('Must use physical device for Push Notifications');
    }
  } catch (e) {
    console.error('Error in registerForPushNotificationsAsync:', e);
    return null;
  }

  return token;
}

async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    // Write to legacy column for backwards compat
    await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Write to multi-device table
    await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: token,
        device_name: Device.modelName || undefined,
        device_type: Platform.OS,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,push_token' });
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}
