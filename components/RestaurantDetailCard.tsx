import DealCard from "@/components/DealCard";
import { useRestaurantDeals } from "@/hooks/useRestaurantDeals";
import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Spring animation configuration for card slide-in
const SPRING_ANIMATION_TENSION = 65;
const SPRING_ANIMATION_FRICTION = 11;

// Duration for card slide-out animation when closing
const CLOSE_ANIMATION_DURATION_MS = 200;

// Vertical offset for card entrance/exit animation (pixels off-screen)
const CARD_ANIMATION_OFFSET = 600;

type RestaurantDetailCardProps = {
  restaurant: Restaurant;
  onClose: () => void;
  onGetDirections: () => void;
};

export default function RestaurantDetailCard({
  restaurant,
  onClose,
  onGetDirections,
}: RestaurantDetailCardProps) {
  const { deals, loading: dealsLoading } = useRestaurantDeals(restaurant.id);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const closingRestaurantIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset animation when restaurant changes
    slideAnim.setValue(0);
    closingRestaurantIdRef.current = null;
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: SPRING_ANIMATION_TENSION,
      friction: SPRING_ANIMATION_FRICTION,
    }).start();
  }, [restaurant.id]);

  const handleClose = () => {
    // Store the restaurant ID when close animation starts
    closingRestaurantIdRef.current = restaurant.id;
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: CLOSE_ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      // Only call onClose if the restaurant hasn't changed
      if (closingRestaurantIdRef.current === restaurant.id) {
        onClose();
      }
      closingRestaurantIdRef.current = null;
    });
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_ANIMATION_OFFSET, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.dragHandle} />

      <View style={styles.header}>
          <View style={styles.headerMain}>
            <View style={styles.logoContainer}>
              {(restaurant.logo_url || restaurant.image_url) ? (
                <Image
                  source={{ uri: restaurant.logo_url || restaurant.image_url }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.logo, styles.logoPlaceholder]}>
                  <AntDesign name="picture" size={24} color="#ccc" />
                </View>
              )}
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              {restaurant.address && (
                <View style={styles.addressRow}>
                  <AntDesign name="environment" size={14} color="#666" />
                  <Text style={styles.addressText}>{restaurant.address}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <AntDesign name="close" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {restaurant.description && (
          <View style={styles.section}>
            <Text style={styles.description}>{restaurant.description}</Text>
          </View>
        )}

        {restaurant.phone && (
          <View style={styles.infoRow}>
            <AntDesign name="phone" size={16} color="#666" />
            <Text style={styles.infoText}>{restaurant.phone}</Text>
          </View>
        )}

        <View style={styles.dealsSection}>
          <Text style={styles.sectionTitle}>Available Deals</Text>
          {dealsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FE902A" />
            </View>
          ) : deals.length > 0 ? (
            deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
          ) : (
            <View style={styles.emptyState}>
              <AntDesign name="inbox" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No deals available</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={onGetDirections}
        >
          <AntDesign
            name="arrow-right"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => {
            // Handle favorite action
            console.log("Favorite pressed");
          }}
        >
          <AntDesign name="heart" size={20} color="#FE902A" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: 600,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerMain: {
    flexDirection: "row",
    flex: 1,
    marginRight: 12,
  },
  logoContainer: {
    marginRight: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
  },
  headerContent: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
  },
  addressText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  section: {
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  dealsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  footer: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    flexDirection: "row",
    gap: 12,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: "#FE902A",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FE902A",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
});