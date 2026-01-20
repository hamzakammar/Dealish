import { useRestaurantDeals } from "@/hooks/useRestaurantDeals";
import { Restaurant, UserLocation } from "@/types/restaurant";
import { calculateDistance, formatDistance } from "@/utils/distance";
import RatingDisplay from "@/components/RatingDisplay";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface RestaurantListProps {
  restaurants: Restaurant[];
  onRestaurantPress: (restaurant: Restaurant) => void;
  selectedRestaurant: Restaurant | null;
  userLocation?: UserLocation | null;
}

function RestaurantCard({
  restaurant,
  isSelected,
  onPress,
  userLocation,
}: {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: () => void;
  userLocation?: UserLocation | null;
}) {
  const { deals, loading: dealsLoading } = useRestaurantDeals(restaurant.id);

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

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: restaurant.logo_url || restaurant.image_url }}
        style={styles.image}
      />
      <View style={styles.content}>
        <View>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
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
              {restaurant.cuisine_type}
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
          {dealsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FE902A" />
            </View>
          ) : deals.length > 0 ? (
            <View style={styles.dealsRow}>
              {deals.slice(0, 2).map((deal, index) => (
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
}

export default function RestaurantList({
  restaurants,
  onRestaurantPress,
  selectedRestaurant,
  userLocation,
}: RestaurantListProps) {
  const renderRestaurant = ({ item }: { item: Restaurant }) => {
    const isSelected = selectedRestaurant?.id === item.id;

    return (
      <RestaurantCard
        restaurant={item}
        isSelected={isSelected}
        onPress={() => onRestaurantPress(item)}
        userLocation={userLocation}
      />
    );
  };

  return (
    <FlatList
      data={restaurants}
      renderItem={renderRestaurant}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      style={styles.listBackground}
    />
  );
}

const styles = StyleSheet.create({
  listBackground: {
    backgroundColor: "#f5f5f5",
  },
  listContainer: {
    padding: 16,
    paddingTop: 100,
    paddingBottom: 100,
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
    height: 140, // Fixed height instead of minHeight
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden", // Ensure content doesn't overflow
  },
  cardSelected: {
    borderColor: "#FE902A",
  },
  image: {
    width: 120,
    height: "100%",
    backgroundColor: "#f0f0f0",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-start", // Keep content at the top
  },
  cardFooter: {
    marginTop: "auto", // Push to bottom - This container ALWAYS exists
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
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
  loadingContainer: {
    paddingVertical: 4,
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