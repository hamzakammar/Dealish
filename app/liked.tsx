import { supabase } from "@/app/lib/supabase";
import { useAuthContext } from "@/app/providers/auth";
import RatingDisplay from "@/components/RatingDisplay";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Liked (favourites) view — a first-class, linkable screen listing the
 * restaurants a user has saved. Liked state itself lives on
 * `profiles.favourites` and is mutated elsewhere (RestaurantDetailCard); this
 * screen only reads it. Tapping a restaurant hands off to the map, which
 * focuses it via the `?focus=<id>` param.
 */
export default function LikedScreen() {
  const { session } = useAuthContext();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [favourites, setFavourites] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isGuest = !session?.user;

  const loadFavourites = useCallback(async () => {
    if (!session?.user) {
      setFavourites([]);
      setLoading(false);
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("favourites")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      const favoriteIds: string[] = profileData?.favourites || [];

      if (favoriteIds.length > 0) {
        const { data: restaurantData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .in("id", favoriteIds);

        if (restError) throw restError;

        const parsed: Restaurant[] =
          restaurantData?.map((r) => ({
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
      console.error("Error loading liked restaurants:", error);
      setFavourites([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    loadFavourites();
  }, [loadFavourites]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFavourites();
    setRefreshing(false);
  }, [loadFavourites]);

  const handleBack = () => {
    try {
      router.back();
    } catch {
      router.replace("/map");
    }
  };

  const handleSelect = (restaurant: Restaurant) => {
    router.push({ pathname: "/map", params: { focus: restaurant.id } } as any);
  };

  const renderItem = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.cardSecondary }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.logo_url || item.display_image ? (
          <Image
            source={{ uri: item.logo_url || item.display_image }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.card }]}>
            <Ionicons name="restaurant-outline" size={22} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <RatingDisplay
          rating={item.rating}
          ratingCount={item.rating_count}
          size={11}
          showCount={true}
        />
        {item.address && (
          <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
      <AntDesign name="right" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.card }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <AntDesign name="left" size={20} color="#FE902A" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Liked</Text>
        <View style={styles.backButton} />
      </View>

      {isGuest ? (
        <View style={styles.emptyState}>
          <AntDesign name="heart" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to see your likes</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Create a free account to save restaurants and find them here.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push("/auth" as any)}
          >
            <Text style={styles.signInButtonText}>Sign in / Create account</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FE902A" />
        </View>
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            favourites.length === 0 && styles.emptyListContent,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FE902A"
              colors={["#FE902A"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <AntDesign name="heart" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No liked restaurants yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Tap the heart on a restaurant to save it here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  imageContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  signInButton: {
    backgroundColor: "#FE902A",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
  },
  signInButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
