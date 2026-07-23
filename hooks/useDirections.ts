import { supabase } from "@/app/lib/supabase";
import { RouteCoordinate, UserLocation } from "@/types/restaurant";
import polyline from "@mapbox/polyline";
import { useCallback, useRef, useState, type RefObject } from "react";
import { Alert } from "react-native";

const isDirectionsAvailable = true;

// Multiplier for route bounds padding to ensure the route is visible with adequate margin
// A value of 1.5 adds 50% padding on each side, preventing the route from touching map edges
const ROUTE_BOUNDS_PADDING_MULTIPLIER = 1.5;

export function useDirections() {
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const directionsGenerationRef = useRef(0);

  const clearRoute = useCallback(() => {
    directionsGenerationRef.current += 1;
    setRouteCoordinates([]);
  }, []);

  const getDirections = useCallback(
    async (
      userLocation: UserLocation | null,
      destinationLat: number,
      destinationLng: number,
      mapRef: RefObject<any | null>
    ) => {
      if (!userLocation) {
        Alert.alert("Error", "User location not available");
        return;
      }

      if (!isDirectionsAvailable) {
        Alert.alert("Directions Unavailable", "Directions are not configured.");
        return;
      }

      const myGeneration = ++directionsGenerationRef.current;

      try {
        const start = [userLocation.lng, userLocation.lat];
        const end = [destinationLng, destinationLat];

        const { data, error } = await supabase.functions.invoke("directions", {
          body: { start, end },
        });

        if (myGeneration !== directionsGenerationRef.current) {
          return;
        }

        if (error) {
          throw new Error(error.message || "Directions request failed");
        }

        if (myGeneration !== directionsGenerationRef.current) {
          return;
        }

        let coordinates: RouteCoordinate[] = [];

        // Handle GeoJSON format (when format=geojson is requested)
        if (data.features && data.features.length > 0) {
          const geometry = data.features[0].geometry;

          if (!geometry || !geometry.coordinates) {
            throw new Error("Invalid GeoJSON geometry format");
          }

          // GeoJSON coordinates are [lng, lat] arrays
          coordinates = geometry.coordinates.map((coord: number[]) => ({
            latitude: coord[1],
            longitude: coord[0],
          }));
        } else if (data.routes && data.routes.length > 0) {
          // Fallback: Handle default JSON format (for backwards compatibility)
          const geometry = data.routes[0].geometry;

          if (typeof geometry === "string") {
            try {
              const decoded = polyline.decode(geometry);
              coordinates = decoded.map((coord: [number, number]) => ({
                latitude: coord[0],
                longitude: coord[1],
              }));
            } catch (decodeError) {
              console.error("Polyline decode error:", decodeError);
              Alert.alert("Error", "Failed to decode route geometry");
              return;
            }
          } else if (geometry.coordinates) {
            coordinates = geometry.coordinates.map((coord: number[]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));
          } else {
            throw new Error("Unknown geometry format");
          }
        } else {
          throw new Error("No route data found in response");
        }

        if (myGeneration !== directionsGenerationRef.current) {
          return;
        }

        setRouteCoordinates(coordinates);

        if (coordinates.length > 0 && mapRef.current) {
          const lats = coordinates.map((c) => c.latitude);
          const lngs = coordinates.map((c) => c.longitude);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          const latDelta = (maxLat - minLat) * ROUTE_BOUNDS_PADDING_MULTIPLIER;
          const lngDelta = (maxLng - minLng) * ROUTE_BOUNDS_PADDING_MULTIPLIER;

          if (myGeneration !== directionsGenerationRef.current) {
            return;
          }

          mapRef.current.animateToRegion(
            {
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: Math.max(latDelta, 0.01),
              longitudeDelta: Math.max(lngDelta, 0.01),
            },
            1000
          );
        }
      } catch (error: unknown) {
        if (myGeneration !== directionsGenerationRef.current) {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : (typeof error === "string" ? error : "Failed to get directions");
        console.error("Directions error:", errorMessage, error);
        Alert.alert("Error", errorMessage);
      }
    },
    []
  );

  return { routeCoordinates, getDirections, clearRoute, isDirectionsAvailable };
}

