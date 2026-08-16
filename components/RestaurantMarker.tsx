import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform, Image, ImageSourcePropType, View } from "react-native";

const Marker = (Platform.OS === 'web' ? null : require("react-native-maps").Marker) as any;

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  isPartner: boolean;
  scale?: number;
};

const MARKER_IMAGES = {
  "partner-deal": {
    normal: require("@/assets/images/marker-partner-deal.png"),
    selected: require("@/assets/images/marker-partner-deal-selected.png"),
  },
  "partner": {
    normal: require("@/assets/images/marker-partner.png"),
    selected: require("@/assets/images/marker-partner-selected.png"),
  },
  deal: {
    normal: require("@/assets/images/marker-deal.png"),
    selected: require("@/assets/images/marker-deal-selected.png"),
  },
  dot: {
    normal: require("@/assets/images/marker-dot.png"),
    selected: require("@/assets/images/marker-dot-selected.png"),
  },
};

export function MarkerAssetsWarmup() {
  // Hook must run unconditionally (rules of hooks); the web guard lives inside.
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const allImages: ImageSourcePropType[] = [
      MARKER_IMAGES["partner-deal"].normal,
      MARKER_IMAGES["partner-deal"].selected,
      MARKER_IMAGES["partner"].normal,
      MARKER_IMAGES["partner"].selected,
      MARKER_IMAGES.deal.normal,
      MARKER_IMAGES.deal.selected,
      MARKER_IMAGES.dot.normal,
      MARKER_IMAGES.dot.selected,
    ];
    allImages.forEach(src => Image.prefetch(Image.resolveAssetSource(src).uri));
  }, []);

  return null;
}

function getMarkerImage(hasActiveDeal: boolean, isPartner: boolean, isSelected: boolean): ImageSourcePropType {
  const markerType = isPartner && hasActiveDeal ? "partner-deal"
    : isPartner ? "partner"
    : hasActiveDeal ? "deal"
    : "dot";
  const selectionState = isSelected ? "selected" : "normal";
  return MARKER_IMAGES[markerType][selectionState];
}

function getMarkerSize(hasActiveDeal: boolean, isPartner: boolean, isSelected: boolean, scale: number): number {
  const base = isPartner ? 30 : hasActiveDeal ? 28 : 18;
  const selected = isSelected ? base + 6 : base;
  return Math.round(selected * Math.max(0.6, Math.min(1.3, scale)));
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  isPartner,
  scale = 1,
}: RestaurantMarkerProps) {
  const handlePress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  // Hooks must run unconditionally, before any early return (rules of hooks).
  // `tracked` re-enables tracksViewChanges only briefly so react-native-maps can
  // re-rasterize the custom pin after its image/size changes, then pins it off.
  const [tracked, setTracked] = React.useState(true);

  React.useEffect(() => {
    setTracked(true);
    const t = setTimeout(() => setTracked(false), 500);
    return () => clearTimeout(t);
  }, [isSelected, hasActiveDeal]);

  if (restaurant.lat == null || restaurant.lng == null) return null;
  if (Platform.OS === 'web' || !Marker) return null;

  const markerImage = getMarkerImage(hasActiveDeal, isPartner, isSelected);
  const size = getMarkerSize(hasActiveDeal, isPartner, isSelected, scale);
  // Keep the rasterized marker bounds constant across selection so Android does
  // not blank the pin while the image swaps — the container stays at the largest
  // (selected) size and the image is centered within it.
  const containerSize = getMarkerSize(hasActiveDeal, isPartner, true, scale);

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      tappable={true}
    >
      <View style={{ width: containerSize, height: containerSize, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={markerImage}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}
