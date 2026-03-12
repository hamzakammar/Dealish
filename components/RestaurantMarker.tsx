import { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
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

  const handleMarkerPress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  // Guard against invalid coordinates — missing lat/lng causes invisible markers
  if (!restaurant.lat || !restaurant.lng) {
    return null;
  }

  // Android-safe wrapper props to ensure bitmap capture works
  const androidWrapperProps = isAndroid
    ? { collapsable: false as const, renderToHardwareTextureAndroid: true }
    : {};

  // ── No active deal → orange dot (partner gets gold glow + larger size) ──
  if (!hasActiveDeal) {
    return (
      <Marker
        coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
        onPress={handleMarkerPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={isPartner}
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

  // ── Active deal → circle with pricetag icon (partner gets gold glow + larger size) ──
  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
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
          <Ionicons name="pricetag" size={isPartner ? 16 : 14} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  // ── Dot wrapper — sized for a decent tap target ──
  dotWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },

  // ── Deal marker wrapper — explicit size for Android bitmap capture ──
  dealMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },

  // ── Gold glow effect for partnered restaurants ──
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFD54F",
    opacity: 0.4,
  },

  // ── Dot ──
  markerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FE902A",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
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

  // ── Circle (shared, both platforms — NO elevation) ──
  markerCircle: {
    backgroundColor: "#FE902A",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  markerCirclePartner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#FFD54F",
  },
  markerCircleSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
});
