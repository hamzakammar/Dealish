import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import { useAccountNavigation } from "@/hooks/useAccountNavigation";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    useWindowDimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type AccountPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectRestaurant?: (restaurant: Restaurant) => void;
  onPanToRestaurant?: (lat: number, lng: number) => void;
  onOpenFilters?: () => void;
};

export default function AccountPanel({ isOpen, onClose, onSelectRestaurant, onPanToRestaurant, onOpenFilters }: AccountPanelProps) {
  const { session, profile } = useAuthContext();
  const colors = useThemeColors();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => ({
    panel: {
      backgroundColor: colors.card,
    },
    userName: {
      color: colors.text,
    },
    userEmail: {
      color: colors.textSecondary,
    },
    menuLabel: {
      color: colors.text,
    },
    favouritesTitle: {
      color: colors.text,
    },
    favoriteItem: {
      backgroundColor: colors.cardSecondary,
    },
    favoriteName: {
      color: colors.text,
    },
    favoriteAddress: {
      color: colors.textSecondary,
    },
    backButton: {
      backgroundColor: colors.cardSecondary,
    },
  }), [colors]);

  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = screenWidth * 0.82;
  const slideAnim = React.useRef(new Animated.Value(-panelWidth)).current;

  // Animate panel in/out
  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : -panelWidth,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isOpen, panelWidth, slideAnim]);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) {
        setLoadingProfile(false);
        return;
      }

      try {
        setUserEmail(session.user.email || "");

        // Load from profile object if available, fallback to session metadata
        // Note: profile.avatar_url is prioritized - it contains either:
        // 1. Custom uploaded avatar, or
        // 2. Google auth avatar (synced automatically on sign-in)
        if (profile) {
          setUserName(profile.display_name || session.user.user_metadata?.name || "User");
          setUserAvatar(profile.avatar_url || session.user.user_metadata?.avatar_url || null);
        } else {
          const metadata = session.user.user_metadata;
          if (metadata?.display_name) {
            setUserName(metadata.display_name);
          } else if (metadata?.name) {
            setUserName(metadata.name);
          }

          if (metadata?.avatar_url) {
            setUserAvatar(metadata.avatar_url);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [session, profile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        Alert.alert(
          "Sign Out Failed",
          error.message || "Unable to sign out. Please try again.",
          [{ text: "OK" }]
        );
        setSigningOut(false);
      } else {
        // Successfully signed out - redirect to auth screen
        onClose();
        try {
          router.replace('/map');
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback - try again after a delay
          setTimeout(() => {
            try {
              router.replace('/map');
            } catch (retryError) {
              console.error('Retry navigation failed:', retryError);
            }
          }, 100);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        "Sign Out Failed",
        message || "An unexpected error occurred while signing out.",
        [{ text: "OK" }]
      );
      setSigningOut(false);
    }
  };

  const handleLikedPress = () => {
    onClose();
    try {
      router.push('/liked' as any);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const navigateToAccount = useAccountNavigation();

  const handleSettingsPress = () => {
    onClose();
    try {
      router.push('/settings' as '/account');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate to settings. Please try again.');
    }
  };

  const handleFiltersPress = () => {
    onClose();
    // Open filter panel if callback provided
    if (onOpenFilters) {
      onOpenFilters();
    }
  };

  const isGuest = !session?.user;

  const handleSignInPress = () => {
    onClose();
    try {
      router.push('/auth' as any);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const menuItems = isGuest
    ? [
        { label: "Filters", icon: "filter", action: handleFiltersPress },
        { label: "Settings", icon: "setting", action: handleSettingsPress },
        { label: "About", icon: "information-circle", action: () => router.push('/about' as any) },
        { label: "Help", icon: "help-circle", action: () => router.push('/help' as any) },
        { label: "Partner with us", icon: "like", action: () => router.push('/partner' as any) },
      ]
    : [
        { label: "My Account", icon: "user", action: navigateToAccount },
        { label: "Filters", icon: "filter", action: handleFiltersPress },
        { label: "Liked", icon: "heart", action: handleLikedPress },
        { label: "Settings", icon: "setting", action: handleSettingsPress },
        { label: "About", icon: "information-circle", action: () => router.push('/about' as any) },
        { label: "Help", icon: "help-circle", action: () => router.push('/help' as any) },
        { label: "Partner with us", icon: "like", action: () => router.push('/partner' as any) },
      ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          activeOpacity={0}
        />
      )}

      {/* Slide Panel */}
      <Animated.View
        style={[
          styles.panel,
          dynamicStyles.panel,
          {
            width: panelWidth,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <AntDesign name="close" size={24} color="#333" />
        </TouchableOpacity>

        <>
            {/* User Profile Section */}
            <View style={styles.profileSection}>
              {isGuest ? (
                <>
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <AntDesign name="user" size={32} color="#FE902A" />
                  </View>
                  <Text style={[styles.userName, dynamicStyles.userName]}>Guest</Text>
                  <Text style={[styles.userEmail, dynamicStyles.userEmail]}>
                    Sign in to save favourites and redeem deals
                  </Text>
                </>
              ) : loadingProfile ? (
                <ActivityIndicator size="small" color="#FE902A" />
              ) : (
                <>
                  {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={styles.avatar} resizeMode="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <AntDesign name="user" size={32} color="#FE902A" />
                    </View>
                  )}
                  <Text style={[styles.userName, dynamicStyles.userName]}>{userName}</Text>
                  <Text style={[styles.userEmail, dynamicStyles.userEmail]}>{userEmail}</Text>
                </>
              )}
            </View>

            {/* Menu Items */}
            <View style={styles.menuSection}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={item.action}
                >
                  {item.icon === 'information-circle' || item.icon === 'help-circle'
                    ? <Ionicons name={item.icon as any} size={22} color={colors.text} />
                    : <AntDesign name={item.icon as any} size={20} color={colors.text} />
                  }
                  <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sign Out / Sign In Button */}
            {isGuest ? (
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleSignInPress}
              >
                <Text style={styles.logoutText}>Sign in / Create account</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  signingOut && styles.logoutButtonDisabled,
                ]}
                onPress={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.logoutText}>Logout</Text>
                )}
              </TouchableOpacity>
            )}
          </>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 5,
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 6,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FE902A",
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
  },
  menuSection: {
    flex: 1,
    gap: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  favouritesTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  favoriteItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
    gap: 12,
  },
  favoriteImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
  },
  favoriteImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  favoriteImagePlaceholder: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  favoriteAddress: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
  },
  logoutButton: {
    backgroundColor: "#FE902A",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 32,
    marginTop: "auto",
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
