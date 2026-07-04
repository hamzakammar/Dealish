import RatingDisplay from "@/components/RatingDisplay";
import SkeletonCard from "@/components/SkeletonCard";
import { supabase } from "@/app/lib/supabase";
import { Deal, Restaurant, UserLocation } from "@/types/restaurant";
import { filterActiveDeals, getNextUpcomingDeal } from "@/utils/dealActivity";
import { calculateDistance, formatDistance } from "@/utils/distance";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type SortOption = "distance" | "rating" | "name" | "reviews";

interface RestaurantListProps {
  restaurants: Restaurant[];
  onRestaurantPress: (restaurant: Restaurant) => void;
  selectedRestaurant: Restaurant | null;
  userLocation?: UserLocation | null;
  loading?: boolean;
}

const RestaurantCard = React.memo(function RestaurantCard({
  restaurant,
  isSelected,
  onPress,
  userLocation,
  deals,
}: {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: () => void;
  userLocation?: UserLocation | null;
  deals: Deal[];
}) {
  const [imageError, setImageError] = useState(false);

  const formattedDistance = useMemo(() => {
    if (!userLocation) return null;
    const dist = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      restaurant.lat,
      restaurant.lng
    );
    return formatDistance(dist);
  }, [userLocation, restaurant.lat, restaurant.lng]);

  const imageUrl = restaurant.logo_url || restaurant.image_url || restaurant.display_image;

  const isPartner = Boolean(restaurant.partner);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isPartner && styles.cardPartner,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {imageUrl && !imageError ? (
          <Image
            testID={`restaurant-image-${restaurant.id}`}
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="normal"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            testID={`image-placeholder-${restaurant.id}`}
            style={styles.imagePlaceholder}
          >
            <Ionicons name="restaurant-outline" size={32} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {isPartner && (
              <View style={styles.partnerTag}>
                <Text style={styles.partnerTagText}>Partner</Text>
              </View>
            )}
          </View>
          <RatingDisplay
            rating={restaurant.rating}
            ratingCount={restaurant.rating_count}
            size={12}
            showCount={true}
          />
          <View style={styles.metaRow}>
            {formattedDistance && (
              <>
                <Text style={styles.distance}>{formattedDistance}</Text>
                <Text style={styles.separator}>•</Text>
              </>
            )}
            <Text style={styles.cuisine} numberOfLines={1}>
              {restaurant.type}
            </Text>
            {restaurant.address && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.location} numberOfLines={1}>
                  {restaurant.address.split(',').pop()?.trim()}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardFooter}>
          {deals.length > 0 ? (
            <View style={styles.dealsRow}>
              {deals.slice(0, 2).map((deal) => (
                <View key={deal.id} style={styles.dealPill}>
                  <Text style={styles.dealPillText} numberOfLines={1}>
                    {deal.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function RestaurantList({
  restaurants,
  onRestaurantPress,
  selectedRestaurant,
  userLocation,
  loading,
}: RestaurantListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [showSortModal, setShowSortModal] = useState(false);
  const [dealsMap, setDealsMap] = useState<Map<string, Deal[]>>(new Map());
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async () => {
    if (restaurants.length === 0) {
      setDealsMap(new Map());
      setAllDeals([]);
      return;
    }

    try {
      const ids = restaurants.map((r) => r.id);
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .in("restaurant_id", ids)
        .eq("is_active", true)
        .neq("is_flagged", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allFetchedDeals = (data || []) as Deal[];
      setAllDeals(allFetchedDeals);

      const activeDeals = filterActiveDeals(allFetchedDeals, null);

      const map = new Map<string, Deal[]>();
      for (const deal of activeDeals) {
        const list = map.get(deal.restaurant_id) || [];
        list.push(deal);
        map.set(deal.restaurant_id, list);
      }
      setDealsMap(map);
    } catch (e) {
      if (__DEV__) console.error("Error batch-fetching deals:", e);
    }
  }, [restaurants]);

  // Batch-fetch deals for all restaurants (single query instead of N queries)
  useEffect(() => {
    if (restaurants.length === 0) {
      setDealsMap(new Map());
      setAllDeals([]);
      return;
    }

    fetchDeals();

    // Refresh every 2 minutes (single query, not N queries)
    const interval = setInterval(fetchDeals, 120000);
    return () => {
      clearInterval(interval);
    };
  }, [restaurants, fetchDeals]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals();
    setRefreshing(false);
  }, [fetchDeals]);

  // Calculate distances and sort restaurants
  const sortedRestaurants = useMemo(() => {
    const restaurantsWithDistance = restaurants.map((restaurant) => {
      const distance = userLocation
        ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            restaurant.lat,
            restaurant.lng
          )
        : Infinity;
      return { restaurant, distance };
    });

    const sorted = [...restaurantsWithDistance].sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return a.distance - b.distance;
        case "rating":
          const ratingA = a.restaurant.rating || 0;
          const ratingB = b.restaurant.rating || 0;
          if (ratingB !== ratingA) return ratingB - ratingA;
          // If ratings are equal, fall back to distance
          return a.distance - b.distance;
        case "reviews":
          const reviewsA = a.restaurant.rating_count || 0;
          const reviewsB = b.restaurant.rating_count || 0;
          if (reviewsB !== reviewsA) return reviewsB - reviewsA;
          // If reviews are equal, fall back to distance
          return a.distance - b.distance;
        case "name":
          return a.restaurant.name.localeCompare(b.restaurant.name);
        default:
          return a.distance - b.distance;
      }
    });

    return sorted.map((item) => item.restaurant);
  }, [restaurants, userLocation, sortBy]);

  // Compute next upcoming deal for smart empty state
  const nextDealInfo = useMemo(() => {
    if (sortedRestaurants.length > 0) return null;
    const restaurantNames = new Map<string, string>();
    restaurants.forEach((r) => restaurantNames.set(r.id, r.name));
    return getNextUpcomingDeal(allDeals, restaurantNames);
  }, [sortedRestaurants.length, allDeals, restaurants]);

  const renderRestaurant = useCallback(({ item }: { item: Restaurant }) => {
    const isSelected = selectedRestaurant?.id === item.id;

    return (
      <RestaurantCard
        restaurant={item}
        isSelected={isSelected}
        onPress={() => onRestaurantPress(item)}
        userLocation={userLocation}
        deals={dealsMap.get(item.id) || []}
      />
    );
  }, [selectedRestaurant, onRestaurantPress, userLocation, dealsMap]);

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: "Distance", value: "distance" },
    { label: "Rating", value: "rating" },
    { label: "Most Reviews", value: "reviews" },
    { label: "Name", value: "name" },
  ];

  return (
    <View style={styles.listBackground}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Near You</Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-vertical" size={18} color="#666" />
          <Text style={styles.sortButtonText}>
            {sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && restaurants.length === 0 ? (
        <View style={styles.listContainer}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="restaurant-card" />
          ))}
        </View>
      ) : (
        <FlatList
          testID="restaurant-flatlist"
          data={sortedRestaurants}
          renderItem={renderRestaurant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            sortedRestaurants.length === 0 && styles.emptyListContainer,
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.listBackground}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={10}
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
              <Ionicons name="restaurant-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateTitle}>No deals right now</Text>
              {nextDealInfo ? (
                <Text style={styles.emptyStateSubtitle}>
                  Next: {nextDealInfo.deal.title} at {nextDealInfo.restaurantName} starts at {nextDealInfo.startTimeFormatted}
                </Text>
              ) : (
                <Text style={styles.emptyStateSubtitle}>
                  Check back later for upcoming deals nearby
                </Text>
              )}
            </View>
          }
        />
      )}

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortBy === option.value && styles.sortOptionSelected,
                ]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortModal(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === option.value && styles.sortOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Ionicons name="checkmark" size={20} color="#FE902A" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  listBackground: {
    backgroundColor: "#f5f5f5",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#f5f5f5",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "80%",
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionSelected: {
    backgroundColor: "#FFF5EB",
  },
  sortOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  sortOptionTextSelected: {
    color: "#FE902A",
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    height: 140,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: "#FE902A",
  },
  cardPartner: {
    borderColor: "#FFD54F",
    shadowColor: "#FFD54F",
    shadowOpacity: 0.3,
  },
  imageContainer: {
    width: 120,
    height: "100%",
    backgroundColor: "#f5f5f5",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-start",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  partnerTag: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partnerTagText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1E88E5",
  },
  cardFooter: {
    marginTop: "auto", // Push to bottom - This container ALWAYS exists
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    // Removed flexWrap to prevent height expansion
  },
  distance: {
    fontSize: 13,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "500",
    marginRight: 6,
  },
  separator: {
    fontSize: 13,
    color: "#ccc",
    marginHorizontal: 0, // Handled by gap/margin
    marginRight: 6,
  },
  cuisine: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    maxWidth: 80, // Limit width
  },
  location: {
    fontSize: 13,
    color: "#999",
    flex: 1, // Take remaining space
  },
  dealsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dealPill: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: "65%",
  },
  dealPillText: {
    fontSize: 12,
    color: "#FE902A",
    fontWeight: "600",
  },
});