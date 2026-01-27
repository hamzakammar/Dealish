import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";

export function useUserSettings() {
  const { session, profile } = useAuthContext();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.settings) {
      try {
        // Merge with defaults in case new settings were added
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...profile.settings,
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(profile.settings as any).notifications,
          },
          privacy: {
            ...DEFAULT_SETTINGS.privacy,
            ...(profile.settings as any).privacy,
          },
          appearance: {
            ...DEFAULT_SETTINGS.appearance,
            ...(profile.settings as any).appearance,
          },
        };
        setSettings(mergedSettings);
      } catch (error) {
        console.error("Error parsing settings:", error);
        setSettings(DEFAULT_SETTINGS);
      }
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    setLoading(false);
  }, [profile]);

  const updateSettings = async (newSettings: UserSettings) => {
    if (!session?.user?.id) return;

    try {
      setSettings(newSettings);
      
      const { error } = await supabase
        .from("profiles")
        .update({ settings: newSettings })
        .eq("id", session.user.id);

      if (error) {
        console.error("Error updating settings:", error);
        // Revert on error
        if (profile?.settings) {
          setSettings(profile.settings as UserSettings);
        }
        throw error;
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  };

  const updateNotificationSettings = async (
    notifications: Partial<UserSettings["notifications"]>
  ) => {
    await updateSettings({
      ...settings,
      notifications: { ...settings.notifications, ...notifications },
    });
  };

  const updatePrivacySettings = async (
    privacy: Partial<UserSettings["privacy"]>
  ) => {
    await updateSettings({
      ...settings,
      privacy: { ...settings.privacy, ...privacy },
    });
  };

  const updateAppearanceSettings = async (
    appearance: Partial<UserSettings["appearance"]>
  ) => {
    await updateSettings({
      ...settings,
      appearance: { ...settings.appearance, ...appearance },
    });
  };

  return {
    settings,
    loading,
    updateSettings,
    updateNotificationSettings,
    updatePrivacySettings,
    updateAppearanceSettings,
  };
}
