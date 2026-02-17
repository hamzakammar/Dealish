import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import PasswordChangeModal from "@/components/PasswordChangeModal";
import { useUserSettings } from "@/hooks/useUserSettings";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function SettingsScreen() {
  const { session } = useAuthContext();
  const {
    settings,
    loading,
    updateNotificationSettings,
    updatePrivacySettings,
    updateAppearanceSettings,
  } = useUserSettings();
  const [saving, setSaving] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleToggle = async (
    category: "notifications" | "privacy",
    key: string,
    value: boolean
  ) => {
    setSaving(`${category}.${key}`);
    try {
      if (category === "notifications") {
        await updateNotificationSettings({ [key]: value });
      } else {
        await updatePrivacySettings({ [key]: value });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save setting. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const handleAppearanceChange = async (
    key: "theme" | "defaultMapType",
    value: string
  ) => {
    setSaving(`appearance.${key}`);
    try {
      await updateAppearanceSettings({ [key]: value as any });
    } catch (error) {
      Alert.alert("Error", "Failed to save setting. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!session?.user?.id) return;
              
              // Delete profile
              const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", session.user.id);

              if (error) throw error;

              // Sign out and redirect
              const { error: signOutError } = await supabase.auth.signOut();
              if (!signOutError) {
                try {
                  router.replace("/auth");
                } catch (navError) {
                  console.error('Navigation error:', navError);
                }
              } else {
                throw signOutError;
              }
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete account");
            }
          },
        },
      ]
    );
  };

  const ToggleSwitch = ({
    value,
    onValueChange,
    disabled,
  }: {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleActive, disabled && styles.toggleDisabled]}
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
    >
      <View
        style={[
          styles.toggleThumb,
          value && styles.toggleThumbActive,
        ]}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            try {
              router.back();
            } catch (error) {
              console.error('Navigation error:', error);
              router.replace('/map');
            }
          }}
        >
          <View style={styles.backIconBox}>
            <AntDesign name="left" size={20} color="#333" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Deal Notifications</Text>
            <Text style={styles.settingDescription}>
              Get notified about new deals
            </Text>
          </View>
          {saving === "notifications.deals" ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <ToggleSwitch
              value={settings.notifications.deals}
              onValueChange={(value) =>
                handleToggle("notifications", "deals", value)
              }
            />
          )}
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Visit Tracking</Text>
            <Text style={styles.settingDescription}>
              Notifications about your visits
            </Text>
          </View>
          {saving === "notifications.visits" ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <ToggleSwitch
              value={settings.notifications.visits}
              onValueChange={(value) =>
                handleToggle("notifications", "visits", value)
              }
            />
          )}
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Favorites Updates</Text>
            <Text style={styles.settingDescription}>
              Updates about your favorite restaurants
            </Text>
          </View>
          {saving === "notifications.favorites" ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <ToggleSwitch
              value={settings.notifications.favorites}
              onValueChange={(value) =>
                handleToggle("notifications", "favorites", value)
              }
            />
          )}
        </View>
      </View>

      {/* Privacy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Share Location</Text>
            <Text style={styles.settingDescription}>
              Allow location sharing for better recommendations
            </Text>
          </View>
          {saving === "privacy.shareLocation" ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <ToggleSwitch
              value={settings.privacy.shareLocation}
              onValueChange={(value) =>
                handleToggle("privacy", "shareLocation", value)
              }
            />
          )}
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Show Visit History</Text>
            <Text style={styles.settingDescription}>
              Make your visit history visible to others
            </Text>
          </View>
          {saving === "privacy.showVisits" ? (
            <ActivityIndicator size="small" color="#FE902A" />
          ) : (
            <ToggleSwitch
              value={settings.privacy.showVisits}
              onValueChange={(value) =>
                handleToggle("privacy", "showVisits", value)
              }
            />
          )}
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>Choose your preferred theme</Text>
          </View>
          <View style={styles.selectContainer}>
            {(["light", "dark", "auto"] as const).map((theme) => (
              <TouchableOpacity
                key={theme}
                style={[
                  styles.selectOption,
                  settings.appearance.theme === theme && styles.selectOptionActive,
                ]}
                onPress={() => handleAppearanceChange("theme", theme)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    settings.appearance.theme === theme && styles.selectOptionTextActive,
                  ]}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.settingRowVertical}>
          <View style={styles.settingContentFull}>
            <Text style={styles.settingLabel}>Default Map Type</Text>
            <Text style={styles.settingDescription}>Preferred map view</Text>
          </View>
          <View style={styles.selectContainerFull}>
            {(["standard", "satellite", "hybrid", "terrain"] as const).map((mapType) => (
              <TouchableOpacity
                key={mapType}
                style={[
                  styles.selectOptionFull,
                  settings.appearance.defaultMapType === mapType && styles.selectOptionActiveFull,
                ]}
                onPress={() => handleAppearanceChange("defaultMapType", mapType)}
              >
                <Text
                  style={[
                    styles.selectOptionTextFull,
                    settings.appearance.defaultMapType === mapType && styles.selectOptionTextActiveFull,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {mapType.charAt(0).toUpperCase() + mapType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Permissions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <TouchableOpacity 
          style={styles.accountButton} 
          onPress={() => {
            try {
              router.push('/permissions');
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('Error', 'Failed to open permissions screen');
            }
          }}
        >
          <Text style={styles.accountButtonText}>Manage Permissions</Text>
          <AntDesign name="right" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity 
          style={styles.accountButton} 
          onPress={handleChangePassword}
        >
          <Text style={styles.accountButtonText}>Change Password</Text>
          <AntDesign name="right" size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.accountButton, styles.deleteButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.accountButtonText, styles.deleteButtonText]}>
            Delete Account
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer} />

      {/* Password Change Modal */}
      <PasswordChangeModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          // Password changed successfully
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
  },
  backIconBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingRowVertical: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingContentFull: {
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: "#bbb",
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ccc",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: "#FE902A",
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  selectContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  selectContainerFull: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minWidth: 60,
  },
  selectOptionActive: {
    backgroundColor: "#FE902A",
    borderColor: "#FE902A",
  },
  selectOptionFull: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  selectOptionActiveFull: {
    backgroundColor: "#FE902A",
    borderColor: "#FE902A",
  },
  selectOptionText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  selectOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  selectOptionTextFull: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  selectOptionTextActiveFull: {
    color: "#fff",
    fontWeight: "600",
  },
  accountButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  accountButtonText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  deleteButton: {
    marginTop: 8,
  },
  deleteButtonText: {
    color: "#ff4444",
  },
  footer: {
    height: 32,
  },
});
