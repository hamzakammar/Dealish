import { openAppSettings, PermissionType, requestPermissionWithGuidance } from '@/utils/permissions';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface PermissionRequestProps {
  type: PermissionType;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  showDescription?: boolean;
  compact?: boolean;
}

const getIcon = (type: PermissionType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'location':
      return 'location';
    case 'camera':
      return 'camera';
    case 'notifications':
      return 'notifications';
    case 'mediaLibrary':
      return 'images';
    default:
      return 'help-circle';
  }
};

export default function PermissionRequest({
  type,
  onPermissionGranted,
  onPermissionDenied,
  showDescription = true,
  compact = false,
}: PermissionRequestProps) {
  const [loading, setLoading] = useState(false);
  const [info] = useState(() => {
    const { title, description, settingsDescription } = require('@/utils/permissions').getPermissionInfo(type);
    return { title, description, settingsDescription };
  });

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const status = await requestPermissionWithGuidance(type);
      if (status === 'granted') {
        onPermissionGranted?.();
      } else {
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      onPermissionDenied?.();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    await openAppSettings();
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactButton}
        onPress={handleRequestPermission}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FE902A" />
        ) : (
          <>
            <Ionicons name={getIcon(type)} size={20} color="#FE902A" />
            <Text style={styles.compactButtonText}>Grant Permission</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={getIcon(type)} size={64} color="#FE902A" />
      </View>
      <Text style={styles.title}>{info.title}</Text>
      {showDescription && (
        <Text style={styles.description}>{info.description}</Text>
      )}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRequestPermission}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Grant Permission</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={handleOpenSettings}
      >
        <Text style={styles.settingsButtonText}>Open Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#FE902A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  settingsButtonText: {
    color: '#FE902A',
    fontSize: 14,
    fontWeight: '500',
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  compactButtonText: {
    color: '#FE902A',
    fontSize: 14,
    fontWeight: '500',
  },
});
