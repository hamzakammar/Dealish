import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ActivityIndicator, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase"; 

type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

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
    <MapView
      ref={(r) => (mapRef.current = r)}
      style={{ flex: 1 }}
      initialRegion={region ?? fallbackRegion}
      showsUserLocation={true}
      showsMyLocationButton={true}
      mapType="hybrid"
    >
      {restaurants.map((r) => (
        <Marker
          key={r.id}
          coordinate={{ latitude: r.lat, longitude: r.lng }}
          title={r.name}
        />
      ))}
    </MapView>
  );
}
