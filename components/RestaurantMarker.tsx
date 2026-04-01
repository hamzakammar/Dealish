import { Restaurant } from "@/types/restaurant";
import React, { useMemo } from "react";
import { PixelRatio } from "react-native";
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
 * Encode a string to base64 — works in React Native (no Buffer/atob needed).
 * We use a simple lookup table approach that is pure JS.
 */
function toBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  const bytes = [];
  for (let j = 0; j < str.length; j++) {
    const code = str.charCodeAt(j);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push((code >> 6) | 192, (code & 63) | 128);
    } else {
      bytes.push((code >> 12) | 224, ((code >> 6) & 63) | 128, (code & 63) | 128);
    }
  }
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    const b1 = bytes[i++] ?? 0;
    const b2 = bytes[i++] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i - 2 <= bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i - 1 <= bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}

/**
 * Generate a marker SVG as a base64 data URI.
 *
 * Base64 encoding (not percent-encoding) is the safest format for Android —
 * it avoids all URI parsing ambiguity on Samsung and older Google Maps SDK versions.
 *
 * Using image={{ uri }} instead of a child View means Google Maps receives a
 * pre-rendered bitmap — no React Native layout thread, no snapshot race, no crop.
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

  // Padding so stroke/glow doesn't clip at canvas edge
  const pad = Math.round(px * 0.18);
  const total = px + pad * 2;
  const cx = total / 2;
  const cy = total / 2;
  const r = px / 2;

  const fillColor = isSelected ? "#FF6B00" : "#FE902A";
  const borderColor = isPartner ? "#FFD54F" : "#FFFFFF";
  const borderWidth = Math.max(2, px * 0.07);

  let svg: string;

  if (!hasActiveDeal) {
    const dotR = px * 0.36;
    svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">`,
      isPartner ? `<circle cx="${cx}" cy="${cy}" r="${dotR * 1.45}" fill="#FFD54F" opacity="0.5"/>` : '',
      `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`,
      `</svg>`,
    ].join('');
  } else {
    const iconSize = r * 1.04;
    const iconX = cx - iconSize / 2;
    const iconY = cy - iconSize / 2;
    svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">`,
      isPartner ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.25}" fill="#FFD54F" opacity="0.4"/>` : '',
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}" stroke="${borderColor}" stroke-width="${borderWidth}"/>`,
      `<g transform="translate(${iconX},${iconY}) scale(${iconSize / 512})">`,
      `<path d="${PRICETAG_PATH}" fill="#FFFFFF"/>`,
      `</g>`,
      `</svg>`,
    ].join('');
  }

  // Base64 encode — universally safe on all Android versions and Samsung devices
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
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

  // Base size in logical pixels
  const size = hasActiveDeal ? 36 * s : 26 * s;

  const imageUri = useMemo(
    () => makeMarkerUri({ hasActiveDeal, isSelected, isPartner, size, pixelRatio }),
    [hasActiveDeal, isSelected, isPartner, size, pixelRatio]
  );

  // The SVG canvas is (size * pixelRatio + 2*pad) physical pixels.
  // Pass the equivalent in logical pixels so Google Maps renders at correct size
  // on ALL devices (Pixel 3x DPR, Samsung 2x DPR, etc.)
  const pad = Math.round(size * pixelRatio * 0.18);
  const totalPx = Math.round(size * pixelRatio) + pad * 2;
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
      image={{ uri: imageUri, width: totalLogical, height: totalLogical }}
      tracksViewChanges={false}
      tappable={true}
    />
  );
}
