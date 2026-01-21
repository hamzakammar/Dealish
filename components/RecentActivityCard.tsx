// This is a placeholder for the RecentActivityCard component
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import RatingDisplay from "@/components/RatingDisplay";

interface RecentActivityCardProps {
  logo: string;
  name: string;
  description: string;
  date: string;
  rating?: number;
  ratingCount?: number;
}

export function RecentActivityCard({ logo, name, description, date, rating, ratingCount }: RecentActivityCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.logoContainer}>
        <Image source={{ uri: logo }} style={styles.logo} />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{name}</Text>
        <RatingDisplay
          rating={rating}
          ratingCount={ratingCount}
          size={10}
          showCount={false}
        />
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    resizeMode: "contain",
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },
  description: {
    fontSize: 15,
    color: "#666",
    marginTop: 2,
  },
  date: {
    fontSize: 13,
    color: "#aaa",
    marginTop: 4,
  },
});
