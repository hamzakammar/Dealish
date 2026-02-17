import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from '@/app/providers/auth';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const { profile, session, refetchProfile } = useAuthContext();
  const router = useRouter();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(profile?.display_name || '');
  const [editedEmail, setEditedEmail] = useState(profile?.email || session?.user?.email || '');
  const [editedAvatar, setEditedAvatar] = useState<string | null>(profile?.avatar_url || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -280,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEditedAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id || !session?.user?.id) return;
    setIsSavingProfile(true);
    try {
      let avatarUrl = editedAvatar;

      if (editedAvatar && editedAvatar !== profile.avatar_url && editedAvatar.startsWith('file://')) {
        try {
          const response = await fetch(editedAvatar);
          const blob = await response.blob();
          const fileName = `${session.user.id}_${Date.now()}.jpg`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            Alert.alert('Error', 'Failed to upload image');
            setIsSavingProfile(false);
            return;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          avatarUrl = publicUrl;
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          Alert.alert('Error', 'Failed to upload image');
          setIsSavingProfile(false);
          return;
        }
      }

      const updateData: any = {
        display_name: editedName.trim() || null,
        email: editedEmail.trim() || null,
      };

      if (avatarUrl !== profile.avatar_url) {
        updateData.avatar_url = avatarUrl || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id);
      
      if (error) throw error;
      
      const currentEmail = profile.email || session?.user?.email || '';
      if (editedEmail.trim() !== currentEmail) {
        await supabase.auth.updateUser({
          email: editedEmail.trim(),
        });
      }
      
      await refetchProfile();
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.backdrop,
            { opacity: backdropOpacity }
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={onClose} 
          />
        </Animated.View>
        <Animated.View 
          style={[
            styles.sidebar,
            {
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={isEditingProfile ? pickImage : undefined}
              disabled={!isEditingProfile}
              activeOpacity={isEditingProfile ? 0.7 : 1}
            >
              {isEditingProfile && editedAvatar ? (
                <Image source={{ uri: editedAvatar }} style={styles.profileAvatar} resizeMode="cover" />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} resizeMode="cover" />
              ) : (
                <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
                  <Ionicons name="person" size={32} color="#FE902A" />
                </View>
              )}
              {isEditingProfile && (
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {isEditingProfile ? (
              <View style={styles.profileEditForm}>
                <Text style={styles.inputLabel}>Name</Text>
                <Text style={styles.profileName}>{editedName || 'User'}</Text>
                <Text style={styles.inputLabel}>Email</Text>
                <Text style={styles.profileEmail}>{editedEmail || ''}</Text>
                <View style={styles.profileActions}>
                  <TouchableOpacity
                    style={[styles.profileActionButton, styles.profileSaveButton]}
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <Text style={styles.profileActionButtonText}>Saving...</Text>
                    ) : (
                      <Text style={styles.profileActionButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.profileActionButton, styles.profileCancelButton]}
                    onPress={() => {
                      setEditedName(profile?.display_name || '');
                      setEditedEmail(profile?.email || session?.user?.email || '');
                      setEditedAvatar(profile?.avatar_url || null);
                      setIsEditingProfile(false);
                    }}
                  >
                    <Text style={[styles.profileActionButtonText, styles.profileCancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.profileInfo}>
                <Text style={styles.greeting}>{getGreeting()}!</Text>
                <Text style={styles.profileName}>{profile?.display_name || 'User'}</Text>
                <Text style={styles.profileEmail}>{profile?.email || session?.user?.email || ''}</Text>
                <View style={styles.profileRole}>
                  <View style={styles.roleBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#FE902A" />
                    <Text style={styles.profileRoleText}>
                      {profile?.role === 'owner' ? 'Owner' : profile?.role === 'admin' ? 'Admin' : 'User'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.profileEditButton}
                  onPress={() => setIsEditingProfile(true)}
                >
                  <Ionicons name="create-outline" size={16} color="#64748B" />
                  <Text style={styles.profileEditButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                router.push('/admin');
              }}
            >
              <Ionicons name="home-outline" size={20} color="#64748B" />
              <Text style={styles.menuItemText}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                router.push('/settings');
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#64748B" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                onClose();
                try {
                  await supabase.auth.signOut();
                  router.replace('/auth');
                } catch (error) {
                  console.error('Sign out error:', error);
                  router.replace('/auth');
                }
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    padding: 4,
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileAvatarPlaceholder: {
    backgroundColor: '#FEF3E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 16,
    right: '50%',
    marginRight: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FE902A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  profileRole: {
    marginBottom: 16,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  profileRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FE902A',
  },
  profileEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  profileEditButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  profileEditForm: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    marginTop: 12,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  profileActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileSaveButton: {
    backgroundColor: '#FE902A',
  },
  profileCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  profileActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileCancelButtonText: {
    color: '#64748B',
  },
  menuSection: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  menuItemTextDanger: {
    color: '#EF4444',
  },
});
