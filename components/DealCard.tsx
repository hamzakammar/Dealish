import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Deal } from "@/types/restaurant";

type DealCardProps = {
  deal: Deal;
};

export default function DealCard({ deal }: DealCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isActive = () => {
    if (!deal.start_at && !deal.end_at) return true;
    const now = new Date();
    if (deal.start_at && new Date(deal.start_at) > now) return false;
    if (deal.end_at && new Date(deal.end_at) < now) return false;
    return true;
  };

  return (
    <View style={styles.dealCard}>
      <View style={styles.dealHeader}>
        <Text style={styles.dealTitle}>{deal.title}</Text>
        {!isActive() && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredText}>Expired</Text>
          </View>
        )}
      </View>

      {deal.description && (
        <Text style={styles.dealDescription}>{deal.description}</Text>
      )}

      {deal.tags && deal.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {deal.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {(deal.start_at || deal.end_at) && (
        <View style={styles.dateContainer}>
          {deal.start_at && (
            <View style={styles.dateRow}>
              <AntDesign name="calendar" size={12} color="#666" />
              <Text style={styles.dateText}>
                Starts: {formatDate(deal.start_at)}
              </Text>
            </View>
          )}
          {deal.end_at && (
            <View style={styles.dateRow}>
              <AntDesign name="calendar" size={12} color="#666" />
              <Text style={styles.dateText}>
                Ends: {formatDate(deal.end_at)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dealCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  expiredBadge: {
    backgroundColor: "#ffebee",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expiredText: {
    color: "#c62828",
    fontSize: 10,
    fontWeight: "600",
  },
  dealDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 6,
  },
  tag: {
    backgroundColor: "#FE902A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  dateContainer: {
    marginTop: 4,
    gap: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: "#666",
  },
});