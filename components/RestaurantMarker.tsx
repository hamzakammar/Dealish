import { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
};

const isAndroid = Platform.OS === "android";

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);

  // Android: tracksViewChanges must start true to capture bitmap, then false to prevent re-render glitches.
  // Re-arm whenever isSelected or hasActiveDeal changes so the marker bitmap updates.
  const [tracksViewChanges, setTracksViewChanges] = useState(isAndroid);
  useEffect(() => {
    if (isAndroid) {
      setTracksViewChanges(true);
      const timer = setTimeout(() => setTracksViewChanges(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isSelected, hasActiveDeal]);

  const handleMarkerPress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  // Guard against invalid coordinates
  if (restaurant.lat == null || restaurant.lng == null || isNaN(restaurant.lat) || isNaN(restaurant.lng)) {
    return null;
  }

  // Android-safe wrapper props
  const androidWrapperProps = isAndroid
    ? { collapsable: false as const, renderToHardwareTextureAndroid: true }
    : {};

  // ── No active deal → orange dot ──
  if (!hasActiveDeal) {
    return (
      <Marker
        coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
        onPress={handleMarkerPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        tappable={true}
      >
        <View style={styles.dotWrapper} {...androidWrapperProps}>
          {isPartner && <View style={styles.partnerGlow} />}
          <View
            style={[
              styles.markerDot,
              isPartner && styles.markerDotPartner,
              isSelected && styles.markerDotSelected,
            ]}
          />
        </View>
      </Marker>
    );
  }

  // ── Active deal → circle with pricetag icon ──
  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      tappable={true}
    >
      <View style={styles.dealMarkerWrapper} {...androidWrapperProps}>
        {isPartner && <View style={styles.partnerGlowLarge} />}
        <View
          style={[
            styles.markerCircle,
            isPartner && styles.markerCirclePartner,
            isSelected && styles.markerCircleSelected,
          ]}
        >
          <Ionicons name="pricetag" size={isPartner ? 20 : 18} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dotWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  dealMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
  },
  partnerGlow: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFD54F",
    opacity: 0.5,
  },
  partnerGlowLarge: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD54F",
    opacity: 0.4,
  },
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FE902A",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  markerDotPartner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: "#FFD54F",
    borderWidth: 3,
  },
  markerDotSelected: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
  },
  markerCircle: {
    backgroundColor: "#FE902A",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  markerCirclePartner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#FFD54F",
  },
  markerCircleSelected: {
    borderWidth: 3,
    borderColor: "#fff",
  },
});
