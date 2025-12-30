import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ActivityIndicator, View, StyleSheet, TouchableOpacity, Text } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase"; 
import AntDesign from '@expo/vector-icons/AntDesign';

type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type MapType = "standard" | "satellite" | "hybrid" | "terrain";

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [mapType, setMapType] = useState<MapType>("hybrid");
  const [showMenu, setShowMenu] = useState(false);

  const mapTypes: { label: string; value: MapType }[] = [
    { label: "Standard", value: "standard" },
    { label: "Satellite", value: "satellite" },
    { label: "Hybrid", value: "hybrid" },
    { label: "Terrain", value: "terrain" },
  ];

  const initialDelta = useMemo(
    () => ({ latitudeDelta: 0.01, longitudeDelta: 0.01 }),
    []
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        // 1) Ask for location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location required",
            "We need location to show navigation and nearby deals."
          );
          // still fetch restaurants even if location is denied
        }

        // 2) Get current location (if allowed)
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const nextRegion: Region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...initialDelta,
          };

          if (mounted) setRegion(nextRegion);

          // Optionally animate to user location
          setTimeout(() => {
            mapRef.current?.animateToRegion(nextRegion, 600);
          }, 200);
        }

        // 3) Fetch restaurant pins from Supabase
        const { data, error } = await supabase
          .from("restaurants")
          .select("id,name,lat,lng")
          .eq("is_active", true)
          .limit(500);

        if (error) throw error;

        const parsed: Restaurant[] =
          data?.map((r: any) => ({
            id: r.id,
            name: r.name,
            lat: Number(r.lat),
            lng: Number(r.lng),
          })) ?? [];

        if (mounted) setRestaurants(parsed);
      } catch (e: any) {
        console.error(e);
        Alert.alert("Error", e?.message ?? "Something went wrong");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [initialDelta]);

  // Fallback region if user denies location (Toronto-ish)
  const fallbackRegion: Region = {
    latitude: 43.6532,
    longitude: -79.3832,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={(r) => (mapRef.current = r)}
        style={{ flex: 1 }}
        initialRegion={region ?? fallbackRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType={mapType}
        >
        {restaurants.map((r) => (
          <Marker
          key={r.id}
          coordinate={{ latitude: r.lat, longitude: r.lng }}
          title={r.name}
          />
        ))}
      </MapView>
      <View style={styles.mapTypeContainer}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowMenu(!showMenu)}
        >
          <AntDesign name="menu" size={18} color="black" />    
        </TouchableOpacity>

        {showMenu && (
          <View style={styles.menu}>
            {mapTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.menuItem,
                  mapType === type.value && styles.menuItemActive,
                ]}
                onPress={() => {
                  setMapType(type.value);
                  setShowMenu(false);
                }}
              >

                  <Text
                    style={[
                      styles.menuItemText,
                      mapType === type.value && styles.menuItemTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      
    </View>
  );
}



const styles = StyleSheet.create({
  mapTypeContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 1,
  },
  menuButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: 50, // Fixed width
    height: 38, // Fixed height (paddingVertical: 10 + 18 icon = 38)
    alignItems: "center", // Center the icon horizontally
    justifyContent: "center", // Center the icon vertically
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    minWidth: 120,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuItemActive: {
    backgroundColor: "#007AFF",
  },
  menuItemText: {
    fontSize: 14,
    color: "#333",
  },
  menuItemTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});