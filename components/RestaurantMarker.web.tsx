import { Restaurant } from "@/types/restaurant";

/**
 * Web-only placeholder for RestaurantMarker.
 * This prevents the Metro/Vercel bundler from attempting to load
 * react-native-maps Marker component (which is native-only).
 *
 * Mobile users will get the full marker functionality from
 * components/RestaurantMarker.tsx.
 */

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

export function MarkerAssetsWarmup() {
  return null;
}

export default function RestaurantMarker(props: RestaurantMarkerProps) {
  // No-op component for web builds
  return null;
}
