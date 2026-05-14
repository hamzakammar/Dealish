import { checkAllPermissions, PermissionInfo, PermissionType, requestPermissionWithGuidance } from '@/utils/permissions';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const getStatusIcon = (status: PermissionInfo['status']): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (status) {
    case 'granted':
      return { name: 'checkmark-circle', color: '#4CAF50' };
    case 'denied':
    case 'blocked':
      return { name: 'close-circle', color: '#F44336' };
    default:
      return { name: 'help-circle', color: '#FF9800' };
  }
};

const getStatusText = (status: PermissionInfo['status']): string => {
  switch (status) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Denied';
    case 'blocked':
      return 'Blocked - Open Settings';
    default:
      return 'Not Requested';
  }
};

export default function PermissionsScreen() {
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<PermissionType | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const perms = await checkAllPermissions();
      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      Alert.alert('Error', 'Failed to load permission statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async (type: PermissionType) => {
    setRequesting(type);
    try {
      await requestPermissionWithGuidance(type);
      // Reload permissions to get updated status
      await loadPermissions();
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission');
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
        <Text style={styles.loadingText}>Loading permissions...</Text>
      </View>
    );
  }

  const grantedCount = permissions.filter(p => p.status === 'granted').length;
  const totalCount = permissions.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Permissions</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Permission Status</Text>
        <Text style={styles.summaryText}>
          {grantedCount} of {totalCount} permissions granted
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(grantedCount / totalCount) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.permissionsList}>
        {permissions.map((permission) => {
          const statusIcon = getStatusIcon(permission.status);
          const isRequesting = requesting === permission.type;
          const isGranted = permission.status === 'granted';

          return (
            <View key={permission.type} style={styles.permissionCard}>
              <View style={styles.permissionHeader}>
                <View style={styles.permissionInfo}>
                  <Ionicons
                    name={getIcon(permission.type)}
                    size={24}
                    color="#FE902A"
                    style={styles.permissionIcon}
                  />
                  <View style={styles.permissionTextContainer}>
                    <Text style={styles.permissionTitle}>{permission.title}</Text>
                    <Text style={styles.permissionDescription}>
                      {permission.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusContainer}>
                  <Ionicons
                    name={statusIcon.name}
                    size={24}
                    color={statusIcon.color}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: statusIcon.color },
                    ]}
                  >
                    {getStatusText(permission.status)}
                  </Text>
                </View>
              </View>

              {!isGranted && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    (isRequesting || permission.status === 'blocked') && styles.actionButtonDisabled,
                  ]}
                  onPress={() => {
                    if (permission.status === 'blocked') {
                      Alert.alert(
                        permission.title,
                        permission.settingsDescription,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Open Settings',
                            onPress: async () => {
                              const { openAppSettings } = require('@/utils/permissions');
                              await openAppSettings();
                            },
                          },
                        ]
                      );
                    } else {
                      handleRequestPermission(permission.type);
                    }
                  }}
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      {permission.status === 'blocked'
                        ? 'Open Settings'
                        : 'Grant Permission'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Some features may not work properly without the required permissions.
          You can change these settings at any time.
        </Text>
      </View>
    </ScrollView>
  );
}

function getIcon(type: PermissionType): keyof typeof Ionicons.glyphMap {
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#FFF5EB',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FE902A',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FE902A',
    borderRadius: 4,
  },
  permissionsList: {
    paddingHorizontal: 16,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  permissionHeader: {
    marginBottom: 12,
  },
  permissionInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  permissionIcon: {
    marginRight: 12,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#FE902A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
