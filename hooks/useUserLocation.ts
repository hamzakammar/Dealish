import { UserLocation as UserLocationType } from "@/types/restaurant";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Region } from "react-native-maps";

// Delay before animating to user location to ensure map is ready
const MAP_ANIMATION_DELAY_MS = 200;

// Duration of the animation to smoothly transition to the user's location
const MAP_ANIMATION_DURATION_MS = 600;

export function useUserLocation(mapRef: React.RefObject<any>) {
  const [userLocation, setUserLocation] = useState<UserLocationType | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);

  const initialDelta = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location required",
            "We need location to show navigation and nearby deals."
          );
          if (mounted) setLoading(false);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (mounted) {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          const nextRegion: Region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...initialDelta,
          };
          setRegion(nextRegion);
          setTimeout(() => {
            mapRef.current?.animateToRegion(nextRegion, MAP_ANIMATION_DURATION_MS);
          }, MAP_ANIMATION_DELAY_MS);
        }
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
  }, [mapRef]);

  return { userLocation, region, loading };
}

