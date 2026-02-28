import React from "react";
import { View, StyleSheet, Platform } from "react-native";
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
      tracksViewChanges={Platform.OS === 'ios' ? false : true}
      tappable={false}
      // Android-specific optimizations
      {...(Platform.OS === 'android' && {
        flat: false,
        centerOffset: { x: 0, y: 0 },
      })}
    >
      <View style={styles.userLocationMarker}>
        <View style={styles.userLocationHalo} />
        <View style={styles.userLocationCircle}>
          <MaterialCommunityIcons name="navigation" size={18} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  userLocationMarker: {
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        overflow: "visible",
      },
      android: {
        overflow: "hidden",
      },
    }),
  },
  userLocationHalo: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4285F4",
    opacity: 0.3,
    ...Platform.select({
      ios: {
        zIndex: 0,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  userLocationCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    ...Platform.select({
      ios: {
        zIndex: 1,
        overflow: "visible",
      },
      android: {
        elevation: 3,
        overflow: "hidden",
      },
    }),
  },
});

