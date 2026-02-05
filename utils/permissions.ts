import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

export type PermissionType = 'location' | 'camera' | 'notifications' | 'mediaLibrary';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'blocked';

export interface PermissionInfo {
  type: PermissionType;
  status: PermissionStatus;
  canAskAgain: boolean;
  title: string;
  description: string;
  settingsDescription: string;
}

/**
 * Opens device settings for the app
 */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
  } else {
    await Linking.openSettings();
  }
}

/**
 * Shows an alert guiding user to settings
 */
export function showSettingsAlert(
  title: string,
  message: string,
  onOpenSettings?: () => void
): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: async () => {
          if (onOpenSettings) {
            await onOpenSettings();
          } else {
            await openAppSettings();
          }
        },
      },
    ]
  );
}

/**
 * Check location permission status
 */
export async function checkLocationPermission(): Promise<PermissionStatus> {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  
  if (status === 'granted') return 'granted';
  if (status === 'denied' && !canAskAgain) return 'blocked';
  return status as PermissionStatus;
}

/**
 * Request location permission
 */
export async function requestLocationPermission(): Promise<PermissionStatus> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status as PermissionStatus;
}

/**
 * Check camera permission status
 */
export async function checkCameraPermission(): Promise<PermissionStatus> {
  try {
    const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
    if (status === 'denied' && !canAskAgain) return 'blocked';
    return status as PermissionStatus;
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return 'undetermined';
  }
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<PermissionStatus> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status as PermissionStatus;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    return 'denied';
  }
}

/**
 * Check notification permission status
 */
export async function checkNotificationPermission(): Promise<PermissionStatus> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'denied' && canAskAgain === false) return 'blocked';
  return status as PermissionStatus;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

/**
 * Check media library permission status
 */
export async function checkMediaLibraryPermission(): Promise<PermissionStatus> {
  const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (status === 'denied' && canAskAgain === false) return 'blocked';
  return status as PermissionStatus;
}

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<PermissionStatus> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status as PermissionStatus;
}

/**
 * Get permission info for a specific permission type
 */
export function getPermissionInfo(type: PermissionType): Omit<PermissionInfo, 'status' | 'canAskAgain'> {
  const permissions: Record<PermissionType, Omit<PermissionInfo, 'status' | 'canAskAgain'>> = {
    location: {
      type: 'location',
      title: 'Location Access',
      description: 'We need your location to show nearby restaurants and provide directions.',
      settingsDescription: 'Please enable location access in Settings to see restaurants near you.',
    },
    camera: {
      type: 'camera',
      title: 'Camera Access',
      description: 'We need camera access to scan QR codes at restaurants.',
      settingsDescription: 'Please enable camera access in Settings to scan QR codes.',
    },
    notifications: {
      type: 'notifications',
      title: 'Notifications',
      description: 'Get notified about new deals, visit reminders, and special offers.',
      settingsDescription: 'Please enable notifications in Settings to receive updates about deals.',
    },
    mediaLibrary: {
      type: 'mediaLibrary',
      title: 'Photo Library Access',
      description: 'We need access to your photos to upload profile pictures.',
      settingsDescription: 'Please enable photo library access in Settings to upload photos.',
    },
  };

  return permissions[type];
}

/**
 * Check all permissions and return their statuses
 */
export async function checkAllPermissions(): Promise<PermissionInfo[]> {
  const [locationStatus, cameraStatus, notificationStatus, mediaLibraryStatus] = await Promise.all([
    checkLocationPermission(),
    checkCameraPermission(),
    checkNotificationPermission(),
    checkMediaLibraryPermission(),
  ]);

  const locationInfo = getPermissionInfo('location');
  const cameraInfo = getPermissionInfo('camera');
  const notificationInfo = getPermissionInfo('notifications');
  const mediaLibraryInfo = getPermissionInfo('mediaLibrary');

  return [
    {
      ...locationInfo,
      status: locationStatus,
      canAskAgain: locationStatus !== 'blocked',
    },
    {
      ...cameraInfo,
      status: cameraStatus,
      canAskAgain: cameraStatus !== 'blocked',
    },
    {
      ...notificationInfo,
      status: notificationStatus,
      canAskAgain: notificationStatus !== 'blocked',
    },
    {
      ...mediaLibraryInfo,
      status: mediaLibraryStatus,
      canAskAgain: mediaLibraryStatus !== 'blocked',
    },
  ];
}

/**
 * Request a specific permission with proper error handling
 */
export async function requestPermissionWithGuidance(
  type: PermissionType
): Promise<PermissionStatus> {
  let status: PermissionStatus = 'undetermined';

  try {
    switch (type) {
      case 'location':
        status = await requestLocationPermission();
        break;
      case 'camera':
        status = await requestCameraPermission();
        break;
      case 'notifications':
        status = await requestNotificationPermission();
        break;
      case 'mediaLibrary':
        status = await requestMediaLibraryPermission();
        break;
    }

    // If permission was denied and can't ask again, guide user to settings
    if (status === 'denied' || status === 'blocked') {
      const info = getPermissionInfo(type);
      showSettingsAlert(
        info.title,
        info.settingsDescription
      );
    }

    return status;
  } catch (error) {
    console.error(`Error requesting ${type} permission:`, error);
    return 'denied';
  }
}
