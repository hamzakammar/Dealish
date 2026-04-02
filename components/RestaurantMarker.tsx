import { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean;
  scale?: number;
};

const isAndroid = Platform.OS === "android";

// Base sizes
const DOT_SIZE = 18;
const DOT_PARTNER_SIZE = 22;
const DEAL_SIZE = 26;
const DEAL_PARTNER_SIZE = 30;

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
  scale = 1,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);
  
  // Clamp scale: 1.0 minimum (current small), 2.0 maximum (zoomed in)
  const s = Math.max(1.0, Math.min(2.0, scale));

  const handleMarkerPress = React.useCallback(() => {
    onPress(restaurant);
  }, [restaurant, onPress]);

  // Android-safe wrapper props
  const androidWrapperProps = isAndroid
    ? { collapsable: false as const, renderToHardwareTextureAndroid: true }
    : {};

  // Compute scaled sizes
  const sizes = useMemo(() => {
    const dotSize = Math.round(DOT_SIZE * s);
    const dotPartnerSize = Math.round(DOT_PARTNER_SIZE * s);
    const dealSize = Math.round(DEAL_SIZE * s);
    const dealPartnerSize = Math.round(DEAL_PARTNER_SIZE * s);
    const glowSize = Math.round(dotPartnerSize * 1.5);
    const glowLargeSize = Math.round(dealPartnerSize * 1.4);
    const wrapperSize = Math.round(44 * s);
    const dealWrapperSize = Math.round(48 * s);
    const iconSize = Math.round((isPartner ? 14 : 12) * s);
    
    return {
      dotSize,
      dotPartnerSize,
      dealSize,
      dealPartnerSize,
      glowSize,
      glowLargeSize,
      wrapperSize,
      dealWrapperSize,
      iconSize,
      borderWidth: Math.max(1.5, 2 * s),
      borderWidthPartner: Math.max(2, 2.5 * s),
    };
  }, [s, isPartner]);

  // No active deal → orange dot
  if (!hasActiveDeal) {
    const size = isPartner ? sizes.dotPartnerSize : sizes.dotSize;
    const selectedSize = Math.round(size * 1.15);
    
    return (
      <Marker
        coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
        onPress={handleMarkerPress}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={isAndroid}
        tappable={true}
      >
        <View 
          style={[styles.dotWrapper, { width: sizes.wrapperSize, height: sizes.wrapperSize }]} 
          {...androidWrapperProps}
        >
          {isPartner && (
            <View style={[
              styles.partnerGlow,
              { width: sizes.glowSize, height: sizes.glowSize, borderRadius: sizes.glowSize / 2 }
            ]} />
          )}
          <View
            style={[
              styles.markerDot,
              {
                width: isSelected ? selectedSize : size,
                height: isSelected ? selectedSize : size,
                borderRadius: (isSelected ? selectedSize : size) / 2,
                borderWidth: sizes.borderWidth,
                borderColor: isPartner ? "#FFD54F" : "#fff",
              },
            ]}
          />
        </View>
      </Marker>
    );
  }

  // Active deal → circle with pricetag icon
  const size = isPartner ? sizes.dealPartnerSize : sizes.dealSize;
  const selectedSize = Math.round(size * 1.1);
  const finalSize = isSelected ? selectedSize : size;

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={isAndroid}
      tappable={true}
    >
      <View 
        style={[styles.dealMarkerWrapper, { width: sizes.dealWrapperSize, height: sizes.dealWrapperSize }]} 
        {...androidWrapperProps}
      >
        {isPartner && (
          <View style={[
            styles.partnerGlowLarge,
            { width: sizes.glowLargeSize, height: sizes.glowLargeSize, borderRadius: sizes.glowLargeSize / 2 }
          ]} />
        )}
        <View
          style={[
            styles.markerCircle,
            {
              width: finalSize,
              height: finalSize,
              borderRadius: finalSize / 2,
              borderWidth: sizes.borderWidthPartner,
              borderColor: isPartner ? "#FFD54F" : "#fff",
            },
          ]}
        >
          <Ionicons name="pricetag" size={sizes.iconSize} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dotWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  dealMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  partnerGlow: {
    position: "absolute",
    backgroundColor: "#FFD54F",
    opacity: 0.5,
  },

  partnerGlowLarge: {
    position: "absolute",
    backgroundColor: "#FFD54F",
    opacity: 0.4,
  },

  markerDot: {
    backgroundColor: "#FE902A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },

  markerCircle: {
    backgroundColor: "#FE902A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
