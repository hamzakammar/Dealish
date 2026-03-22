import { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Platform, PixelRatio } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number; // 0.6–1.4 from zoom level
};

const isAndroid = Platform.OS === "android";

// Round to nearest pixel for crisp rendering on all densities (fixes Samsung crop)
const rnd = (n: number) => PixelRatio.roundToNearestPixel(n);

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);
  const s = Math.max(0.5, Math.min(1.6, scale)); // clamp scale

  // Android: re-arm tracksViewChanges on prop changes so bitmap updates
  const [tracksViewChanges, setTracksViewChanges] = useState(isAndroid);

  // Force re-arm on initial mount — fixes markers not rendering correctly on first load
  useEffect(() => {
    if (isAndroid) {
      setTracksViewChanges(true);
      const timer = setTimeout(() => setTracksViewChanges(false), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Re-arm on prop changes
  useEffect(() => {
    if (isAndroid) {
      setTracksViewChanges(true);
      const timer = setTimeout(() => setTracksViewChanges(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isSelected, hasActiveDeal, s]);

  const handleMarkerPress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  if (restaurant.lat == null || restaurant.lng == null || isNaN(restaurant.lat) || isNaN(restaurant.lng)) {
    return null;
  }

  // Samsung fix: explicit pixel-rounded dimensions + overflow visible
  const androidWrapperProps = isAndroid
    ? { collapsable: false as const, renderToHardwareTextureAndroid: true }
    : {};

  // Scaled sizes
  const dotSize = rnd(26 * s);
  const dotBorder = rnd(2.5 * s);
  const circleSize = rnd(36 * s);
  const circleBorder = rnd(2.5 * s);
  const iconSize = rnd((isPartner ? 20 : 18) * s);
  const glowSize = rnd(36 * s);
  const glowLargeSize = rnd(44 * s);
  const wrapperPad = rnd(10 * s); // generous wrapper padding to avoid crop

  if (!hasActiveDeal) {
    return (
      <Marker
        coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
        onPress={handleMarkerPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        tappable={true}
      >
        <View
          style={{ width: dotSize + wrapperPad * 2, height: dotSize + wrapperPad * 2, alignItems: "center", justifyContent: "center" }}
          {...androidWrapperProps}
        >
          {isPartner && (
            <View style={{
              position: "absolute",
              width: glowSize, height: glowSize, borderRadius: glowSize / 2,
              backgroundColor: "#FFD54F", opacity: 0.5,
            }} />
          )}
          <View style={{
            width: dotSize, height: dotSize, borderRadius: dotSize / 2,
            backgroundColor: isSelected ? "#FF6B00" : "#FE902A",
            borderWidth: dotBorder,
            borderColor: isPartner ? "#FFD54F" : "#fff",
          }} />
        </View>
      </Marker>
    );
  }

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      tappable={true}
    >
      <View
        style={{ width: circleSize + wrapperPad * 2, height: circleSize + wrapperPad * 2, alignItems: "center", justifyContent: "center" }}
        {...androidWrapperProps}
      >
        {isPartner && (
          <View style={{
            position: "absolute",
            width: glowLargeSize, height: glowLargeSize, borderRadius: glowLargeSize / 2,
            backgroundColor: "#FFD54F", opacity: 0.4,
          }} />
        )}
        <View style={{
          width: circleSize, height: circleSize, borderRadius: circleSize / 2,
          backgroundColor: isSelected ? "#FF6B00" : "#FE902A",
          borderWidth: circleBorder,
          borderColor: isPartner ? "#FFD54F" : "#fff",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="pricetag" size={iconSize} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({});
