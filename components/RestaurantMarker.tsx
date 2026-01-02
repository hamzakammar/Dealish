import React from "react";
import { View, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Restaurant } from "@/types/restaurant";

type RestaurantMarkerProps = {
  restaurant: Restaurant;
  isSelected: boolean;
  onPress: (restaurant: Restaurant) => void;
};

export default function RestaurantMarker({
  restaurant,
  isSelected,
  onPress,
}: RestaurantMarkerProps) {
  return (
    <Marker
      coordinate={{ latitude: restaurant.lat, longitude: restaurant.lng }}
      title={restaurant.name}
      onPress={() => onPress(restaurant)}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.markerWrapper}>
        <View
          style={[
            styles.markerContainer,
            isSelected && styles.markerContainerSelected,
          ]}
        >
          <AntDesign
            name="shop"
            size={isSelected ? 20 : 16}
            color="#fff"
          />
        </View>
        <View style={[styles.markerPin, isSelected && styles.markerPinSelected]} />
        <View style={styles.markerPinShadow} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  markerContainer: {
    backgroundColor: "#FE902A",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1,
  },
  markerContainerSelected: {
    backgroundColor: "#FE902A",
    borderColor: "#fff",
    width: 42,
    height: 42,
    borderRadius: 21,
    transform: [{ scale: 1.1 }],
  },
  markerPin: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FE902A",
    marginTop: -3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 0,
  },
  markerPinSelected: {
    borderTopColor: "#FE902A",
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
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

