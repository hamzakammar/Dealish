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

  // Track view changes briefly so the native side captures the bitmap AFTER
  // the Image asset has loaded, then disable tracking so panning stays cheap.
  // Without this, Android renders empty markers.
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), 500);
    return () => clearTimeout(t);
  }, [markerKey, size]);

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
        {...(Platform.OS === "android" && { collapsable: false, renderToHardwareTextureAndroid: true })}
      >
        <Image
          source={MARKER_ASSETS[markerKey]}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}
