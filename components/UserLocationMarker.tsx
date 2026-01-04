import React from "react";
import { View, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { UserLocation } from "@/types/restaurant";

type UserLocationMarkerProps = {
  location: UserLocation;
};

export default function UserLocationMarker({ location }: UserLocationMarkerProps) {
  return (
    <Marker
      coordinate={{ latitude: location.lat, longitude: location.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.userLocationMarker}>
        <View style={styles.userLocationHalo} />
        <View style={styles.userLocationCircle}>
          <MaterialCommunityIcons name="navigation" size={20} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  userLocationMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  userLocationHalo: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FE902A",
    opacity: 0.3,
  },
  userLocationCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FE902A",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});

