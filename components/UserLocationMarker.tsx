import React from "react";
import { View, StyleSheet, Platform, PixelRatio } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { UserLocation } from "@/types/restaurant";

// Conditionally import Marker only on native platforms
const Marker = Platform.select({
  native: () => require("react-native-maps").Marker,
  default: () => null,
})?.();

const rnd = (n: number) => PixelRatio.roundToNearestPixel(n);

type UserLocationMarkerProps = {
  location: UserLocation;
};

export default function UserLocationMarker({ location }: UserLocationMarkerProps) {
  const wrapperSize = rnd(48);
  const haloSize = rnd(40);
  const circleSize = rnd(32);
  const borderWidth = rnd(3);

  // On web, return null since maps are not supported
  if (!Marker) return null;

  return (
    <Marker
      coordinate={{ latitude: location.lat, longitude: location.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      tappable={false}
    >
      <View
        style={{ width: wrapperSize, height: wrapperSize, alignItems: "center", justifyContent: "center" }}
        {...(Platform.OS === 'android' && { collapsable: false, renderToHardwareTextureAndroid: true })}
      >
        <View style={{
          position: "absolute",
          width: haloSize, height: haloSize, borderRadius: haloSize / 2,
          backgroundColor: "#4285F4", opacity: 0.3,
        }} />
        <View style={{
          width: circleSize, height: circleSize, borderRadius: circleSize / 2,
          backgroundColor: "#4285F4",
          borderWidth, borderColor: "#fff",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3, shadowRadius: 3,
        }}>
          <MaterialCommunityIcons name="navigation" size={rnd(18)} color="#fff" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({});
