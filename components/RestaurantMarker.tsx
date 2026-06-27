import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

// Conditionally import Marker only on native platforms
const Marker = Platform.select({
  native: () => require("react-native-maps").Marker,
  default: () => null,
})?.();

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

export function MarkerAssetsWarmup() {
  return null;
}

function MarkerView({
  isSelected,
  hasActiveDeal,
  isPartner,
  scale = 1,
}: {
  isSelected: boolean;
  hasActiveDeal: boolean;
  isPartner: boolean;
  scale?: number;
}) {
  const baseSize = isSelected ? 36 : 28;
  const size = Math.round(baseSize * scale);
  const radius = Math.round(size / 2);
  const borderW = isSelected ? 3 : isPartner ? 2.5 : 2;
  const fontSize = Math.round(13 * scale);

  return (
    <View
      style={[
        styles.bubble,
        {
          minWidth: size,
          height: size,
          borderRadius: radius,
          borderWidth: borderW,
        },
        isPartner && styles.bubblePartner,
        isSelected && styles.bubbleSelected,
      ]}
      {...(Platform.OS === "android" && { collapsable: false })}
    >
      {hasActiveDeal && (
        <Text style={[styles.dealLabel, { fontSize }]}>$</Text>
      )}
    </View>
  );
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);

  // Android: track view changes briefly after any visual prop changes
  // so the native bitmap captures correctly. Then turn off for performance.
  const [tracking, setTracking] = React.useState(Platform.OS === "android");
  const prevScaleRef = React.useRef(scale);

  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    // Only re-track if scale changed meaningfully (avoid constant re-renders during pan)
    const scaleDiff = Math.abs(scale - prevScaleRef.current);
    if (scaleDiff < 0.1 && !isSelected) {
      return;
    }
    prevScaleRef.current = scale;
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 300);
    return () => clearTimeout(t);
  }, [isSelected, hasActiveDeal, isPartner, scale]);

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null) return null;

  // On web, return null since maps are not supported
  if (!Marker) return null;

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
        scale={scale}
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
    borderColor: "#FFD700",
  },
  bubbleSelected: {
    borderWidth: 3,
  },
  dealLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
