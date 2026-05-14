import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

// No-op warmup — kept for API compatibility, no longer needed without PNG assets
export function MarkerAssetsWarmup() {
  return null;
}

function MarkerView({
  isSelected,
  hasActiveDeal,
  isPartner,
}: {
  isSelected: boolean;
  hasActiveDeal: boolean;
  isPartner: boolean;
}) {
  if (!hasActiveDeal && !isPartner) {
    // Plain dot — restaurant with no active deal, not a partner
    return (
      <View
        style={[
          styles.dot,
          isSelected && styles.dotSelected,
        ]}
        {...(Platform.OS === "android" && { collapsable: false })}
      />
    );
  }

  return (
    <View
      style={[
        styles.bubble,
        isPartner && styles.bubblePartner,
        isSelected && styles.bubbleSelected,
      ]}
      {...(Platform.OS === "android" && { collapsable: false })}
    >
      {hasActiveDeal && (
        <Text style={styles.dealLabel}>%</Text>
      )}
      {isPartner && !hasActiveDeal && (
        <Text style={styles.partnerLabel}>★</Text>
      )}
      {isPartner && hasActiveDeal && (
        <Text style={styles.dealLabel}>%</Text>
      )}
    </View>
  );
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null) return null;

  return (
    <Marker
      key={`${restaurant.id}-${isSelected}-${hasActiveDeal}`}
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 1.0 }}
      tracksViewChanges={false}
      tappable={true}
    >
      <MarkerView
        isSelected={isSelected}
        hasActiveDeal={hasActiveDeal}
        isPartner={isPartner}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  // Plain gray dot — no deal, not a partner
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#AAAAAA",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  dotSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#888888",
  },

  // Deal / partner bubble
  bubble: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FE902A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  bubblePartner: {
    backgroundColor: "#FE902A",
    borderColor: "#FFD700", // gold border for partners
    borderWidth: 2.5,
  },
  bubbleSelected: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  dealLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  partnerLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
