import { Restaurant } from "@/types/restaurant";
import React, { useMemo } from "react";
import { Platform, PixelRatio } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
  mapIsTransitioning?: boolean; // kept for API compat, unused
};

// Ionicons "pricetag" SVG path (from ionicons/src/svg/pricetag.svg)
// viewBox 0 0 512 512
const PRICETAG_PATH =
  "M467,45.2A44.45,44.45,0,0,0,435.29,32H312.36a30.63,30.63,0,0,0-21.52,8.89L45.09,286.59a44.82,44.82,0,0,0,0,63.32l117,117a44.83,44.83,0,0,0,63.34,0l245.65-245.6A30.6,30.6,0,0,0,480,199.8v-123A44.24,44.24,0,0,0,467,45.2ZM384,160a32,32,0,1,1,32-32A32,32,0,0,1,384,160Z";

/**
 * Generate a marker SVG as a data URI.
 *
 * Using a static image URI instead of a child View completely eliminates the
 * Android/Samsung bitmap-snapshot race condition. Google Maps receives a
 * pre-rendered bitmap with correct dimensions — no React Native layout thread
 * involvement, no tracksViewChanges juggling, no crop possible.
 */
function makeMarkerUri(opts: {
  hasActiveDeal: boolean;
  isSelected: boolean;
  isPartner: boolean;
  size: number; // outer circle diameter in logical pixels
  pixelRatio: number;
}): string {
  const { hasActiveDeal, isSelected, isPartner, size, pixelRatio } = opts;

  // Work in physical pixels for crisp output
  const px = Math.round(size * pixelRatio);

  // Padding so glow/border don't clip
  const pad = Math.round(px * 0.22);
  const total = px + pad * 2;
  const cx = total / 2;
  const cy = total / 2;
  const r = px / 2;

  const fillColor = isSelected ? "#FF6B00" : "#FE902A";
  const borderColor = isPartner ? "#FFD54F" : "#FFFFFF";
  const borderWidth = Math.max(1.5, px * 0.07);

  let svg: string;

  if (!hasActiveDeal) {
    // Small dot marker
    const dotR = px * 0.36;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">
      ${isPartner ? `<circle cx="${cx}" cy="${cy}" r="${dotR * 1.45}" fill="#FFD54F" opacity="0.5"/>` : ""}
      <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>
    </svg>`;
  } else {
    // Full circle with pricetag icon
    // Icon is scaled to fill ~52% of the circle diameter
    const iconSize = r * 1.04;
    // Center the 512x512 viewBox icon inside the circle
    const iconX = cx - iconSize / 2;
    const iconY = cy - iconSize / 2;

    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">
      ${isPartner ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.25}" fill="#FFD54F" opacity="0.4"/>` : ""}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>
      <g transform="translate(${iconX},${iconY}) scale(${iconSize / 512})">
        <path d="${PRICETAG_PATH}" fill="#FFFFFF"/>
      </g>
    </svg>`;
  }

  // Encode as data URI — only encode chars that break URI parsing
  const encoded = svg
    .replace(/\n\s*/g, " ")
    .replace(/"/g, "'")
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/ {2,}/g, " ");

  return `data:image/svg+xml,${encoded}`;
}

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);
  const s = Math.max(0.5, Math.min(1.6, scale));
  const pixelRatio = PixelRatio.get();

  // Base size: 36px for deal marker, 26px for dot — scaled
  const size = hasActiveDeal ? 36 * s : 26 * s;

  // Memoize URIs — pre-generate both selected states so swap is instant
  const imageUri = useMemo(
    () =>
      makeMarkerUri({ hasActiveDeal, isSelected, isPartner, size, pixelRatio }),
    [hasActiveDeal, isSelected, isPartner, size, pixelRatio]
  );

  // Physical pixel total size for the image prop
  const pad = Math.round(size * pixelRatio * 0.22);
  const totalPx = Math.round(size * pixelRatio) + pad * 2;
  // Convert back to logical pixels for the image dimensions
  const totalLogical = totalPx / pixelRatio;

  const handleMarkerPress = React.useCallback(() => {
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
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      // Pass explicit logical-pixel dimensions so Google Maps doesn't guess from
      // the SVG physical-pixel canvas. Without this, Pixel (3x DPR) renders the
      // marker 3x too large because the SVG canvas is in physical pixels.
      image={{ uri: imageUri, width: totalLogical, height: totalLogical }}
      tracksViewChanges={false}
      tappable={true}
    />
  );
}
