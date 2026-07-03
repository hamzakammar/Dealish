import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform, Image, ImageSourcePropType } from "react-native";

// Only import Marker on native platforms to prevent web build failures
const Marker = (Platform.OS === 'web' ? null : require("react-native-maps").Marker) as any;

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

// Marker image assets organized by type, selection state, and size
const MARKER_IMAGES = {
  deal: {
    normal: {
      sm: require("@/assets/images/marker-deal-sm.png"),
      md: require("@/assets/images/marker-deal-md.png"),
      lg: require("@/assets/images/marker-deal-lg.png"),
    },
    selected: {
      sm: require("@/assets/images/marker-deal-selected-sm.png"),
      md: require("@/assets/images/marker-deal-selected-md.png"),
      lg: require("@/assets/images/marker-deal-selected-lg.png"),
    },
  },
  dot: {
    normal: {
      sm: require("@/assets/images/marker-dot-sm.png"),
      md: require("@/assets/images/marker-dot-md.png"),
      lg: require("@/assets/images/marker-dot-lg.png"),
    },
    selected: {
      sm: require("@/assets/images/marker-dot-selected-sm.png"),
      md: require("@/assets/images/marker-dot-selected-md.png"),
      lg: require("@/assets/images/marker-dot-selected-lg.png"),
    },
  },
};

export function MarkerAssetsWarmup() {
  // Preload all marker images
  if (Platform.OS === 'web') return null;

  React.useEffect(() => {
    const allImages: ImageSourcePropType[] = [
      ...Object.values(MARKER_IMAGES.deal.normal),
      ...Object.values(MARKER_IMAGES.deal.selected),
      ...Object.values(MARKER_IMAGES.dot.normal),
      ...Object.values(MARKER_IMAGES.dot.selected),
    ];
    allImages.forEach(src => Image.prefetch(Image.resolveAssetSource(src).uri));
  }, []);

  return null;
}

function getMarkerImage(hasActiveDeal: boolean, isSelected: boolean, scale: number): ImageSourcePropType {
  const markerType = hasActiveDeal ? "deal" : "dot";
  const selectionState = isSelected ? "selected" : "normal";

  // Select size based on scale: sm (<0.7), md (0.7-1.2), lg (>1.2)
  let size: "sm" | "md" | "lg";
  if (scale < 0.7) {
    size = "sm";
  } else if (scale > 1.2) {
    size = "lg";
  } else {
    size = "md";
  }

  return MARKER_IMAGES[markerType][selectionState][size];
}

function getMarkerSize(hasActiveDeal: boolean, scale: number): { width: number; height: number } {
  // Base sizes: dot markers are smaller than deal markers
  const baseSize = hasActiveDeal ? 64 : 32;

  // Select discrete size based on scale
  let size: number;
  if (scale < 0.7) {
    size = hasActiveDeal ? 48 : 24; // sm
  } else if (scale > 1.2) {
    size = hasActiveDeal ? 96 : 48; // lg
  } else {
    size = baseSize; // md (64 for deal, 32 for dot)
  }

  return { width: size, height: size };
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null) return null;

  // Return null on web where maps are not supported
  if (Platform.OS === 'web' || !Marker) return null;

  const markerImage = getMarkerImage(hasActiveDeal, isSelected, scale);
  const markerSize = getMarkerSize(hasActiveDeal, scale);

  return (
    <Marker
      key={`${restaurant.id}-${isSelected}-${hasActiveDeal}`}
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      tappable={true}
      image={markerImage}
    />
  );
}
