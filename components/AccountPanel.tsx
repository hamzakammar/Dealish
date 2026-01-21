import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import { useAccountNavigation } from "@/hooks/useAccountNavigation";
import { Restaurant } from "@/types/restaurant";
import RatingDisplay from "@/components/RatingDisplay";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
};

type PanelView = "menu" | "favourites";

export default function AccountPanel({ isOpen, onClose, onSelectRestaurant, onPanToRestaurant }: AccountPanelProps) {
  const { session } = useAuthContext();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [currentView, setCurrentView] = useState<PanelView>("menu");
  const [favourites, setFavourites] = useState<Restaurant[]>([]);
  const [loadingFavourites, setLoadingFavourites] = useState(false);

  // Dynamic labels based on count
  const favouritesLabel = favourites.length === 1 ? "Favourite" : "Favourites";

  const screenWidth = Dimensions.get("window").width;
  const panelWidth = screenWidth * 0.75;
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

        const metadata = session.user.user_metadata;
        if (metadata?.full_name) {
          setUserName(metadata.full_name);
        } else if (metadata?.name) {
          setUserName(metadata.name);
        }

        if (metadata?.avatar_url) {
          setUserAvatar(metadata.avatar_url);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [session]);

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
            cuisine_type: r.cuisine_type ?? undefined,
            rating: r.rating ?? undefined,
            rating_count: r.num_ratings ?? undefined,
            image_url: r.hero_image_url ?? undefined,
            logo_url: r.hero_image_url ?? undefined,
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
      }
    } catch (error: any) {
      Alert.alert(
        "Sign Out Failed",
        error?.message || "An unexpected error occurred while signing out.",
        [{ text: "OK" }]
      );
    } finally {
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

  const menuItems = [
    { label: "My Account", icon: "user", action: navigateToAccount },
    { label: "Filters", icon: "filter", action: () => {} },
    { label: "Favourites", icon: "heart", action: handleFavouritesPress },
    { label: "Settings", icon: "setting", action: () => {} },
    { label: "About", icon: "info", action: () => {} },
    { label: "Help", icon: "question", action: () => {} },
    { label: "Partner with us", icon: "like", action: () => {} },
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
                    <Image source={{ uri: userAvatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <AntDesign name="user" size={32} color="#FE902A" />
                    </View>
                  )}
                  <Text style={styles.userName}>{userName}</Text>
                  <Text style={styles.userEmail}>{userEmail}</Text>
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
                  <AntDesign name={item.icon as any} size={20} color="#333" />
                  <Text style={styles.menuLabel}>{item.label}</Text>
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
              style={styles.backButton}
              onPress={handleBackToMenu}
            >
              <AntDesign name="left" size={24} color="#333" />
            </TouchableOpacity>

            {/* Favorites List */}
            <Text style={styles.favouritesTitle}>{favouritesLabel}</Text>
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
                    style={styles.favoriteItem}
                    onPress={() => handleFavouriteSelect(item)}
                  >
                    {item.logo_url && (
                      <Image
                        source={{ uri: item.logo_url }}
                        style={styles.favoriteImage}
                      />
                    )}
                    <View style={styles.favoriteInfo}>
                      <Text style={styles.favoriteName}>{item.name}</Text>
                      <RatingDisplay
                        rating={item.rating}
                        ratingCount={item.rating_count}
                        size={10}
                        showCount={true}
                      />
                      {item.address && (
                        <Text
                          style={styles.favoriteAddress}
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
    backgroundColor: "#F5E6D3",
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
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: "#333",
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
    backgroundColor: "#fff",
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
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: "#666",
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
    color: "#333",
    fontWeight: "500",
  },
  favouritesTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  favoriteItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    gap: 12,
  },
  favoriteImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  favoriteAddress: {
    fontSize: 12,
    color: "#666",
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
