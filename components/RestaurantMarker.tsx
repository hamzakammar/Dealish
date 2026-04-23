import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

const MARKER_ASSETS = {
  deal: require("@/assets/images/marker-deal.png"),
  dealSelected: require("@/assets/images/marker-deal-selected.png"),
  dot: require("@/assets/images/marker-dot.png"),
  dotSelected: require("@/assets/images/marker-dot-selected.png"),
};

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const markerKey = hasActiveDeal
    ? isSelected ? "dealSelected" : "deal"
    : isSelected ? "dotSelected" : "dot";

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null) return null;

  return (
    <Marker
      key={`${restaurant.id}-${markerKey}`}
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 1.0 }}
      image={MARKER_ASSETS[markerKey]}
      tracksViewChanges={false}
      tappable={true}
    />
  );
}
