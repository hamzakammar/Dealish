import { Restaurant } from "@/types/restaurant";
import React, { memo, useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
  mapIsTransitioning?: boolean;
};

const MARKER_IMAGES = {
  deal:         require('@/assets/images/marker-deal.png'),
  dealSelected: require('@/assets/images/marker-deal-selected.png'),
  dot:          require('@/assets/images/marker-dot.png'),
  dotSelected:  require('@/assets/images/marker-dot-selected.png'),
};

const DEAL_SIZE = 32;
const DOT_SIZE  = 20;

function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const s = Math.max(0.5, Math.min(1.6, scale));
  const size = Math.round((hasActiveDeal ? DEAL_SIZE : DOT_SIZE) * s);

  const source = hasActiveDeal
    ? (isSelected ? MARKER_IMAGES.dealSelected : MARKER_IMAGES.deal)
    : (isSelected ? MARKER_IMAGES.dotSelected  : MARKER_IMAGES.dot);

  // tracksViewChanges: must be true briefly when size changes so Google Maps
  // re-snapshots the marker. We flip it true for one frame then back to false.
  // This is the standard pattern for dynamic-size markers on Android.
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const prevSizeRef = useRef(size);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevSizeRef.current !== size) {
      prevSizeRef.current = size;
      setTracksViewChanges(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTracksViewChanges(false), 100);
    }
  }, [size]);

  // Initial mount: disable tracking after first render
  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 300);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
      tracksViewChanges={tracksViewChanges}
      tappable={true}
    >
      <View style={{ width: size, height: size }}>
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    </Marker>
  );
}

export default memo(RestaurantMarker);
