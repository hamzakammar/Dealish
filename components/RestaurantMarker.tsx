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
        <Text style={styles.dealLabel}>$</Text>
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

  // Android needs tracksViewChanges=true briefly so the native layer
  // captures the rendered view, then we turn it off for performance.
  const [tracking, setTracking] = React.useState(Platform.OS === "android");
  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    setTracking(true);
    const t = requestAnimationFrame(() =>
      requestAnimationFrame(() => setTracking(false))
    );
    return () => cancelAnimationFrame(t);
  }, [isSelected, hasActiveDeal, isPartner]);

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
      tracksViewChanges={tracking}
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
});
