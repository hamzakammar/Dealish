import { useThemeColors } from "@/hooks/useThemeColors";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

type SkeletonVariant = "restaurant-card" | "deal-card" | "stat-card";

interface SkeletonCardProps {
  variant: SkeletonVariant;
}

function ShimmerBlock({ style }: { style?: any }) {
  const colors = useThemeColors();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const blockColor = colors.isDark ? "#3A3A3C" : "#E5E5EA";

  return (
    <Animated.View
      style={[{ backgroundColor: blockColor, borderRadius: 8 }, style, animatedStyle]}
    />
  );
}

function RestaurantCardSkeleton() {
  const colors = useThemeColors();

  return (
    <View style={[styles.restaurantCard, { backgroundColor: colors.card }]}>
      <ShimmerBlock style={styles.restaurantImage} />
      <View style={styles.restaurantContent}>
        <ShimmerBlock style={styles.restaurantTitle} />
        <ShimmerBlock style={styles.restaurantSubtitle} />
      </View>
    </View>
  );
}

function DealCardSkeleton() {
  const colors = useThemeColors();

  return (
    <View style={[styles.dealCard, { backgroundColor: colors.card }]}>
      <ShimmerBlock style={styles.dealBadge} />
      <ShimmerBlock style={styles.dealTitle} />
      <ShimmerBlock style={styles.dealSubtitle} />
    </View>
  );
}

function StatCardSkeleton() {
  const colors = useThemeColors();

  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
      <ShimmerBlock style={styles.statSquare} />
    </View>
  );
}

export default function SkeletonCard({ variant }: SkeletonCardProps) {
  switch (variant) {
    case "restaurant-card":
      return <RestaurantCardSkeleton />;
    case "deal-card":
      return <DealCardSkeleton />;
    case "stat-card":
      return <StatCardSkeleton />;
  }
}

const styles = StyleSheet.create({
  // Restaurant card skeleton
  restaurantCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    height: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  restaurantImage: {
    width: 120,
    height: "100%",
    borderRadius: 0,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  restaurantContent: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    gap: 12,
  },
  restaurantTitle: {
    height: 18,
    width: "70%",
    borderRadius: 6,
  },
  restaurantSubtitle: {
    height: 14,
    width: "50%",
    borderRadius: 6,
  },

  // Deal card skeleton
  dealCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dealBadge: {
    height: 22,
    width: 60,
    borderRadius: 6,
  },
  dealTitle: {
    height: 16,
    width: "80%",
    borderRadius: 6,
  },
  dealSubtitle: {
    height: 14,
    width: "55%",
    borderRadius: 6,
  },

  // Stat card skeleton
  statCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statSquare: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
});
