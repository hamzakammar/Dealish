import { Restaurant } from "@/types/restaurant";
import React from "react";
import { Platform, Image, ImageSourcePropType, View } from "react-native";

const Marker = (Platform.OS === 'web' ? null : require("react-native-maps").Marker) as any;

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

const MARKER_IMAGES = {
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
  if (Platform.OS === 'web') return null;

  React.useEffect(() => {
    const allImages: ImageSourcePropType[] = [
      MARKER_IMAGES.deal.normal,
      MARKER_IMAGES.deal.selected,
      MARKER_IMAGES.dot.normal,
      MARKER_IMAGES.dot.selected,
    ];
    allImages.forEach(src => Image.prefetch(Image.resolveAssetSource(src).uri));
  }, []);

  return null;
}

function getMarkerImage(hasActiveDeal: boolean, isSelected: boolean): ImageSourcePropType {
  const markerType = hasActiveDeal ? "deal" : "dot";
  const selectionState = isSelected ? "selected" : "normal";
  return MARKER_IMAGES[markerType][selectionState];
}

function getMarkerSize(hasActiveDeal: boolean, isSelected: boolean, scale: number): number {
  const base = hasActiveDeal ? 28 : 18;
  const selected = isSelected ? base + 6 : base;
  return Math.round(selected * Math.max(0.6, Math.min(1.3, scale)));
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
  if (Platform.OS === 'web' || !Marker) return null;

  const markerImage = getMarkerImage(hasActiveDeal, isSelected);
  const size = getMarkerSize(hasActiveDeal, isSelected, scale);

  const [tracked, setTracked] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setTracked(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      key={`${restaurant.id}-${isSelected}-${hasActiveDeal}`}
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      tappable={true}
    >
      <View style={{ width: size, height: size }}>
        <Image
          source={markerImage}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}
