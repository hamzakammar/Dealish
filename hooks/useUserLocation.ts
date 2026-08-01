import { UserLocation as UserLocationType } from "@/types/restaurant";
import { withTimeout } from "@/utils/async";
import { AnalyticsEvents, captureEvent } from "@/utils/analytics";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

// Type definition for Region (compatible with react-native-maps on native, standalone on web)
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Wider default so more downtown Toronto deal pins are visible on first load
// (~9km span). Only affects the *initial* viewport — user pan/zoom is preserved
// because the map is uncontrolled (initialRegion) after mount.
const DEFAULT_REGION: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LOCATION_GET_TIMEOUT_MS = 20_000;

// Delay before animating to user location to ensure map is ready
const MAP_ANIMATION_DELAY_MS = 200;

// Duration of the animation to smoothly transition to the user's location
const MAP_ANIMATION_DURATION_MS = 600;

const LOCATION_UPDATE_DISTANCE = 5;

const LOCATION_UPDATE_INTERVAL = 5000;

export function useUserLocation(mapRef: React.RefObject<any> | React.MutableRefObject<any>) {
  const [userLocation, setUserLocation] = useState<UserLocationType | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);

  // Wider initial zoom so the first fix on the user's location still reveals
  // several nearby (downtown Toronto) deal pins rather than a tight ~1km box.
  const initialDelta = { latitudeDelta: 0.06, longitudeDelta: 0.06 };

  useEffect(() => {
    let mounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    async function bootstrap() {
      try {
        captureEvent(AnalyticsEvents.LOCATION_PERMISSION_REQUESTED);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          captureEvent(AnalyticsEvents.LOCATION_PERMISSION_DENIED, { status });
          const { showSettingsAlert, getPermissionInfo } = require('@/utils/permissions');
          const info = getPermissionInfo('location');
          showSettingsAlert(
            info.title,
            info.settingsDescription
          );
          if (mounted) {
            setRegion(DEFAULT_REGION);
            setLoading(false);
          }
          return;
        }
        captureEvent(AnalyticsEvents.LOCATION_PERMISSION_GRANTED);

        let pos: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>;
        try {
          pos = await withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            LOCATION_GET_TIMEOUT_MS
          );
        } catch {
          if (__DEV__) {
            console.warn('Location getCurrentPosition timed out or failed; using default map region');
          }
          if (mounted) {
            setRegion(DEFAULT_REGION);
            setUserLocation(null);
            setLoading(false);
          }
          return;
        }
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
      } catch (e: unknown) {
        console.error(e);
        const message = e instanceof Error ? e.message : 'Something went wrong';
        Alert.alert("Error", message);
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

