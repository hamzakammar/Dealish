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
// Static PNGs are 96x96 (deal) and 48x48 (dot) physical pixels.
// We use require() which gives us the asset module — Google Maps accepts
// { uri, width, height } or a require() directly. We use require() + explicit
// width/height via a wrapper to control logical display size.
const MARKER_IMAGES = {
  deal:         require('@/assets/images/marker-deal.png'),
  dealSelected: require('@/assets/images/marker-deal-selected.png'),
  dot:          require('@/assets/images/marker-dot.png'),
  dotSelected:  require('@/assets/images/marker-dot-selected.png'),
};

// Fixed display sizes in logical pixels — no zoom scaling.
// Zoom scaling via state caused size inconsistency between markers
// (some rendered before scale update, some after).
const DEAL_SIZE = 32;
const DOT_SIZE  = 20;

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const image = hasActiveDeal
    ? (isSelected ? MARKER_IMAGES.dealSelected : MARKER_IMAGES.deal)
    : (isSelected ? MARKER_IMAGES.dotSelected  : MARKER_IMAGES.dot);

  const size = hasActiveDeal ? DEAL_SIZE : DOT_SIZE;

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
