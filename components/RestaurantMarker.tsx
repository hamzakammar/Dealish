import { Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useMemo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
  dealInfo?: string | null; // Pass deal info from parent to avoid fetching in every marker
};

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
  dealInfo: providedDealInfo,
}: RestaurantMarkerProps) {
  // Use provided deal info if available, otherwise show default icon
  // This avoids fetching deals for every marker (performance optimization)
  const dealInfo = providedDealInfo;
  const isPartner = Boolean(restaurant.partner);

  const markerContent = useMemo(
    () => (
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
        {dealInfo && (
          <View style={styles.dealBadge}>
            <Text style={styles.dealText}>{dealInfo}</Text>
          </View>
        )}
        {!dealInfo && (
          <AntDesign
            name="shop"
            size={18}
            color="#fff"
          />
        )}
        </View>
        <View
          style={[
            styles.markerPin,
            isPartner && styles.markerPinPartner,
            isSelected && styles.markerPinSelected,
          ]}
        />
      </View>
    ),
    [isSelected, dealInfo, isPartner]
  );

  const handleMarkerPress = React.useCallback(() => {
    // Ensure onPress is called even if there's lag
    onPress(restaurant);
  }, [restaurant, onPress]);

  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      onPress={handleMarkerPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      tappable={true}
    >
      {markerContent}
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  dealBadge: {
    borderRadius: 8,
    elevation: 3,
  },
  dealText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
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
    elevation: 5,
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
    elevation: 5,
    zIndex: 1,
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
    elevation: 8,
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
    elevation: 2,
    zIndex: 2,
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
    elevation: 4,
    zIndex: 0,
    overflow: "visible",
  },
  markerPinPartner: {
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderTopWidth: 20,
    borderTopColor: "#FFD54F",
    marginTop: -4,
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

