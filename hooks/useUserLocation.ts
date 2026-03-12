import { UserLocation as UserLocationType } from "@/types/restaurant";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Region } from "react-native-maps";

// Delay before animating to user location to ensure map is ready
const MAP_ANIMATION_DELAY_MS = 200;

// Duration of the animation to smoothly transition to the user's location
const MAP_ANIMATION_DURATION_MS = 600;

const LOCATION_UPDATE_DISTANCE = 5;

const LOCATION_UPDATE_INTERVAL = 5000;

export function useUserLocation(mapRef: React.RefObject<any>) {
  const [userLocation, setUserLocation] = useState<UserLocationType | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);

  const initialDelta = { latitudeDelta: 0.01, longitudeDelta: 0.01 };

  useEffect(() => {
    let mounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    async function bootstrap() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          const { showSettingsAlert, getPermissionInfo } = require('@/utils/permissions');
          const info = getPermissionInfo('location');
          showSettingsAlert(
            info.title,
            info.settingsDescription
          );
          if (mounted) {
            // Default to Toronto when location permission is denied
            const torontoRegion: Region = {
              latitude: 43.6532,
              longitude: -79.3832,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
            setRegion(torontoRegion);
            setLoading(false);
          }
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (mounted) {
          const initialLocation = ({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setUserLocation(initialLocation);

          const nextRegion: Region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...initialDelta,
          };
          setRegion(nextRegion);
          
          setTimeout(() => {
            mapRef.current?.animateToRegion(nextRegion, MAP_ANIMATION_DURATION_MS);
          }, MAP_ANIMATION_DELAY_MS);
          
          setLoading(false);
        }
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: LOCATION_UPDATE_DISTANCE,
            timeInterval: LOCATION_UPDATE_INTERVAL,
          },
          (location) => {
            if (mounted) {
              const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              };
              setUserLocation(newLocation);
              
              // Update region without animating to avoid disrupting user interaction
              const updatedRegion: Region = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                ...initialDelta,
              };
              setRegion(updatedRegion);
            }
          }
        );
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
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [mapRef]);

  return { userLocation, region, loading };
}

