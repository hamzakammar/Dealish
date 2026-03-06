import RatingDisplay from "@/components/RatingDisplay";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

interface RecentActivityCardProps {
  logo?: string;
  name: string;
  description: string;
  date: string;
  rating?: number;
  ratingCount?: number;
}

export function RecentActivityCard({ logo, name, description, date, rating, ratingCount }: RecentActivityCardProps) {
  const colors = useThemeColors();
  const [imageError, setImageError] = useState(false);

  const dynamicStyles = useMemo(() => StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    logoContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      marginRight: 14,
      overflow: "hidden",
    },
    name: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 2,
    },
    date: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 4,
    },
  }), [colors]);

  return (
    <View style={dynamicStyles.card}>
      <View style={dynamicStyles.logoContainer}>
        {logo && !imageError ? (
          <Image 
            source={{ uri: logo }} 
            style={styles.logo} 
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="restaurant-outline" size={24} color={colors.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={dynamicStyles.name}>{name}</Text>
        <RatingDisplay
          rating={rating}
          ratingCount={ratingCount}
          size={10}
          showCount={false}
        />
        <Text style={dynamicStyles.description}>{description}</Text>
        <Text style={dynamicStyles.date}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  logoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
  },
});
