import { Restaurant } from "@/types/restaurant";
import React, { memo, useMemo } from "react";
import { PixelRatio } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
  mapIsTransitioning?: boolean;
};

const PRICETAG_PATH =
  "M467,45.2A44.45,44.45,0,0,0,435.29,32H312.36a30.63,30.63,0,0,0-21.52,8.89L45.09,286.59a44.82,44.82,0,0,0,0,63.32l117,117a44.83,44.83,0,0,0,63.34,0l245.65-245.6A30.6,30.6,0,0,0,480,199.8v-123A44.24,44.24,0,0,0,467,45.2ZM384,160a32,32,0,1,1,32-32A32,32,0,0,1,384,160Z";

function toBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let j = 0; j < str.length; j++) {
    const c = str.charCodeAt(j);
    if (c < 128) bytes.push(c);
    else if (c < 2048) bytes.push((c >> 6) | 192, (c & 63) | 128);
    else bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
  }
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i+1] ?? 0, b2 = bytes[i+2] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}

function makeMarker(opts: {
  hasActiveDeal: boolean;
  isSelected: boolean;
  isPartner: boolean;
  logicalSize: number;
  pixelRatio: number;
}): { uri: string; width: number; height: number } {
  const { hasActiveDeal, isSelected, isPartner, logicalSize, pixelRatio } = opts;

  const px = Math.round(logicalSize * pixelRatio);
  const pad = Math.round(px * 0.18);
  const total = px + pad * 2;
  const cx = total / 2;
  const cy = total / 2;
  const r = px / 2;
  const fill = isSelected ? '#FF6B00' : '#FE902A';
  const stroke = isPartner ? '#FFD54F' : '#FFFFFF';
  const sw = Math.max(2, px * 0.07);
  const totalLogical = total / pixelRatio;

  let svg: string;
  if (!hasActiveDeal) {
    const dr = px * 0.36;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">`
      + (isPartner ? `<circle cx="${cx}" cy="${cy}" r="${dr * 1.45}" fill="#FFD54F" opacity="0.5"/>` : '')
      + `<circle cx="${cx}" cy="${cy}" r="${dr}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
      + `</svg>`;
  } else {
    const iconSize = r * 1.04;
    const ix = cx - iconSize / 2;
    const iy = cy - iconSize / 2;
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">`
      + (isPartner ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.25}" fill="#FFD54F" opacity="0.4"/>` : '')
      + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
      + `<g transform="translate(${ix},${iy}) scale(${iconSize / 512})">`
      + `<path d="${PRICETAG_PATH}" fill="#FFFFFF"/>`
      + `</g></svg>`;
  }

  return {
    uri: `data:image/svg+xml;base64,${toBase64(svg)}`,
    width: totalLogical,
    height: totalLogical,
  };
}

const DEAL_BASE = 32;
const DOT_BASE  = 20;

function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);
  const s = Math.max(0.5, Math.min(1.6, scale));
  const logicalSize = Math.round((hasActiveDeal ? DEAL_BASE : DOT_BASE) * s);
  const pixelRatio = PixelRatio.get();

  const marker = useMemo(
    () => makeMarker({ hasActiveDeal, isSelected, isPartner, logicalSize, pixelRatio }),
    [hasActiveDeal, isSelected, isPartner, logicalSize, pixelRatio]
  );

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
      image={marker}
      tracksViewChanges={false}
      tappable={true}
    />
  );
}

export default memo(RestaurantMarker);
