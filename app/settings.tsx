import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import PasswordChangeModal from "@/components/PasswordChangeModal";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useThemeColors } from "@/hooks/useThemeColors";
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import { useTheme, DarkTheme } from "@react-navigation/native";
import React, { useState, useMemo } from "react";
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
  const theme = useTheme();
  const {
    settings,
    loading,
    updateNotificationSettings,
    updatePrivacySettings,
    updateAppearanceSettings,
  } = useUserSettings();
  const [saving, setSaving] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Check if theme is dark by comparing background color
  const isDark = useMemo(() => theme.colors.background === DarkTheme.colors.background, [theme]);
  
  // Create dynamic styles based on theme
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: isDark ? "#999" : "#666",
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#333" : "#f0f0f0",
    },
    settingRowVertical: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#333" : "#f0f0f0",
    },
    selectOption: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? "#333" : "#f5f5f5",
      borderWidth: 1,
      borderColor: isDark ? "#555" : "#e0e0e0",
      minWidth: 60,
    },
    selectOptionText: {
      fontSize: 13,
      color: isDark ? "#ccc" : "#666",
      fontWeight: "500",
    },
    selectOptionFull: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: isDark ? "#333" : "#f5f5f5",
      borderWidth: 1,
      borderColor: isDark ? "#555" : "#e0e0e0",
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    selectOptionTextFull: {
      fontSize: 13,
      color: isDark ? "#ccc" : "#666",
      fontWeight: "500",
      textAlign: "center",
    },
    accountButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? "#333" : "#f0f0f0",
    },
    accountButtonText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "500",
    },
  }), [theme, isDark]);

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
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              Alert.alert("Error", message || "Failed to delete account");
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={styles.contentContainer}>
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
            <AntDesign name="left" size={20} color="#FE902A" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={dynamicStyles.sectionTitle}>Notifications</Text>
        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Deal Notifications</Text>
            <Text style={dynamicStyles.settingDescription}>
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

        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Visit Tracking</Text>
            <Text style={dynamicStyles.settingDescription}>
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

        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Favorites Updates</Text>
            <Text style={dynamicStyles.settingDescription}>
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
        <Text style={dynamicStyles.sectionTitle}>Privacy</Text>
        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Share Location</Text>
            <Text style={dynamicStyles.settingDescription}>
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

        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Show Visit History</Text>
            <Text style={dynamicStyles.settingDescription}>
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
        <Text style={dynamicStyles.sectionTitle}>Appearance</Text>
        <View style={dynamicStyles.settingRow}>
          <View style={styles.settingContent}>
            <Text style={dynamicStyles.settingLabel}>Theme</Text>
            <Text style={dynamicStyles.settingDescription}>Choose your preferred theme</Text>
          </View>
          <View style={styles.selectContainer}>
            {(["light", "dark", "auto"] as const).map((themeOption) => (
              <TouchableOpacity
                key={themeOption}
                style={[
                  dynamicStyles.selectOption,
                  settings.appearance.theme === themeOption && styles.selectOptionActive,
                ]}
                onPress={() => handleAppearanceChange("theme", themeOption)}
              >
                <Text
                  style={[
                    dynamicStyles.selectOptionText,
                    settings.appearance.theme === themeOption && styles.selectOptionTextActive,
                  ]}
                >
                  {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={dynamicStyles.settingRowVertical}>
          <View style={styles.settingContentFull}>
            <Text style={dynamicStyles.settingLabel}>Default Map Type</Text>
            <Text style={dynamicStyles.settingDescription}>Preferred map view</Text>
          </View>
          <View style={styles.selectContainerFull}>
            {(["standard", "satellite", "hybrid", "terrain"] as const).map((mapType) => (
              <TouchableOpacity
                key={mapType}
                style={[
                  dynamicStyles.selectOptionFull,
                  settings.appearance.defaultMapType === mapType && styles.selectOptionActiveFull,
                ]}
                onPress={() => handleAppearanceChange("defaultMapType", mapType)}
              >
                <Text
                  style={[
                    dynamicStyles.selectOptionTextFull,
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
        <Text style={dynamicStyles.sectionTitle}>Permissions</Text>
        <TouchableOpacity 
          style={dynamicStyles.accountButton} 
          onPress={() => {
            try {
              router.push('/permissions');
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('Error', 'Failed to open permissions screen');
            }
          }}
        >
          <Text style={dynamicStyles.accountButtonText}>Manage Permissions</Text>
          <AntDesign name="right" size={16} color={isDark ? "#999" : "#666"} />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={dynamicStyles.sectionTitle}>Account</Text>
        <TouchableOpacity 
          style={dynamicStyles.accountButton} 
          onPress={handleChangePassword}
        >
          <Text style={dynamicStyles.accountButtonText}>Change Password</Text>
          <AntDesign name="right" size={16} color={isDark ? "#999" : "#666"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[dynamicStyles.accountButton, styles.deleteButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={[dynamicStyles.accountButtonText, styles.deleteButtonText]}>
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
    paddingBottom: 20,
    backgroundColor: "#FE902A",
  },
  backButton: {
    padding: 8,
  },
  backIconBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
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
    color: "#333",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#666",
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
