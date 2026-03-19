import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import RatingDisplay from "@/components/RatingDisplay";
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
    FlatList,
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

type PanelView = "menu" | "favourites";

export default function AccountPanel({ isOpen, onClose, onSelectRestaurant, onPanToRestaurant, onOpenFilters }: AccountPanelProps) {
  const { session, profile } = useAuthContext();
  const colors = useThemeColors();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [currentView, setCurrentView] = useState<PanelView>("menu");
  const [favourites, setFavourites] = useState<Restaurant[]>([]);
  const [loadingFavourites, setLoadingFavourites] = useState(false);
  
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

  // Dynamic labels based on count
  const favouritesLabel = favourites.length === 1 ? "Favourite" : "Favourites";

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

  // Load favorites
  const loadFavourites = async () => {
    if (!session?.user) return;

    setLoadingFavourites(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("favourites")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      const favoriteIds = profileData?.favourites || [];

      if (favoriteIds && favoriteIds.length > 0) {
        const { data: restaurantData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .in("id", favoriteIds);

        if (restError) throw restError;

        const parsed: Restaurant[] =
          restaurantData?.map((r: any) => ({
            id: r.id,
            name: r.name,
            lat: Number(r.lat),
            lng: Number(r.lng),
            partner: Boolean(r.partner),
            description: r.description ?? undefined,
            address: r.address ?? undefined,
            phone: r.phone ?? undefined,
            type: r.type ?? undefined,
            rating: r.rating ?? undefined,
            rating_count: r.num_ratings ?? undefined,
            image_url: r.hero_image_url ?? r.display_image ?? undefined,
            logo_url: r.hero_image_url ?? r.display_image ?? undefined,
            display_image: r.display_image ?? undefined,
          })) ?? [];

        setFavourites(parsed);
      } else {
        setFavourites([]);
      }
    } catch (error) {
      console.error("Error loading favourites:", error);
      Alert.alert("Error", "Failed to load favorites");
    } finally {
      setLoadingFavourites(false);
    }
  };

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
          router.replace('/auth');
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback - try again after a delay
          setTimeout(() => {
            try {
              router.replace('/auth');
            } catch (retryError) {
              console.error('Retry navigation failed:', retryError);
            }
          }, 100);
        }
      }
    } catch (error: any) {
      Alert.alert(
        "Sign Out Failed",
        error?.message || "An unexpected error occurred while signing out.",
        [{ text: "OK" }]
      );
      setSigningOut(false);
    }
  };

  const handleFavouritesPress = () => {
    setCurrentView("favourites");
    loadFavourites();
  };

  const handleBackToMenu = () => {
    setCurrentView("menu");
  };

  const handleFavouriteSelect = (restaurant: Restaurant) => {
    if (onSelectRestaurant) {
      onSelectRestaurant(restaurant);
    }
    if (onPanToRestaurant) {
      onPanToRestaurant(restaurant.lat, restaurant.lng);
    }
    onClose();
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

  const menuItems = [
    { label: "My Account", icon: "user", action: navigateToAccount },
    { label: "Filters", icon: "filter", action: handleFiltersPress },
    { label: "Favourites", icon: "heart", action: handleFavouritesPress },
    { label: "Settings", icon: "setting", action: handleSettingsPress },
    { label: "About", icon: "info", action: () => router.push('/about' as any) },
    { label: "Help", icon: "question", action: () => router.push('/help' as any) },
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

        {currentView === "menu" ? (
          <>
            {/* User Profile Section */}
            <View style={styles.profileSection}>
              {loadingProfile ? (
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
                  <AntDesign name={item.icon as any} size={20} color={colors.text} />
                  <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sign Out Button */}
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
          </>
        ) : (
          <>
            {/* Back Button */}
            <TouchableOpacity
              style={[styles.backButton, dynamicStyles.backButton]}
              onPress={handleBackToMenu}
            >
              <AntDesign name="left" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Favorites List */}
            <Text style={[styles.favouritesTitle, dynamicStyles.favouritesTitle]}>{favouritesLabel}</Text>
            {loadingFavourites ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FE902A" />
              </View>
            ) : favourites.length === 0 ? (
              <View style={styles.emptyState}>
                <AntDesign name="heart" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No favourites yet</Text>
              </View>
            ) : (
              <FlatList
                    data={favourites}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.favoriteItem, dynamicStyles.favoriteItem]}
                    onPress={() => handleFavouriteSelect(item)}
                  >
                    <View style={styles.favoriteImageContainer}>
                      {(item.logo_url || item.display_image) ? (
                        <Image
                          source={{ uri: item.logo_url || item.display_image }}
                          style={styles.favoriteImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.favoriteImagePlaceholder}>
                          <Ionicons name="restaurant-outline" size={22} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.favoriteInfo}>
                      <Text style={[styles.favoriteName, dynamicStyles.favoriteName]}>{item.name}</Text>
                      <RatingDisplay
                        rating={item.rating}
                        ratingCount={item.rating_count}
                        size={10}
                        showCount={true}
                      />
                      {item.address && (
                        <Text
                          style={[styles.favoriteAddress, dynamicStyles.favoriteAddress]}
                          numberOfLines={1}
                        >
                          {item.address}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                scrollEnabled
                nestedScrollEnabled
              />
            )}
          </>
        )}
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
