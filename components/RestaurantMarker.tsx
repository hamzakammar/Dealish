import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
  mapIsTransitioning?: boolean; // kept for API compat, unused
};

// Pre-baked PNG assets — no SVG, no runtime generation, no encoding.
// Static PNGs are the only 100% reliable marker format on all Android devices.
// Samsung bitmap snapshot race condition is impossible with image= prop (no child view).
const MARKERS = {
  deal: require('@/assets/images/marker-deal.png'),
  dealSelected: require('@/assets/images/marker-deal-selected.png'),
  dot: require('@/assets/images/marker-dot.png'),
  dotSelected: require('@/assets/images/marker-dot-selected.png'),
};

// Rendered size in logical pixels (points)
// PNGs are 3x resolution: 96px PNG → 32dp, 48px PNG → 16dp
const DEAL_SIZE = 32;
const DOT_SIZE  = 16;

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const s = Math.max(0.5, Math.min(1.6, scale));

  const image = hasActiveDeal
    ? (isSelected ? MARKERS.dealSelected : MARKERS.deal)
    : (isSelected ? MARKERS.dotSelected : MARKERS.dot);

  const displaySize = (hasActiveDeal ? DEAL_SIZE : DOT_SIZE) * s;

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (
    restaurant.lat == null ||
    restaurant.lng == null ||
    isNaN(restaurant.lat) ||
    isNaN(restaurant.lng)
  ) {
    return null;
  }

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
      image={image}
      tracksViewChanges={false}
      tappable={true}
      style={{ width: displaySize, height: displaySize }}
    />
  );
}
