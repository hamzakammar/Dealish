import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";

interface RatingDisplayProps {
  rating?: number;
  ratingCount?: number;
  size?: number;
  showCount?: boolean;
  textColor?: string;
}

export default function RatingDisplay({
  rating,
  ratingCount,
  size = 14,
  showCount = true,
  textColor = "#666"
}: RatingDisplayProps) {
  // Don't show anything if no rating data at all
  if (rating === null || rating === undefined) return null;

  // Round to nearest half star for display
  const roundedRating = Math.round(rating * 2) / 2;
  const fullStars = Math.floor(roundedRating);
  const hasHalfStar = roundedRating % 1 === 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  // If rating is 0 but we have rating counts, show empty stars
  const showEmptyStars = rating === 0 && ratingCount && ratingCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, index) => (
          <AntDesign
            key={`full-${index}`}
            name="star"
            size={size}
            color="#FFD700"
          />
        ))}

        {/* Half star - simplified for React Native */}
        {hasHalfStar && (
          <AntDesign
            name="star"
            size={size}
            color="#FFD700"
          />
        )}

        {/* Empty stars - show all 5 if rating is 0 but has counts, or remaining empty stars */}
        {Array.from({ length: showEmptyStars ? 5 : emptyStars }).map((_, index) => (
          <AntDesign
            key={`empty-${index}`}
            name="star"
            size={size}
            color="#E0E0E0"
          />
        ))}
      </View>

      {showCount && ratingCount !== undefined && ratingCount !== null && (
        <Text style={[styles.ratingCount, { fontSize: size - 2, color: textColor }]}>
          ({ratingCount})
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingCount: {
    color: "#666",
    fontWeight: "500",
    marginLeft: 2,
  },
});