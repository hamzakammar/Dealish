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
// Static PNGs eliminate all Samsung/Android bitmap rendering issues.
const MARKER_IMAGES = {
  deal:         require('@/assets/images/marker-deal.png'),
  dealSelected: require('@/assets/images/marker-deal-selected.png'),
  dot:          require('@/assets/images/marker-dot.png'),
  dotSelected:  require('@/assets/images/marker-dot-selected.png'),
};

// Base display sizes in logical pixels
const DEAL_SIZE = 32;
const DOT_SIZE  = 20;

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  // Scale is computed in map.tsx from latitudeDelta — all markers get the same
  // value in the same render pass, so no size inconsistency is possible.
  const s = Math.max(0.5, Math.min(1.6, scale));
  const size = Math.round((hasActiveDeal ? DEAL_SIZE : DOT_SIZE) * s);

  const image = hasActiveDeal
    ? (isSelected ? MARKER_IMAGES.dealSelected : MARKER_IMAGES.deal)
    : (isSelected ? MARKER_IMAGES.dotSelected  : MARKER_IMAGES.dot);

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
    />
  );
}
