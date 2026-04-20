import { Restaurant } from "@/types/restaurant";
import React, { useMemo } from "react";
import { Image, Platform } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

// Pre-baked PNG assets — static images are the only reliable marker format on
// all Android devices. Using image= prop with tracksViewChanges={false} bypasses
// the React Native layout thread entirely, eliminating the Samsung/Android bitmap
// snapshot race condition that causes "pizza slice" cropping.
const MARKER_ASSETS = {
  deal: require("@/assets/images/marker-deal.png"),
  dealSelected: require("@/assets/images/marker-deal-selected.png"),
  dot: require("@/assets/images/marker-dot.png"),
  dotSelected: require("@/assets/images/marker-dot-selected.png"),
};

// Resolve require() assets to { uri } once at module load so we can attach
// width/height at render time for zoom scaling.
const MARKER_URIS = {
  deal: Image.resolveAssetSource(MARKER_ASSETS.deal).uri,
  dealSelected: Image.resolveAssetSource(MARKER_ASSETS.dealSelected).uri,
  dot: Image.resolveAssetSource(MARKER_ASSETS.dot).uri,
  dotSelected: Image.resolveAssetSource(MARKER_ASSETS.dotSelected).uri,
};

// Base sizes in logical pixels (dp)
const DEAL_SIZE = 32;
const DEAL_PARTNER_SIZE = 36;
const DOT_SIZE = 16;
const DOT_PARTNER_SIZE = 20;

const isAndroid = Platform.OS === "android";

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);
  // Clamp scale
  const s = Math.max(0.8, Math.min(1.5, scale));

  const markerKey = hasActiveDeal
    ? isSelected ? "dealSelected" : "deal"
    : isSelected ? "dotSelected" : "dot";

  // Partner markers are slightly larger
  let baseSize: number;
  if (hasActiveDeal) {
    baseSize = isPartner ? DEAL_PARTNER_SIZE : DEAL_SIZE;
  } else {
    baseSize = isPartner ? DOT_PARTNER_SIZE : DOT_SIZE;
  }

  const selectedMultiplier = isSelected ? 1.15 : 1;
  const displaySize = Math.round(baseSize * s * selectedMultiplier);

  // On Android: use { uri, width, height } so the native marker knows the
  // desired display size. This works with tracksViewChanges={false} because
  // the size is baked into the image descriptor, not the React view.
  // On iOS: use require() directly — iOS handles marker sizing correctly.
  const image = useMemo(() => {
    if (isAndroid) {
      return {
        uri: MARKER_URIS[markerKey],
        width: displaySize,
        height: displaySize,
      };
    }
    return MARKER_ASSETS[markerKey];
  }, [markerKey, displaySize]);

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

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
