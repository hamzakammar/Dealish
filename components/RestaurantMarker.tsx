import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useMemo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, Platform } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  hasActiveDeal: boolean; // Whether restaurant has an active deal right now
};

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  hasActiveDeal,
}: RestaurantMarkerProps) {
  const isPartner = Boolean(restaurant.partner);

  const markerContent = useMemo(
    () => {
      // If no active deal, show simple orange dot
      if (!hasActiveDeal) {
        return (
          <View style={styles.markerWrapper}>
            <View
              style={[
                styles.markerDot,
                isSelected && styles.markerDotSelected,
              ]}
            />
          </View>
        );
      }

      // If has active deal, show full icon with shop icon
      return (
        <View style={styles.markerWrapper}>
          <View
            style={[
              styles.markerContainer,
              isPartner && styles.markerContainerPartner,
              isSelected && styles.markerContainerSelected,
            ]}
          >
            {isPartner && (
              <View style={styles.partnerBadge}>
                <AntDesign name="check-circle" size={12} color="#2E7D32" />
              </View>
            )}
            <AntDesign
              name="shop"
              size={18}
              color="#fff"
            />
          </View>
          {/* Use different approach for Android to avoid triangle rendering issues */}
          {Platform.OS === 'android' ? (
            <View
              style={[
                styles.markerPinAndroid,
                isPartner && styles.markerPinPartnerAndroid,
                isSelected && styles.markerPinSelected,
              ]}
            />
          ) : (
            <View
              style={[
                styles.markerPin,
                isPartner && styles.markerPinPartner,
                isSelected && styles.markerPinSelected,
              ]}
            />
          )}
        </View>
      );
    },
    [isSelected, hasActiveDeal, isPartner]
  );

  const handleMarkerPress = React.useCallback(() => {
    // Ensure onPress is called even if there's lag
    onPress(restaurant);
  }, [restaurant, onPress]);

  // Stable key prop - never changes during component lifecycle
  // This prevents unnecessary remounting that causes flicker
  const markerKey = `restaurant-${restaurant.id}`;

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      // Platform-specific tracksViewChanges:
      // iOS: false for performance (markers are static)
      // Android: true to ensure markers render properly (required for initial render)
      // Don't toggle this value - changing it causes markers to flicker/disappear
      tracksViewChanges={Platform.OS === 'ios' ? false : true}
      tappable={true}
      // Android-specific optimizations
      {...(Platform.OS === 'android' && {
        flat: false,
        centerOffset: { x: 0, y: 0 },
      })}
      key={markerKey}
    >
      {markerContent}
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: "center",
    justifyContent: "flex-start",
    ...Platform.select({
      ios: {
        overflow: "visible",
      },
      android: {
        overflow: "hidden",
      },
    }),
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FE902A",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    ...Platform.select({
      ios: {
        zIndex: 1,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  markerDotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    ...Platform.select({
      ios: {
        zIndex: 2,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  titleContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    ...Platform.select({
      ios: {
        zIndex: 1,
      },
      android: {
        elevation: 3,
      },
    }),
    maxWidth: 120,
  },
  markerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  markerContainer: {
    backgroundColor: "#FE902A",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: "#FE902A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    ...Platform.select({
      ios: {
        zIndex: 1,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  markerContainerPartner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "#FFD54F",
  },
  markerContainerSelected: {
    borderWidth: 4,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    ...Platform.select({
      ios: {
        zIndex: 2,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  partnerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    ...Platform.select({
      ios: {
        zIndex: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  markerPin: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FE902A",
    marginTop: -2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    zIndex: 0,
    overflow: "visible",
  },
  markerPinAndroid: {
    width: 20,
    height: 20,
    backgroundColor: "#FE902A",
    borderRadius: 10,
    marginTop: -10,
    transform: [{ rotate: '45deg' }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  markerPinPartner: {
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 20,
    borderTopColor: "#FFD54F",
    marginTop: -4,
  },
  markerPinPartnerAndroid: {
    backgroundColor: "#FFD54F",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: -11,
  },
  markerPinSelected: {
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  markerPinShadow: {
    width: 12,
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    marginTop: -4,
    transform: [{ scaleX: 0.8 }],
  },
});

