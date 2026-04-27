import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Image, PixelRatio, Platform, View } from "react-native";
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

const rnd = (n: number) => PixelRatio.roundToNearestPixel(n);
const MARKER_SIZE = rnd(28);
const SELECTED_SIZE = rnd(36);

// Render once at the top of any screen that uses RestaurantMarker. Forces
// Android to decode the marker PNGs before any <Marker> mounts, which closes
// the race where tracksViewChanges flips off before the asset is ready and
// produces clickable-but-invisible markers in production builds.
export function MarkerAssetsWarmup() {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
    >
      <Image source={MARKER_ASSETS.deal} style={{ width: 1, height: 1 }} fadeDuration={0} />
      <Image source={MARKER_ASSETS.dealSelected} style={{ width: 1, height: 1 }} fadeDuration={0} />
      <Image source={MARKER_ASSETS.dot} style={{ width: 1, height: 1 }} fadeDuration={0} />
      <Image source={MARKER_ASSETS.dotSelected} style={{ width: 1, height: 1 }} fadeDuration={0} />
    </View>
  );
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const markerKey = hasActiveDeal
    ? isSelected ? "dealSelected" : "deal"
    : isSelected ? "dotSelected" : "dot";

  const size = isSelected ? SELECTED_SIZE : MARKER_SIZE;

  // Track view changes until the Image actually decodes, then one more frame
  // so the native side snapshots the loaded bitmap. A fixed timeout races the
  // decode on prod Android (Hermes) and produces invisible markers.
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => { setTracking(true); }, [markerKey, size]);
  const handleImageLoad = React.useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTracking(false)));
  }, []);

  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null) return null;

  return (
    <Marker
      key={`${restaurant.id}-${markerKey}`}
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      tappable={true}
    >
      <View
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
        {...(Platform.OS === "android" && { collapsable: false })}
      >
        <Image
          source={MARKER_ASSETS[markerKey]}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onLoad={handleImageLoad}
          fadeDuration={0}
        />
      </View>
    </Marker>
  );
}
