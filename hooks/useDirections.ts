import { RouteCoordinate, UserLocation } from "@/types/restaurant";
import polyline from "@mapbox/polyline";
import { useState } from "react";
import { Alert } from "react-native";

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";

// Validate API key at module load time
const isDirectionsAvailable = Boolean(ORS_API_KEY && ORS_API_KEY.trim() !== "");

if (!isDirectionsAvailable) {
  console.warn(
    "Directions feature is disabled: EXPO_PUBLIC_ORS_API_KEY is not configured. " +
    "To enable directions, add your OpenRouteService API key to your .env file."
  );
}

// Multiplier for route bounds padding to ensure the route is visible with adequate margin
// A value of 1.5 adds 50% padding on each side, preventing the route from touching map edges
const ROUTE_BOUNDS_PADDING_MULTIPLIER = 1.5;

export function useDirections() {
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);

  const getDirections = async (
    userLocation: UserLocation | null,
    destinationLat: number,
    destinationLng: number,
    mapRef: React.RefObject<any>
  ) => {
    if (!userLocation) {
      Alert.alert("Error", "User location not available");
      return;
    }

    if (!isDirectionsAvailable || !ORS_API_KEY) {
      Alert.alert(
        "Directions Unavailable",
        "Directions are not configured. Please add your OpenRouteService API key to the EXPO_PUBLIC_ORS_API_KEY environment variable."
      );
      return;
    }

    try {
      const start = [userLocation.lng, userLocation.lat];
      const end = [destinationLng, destinationLat];

      const response = await fetch(
        "https://api.openrouteservice.org/v2/directions/driving-car?format=geojson",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: ORS_API_KEY,
          },
          body: JSON.stringify({
            coordinates: [start, end],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Directions API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

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
    } catch (error: any) {
      const errorMessage = (error && typeof error === "object" && "message" in error && (error as any).message) || (typeof error === "string" ? error : "Failed to get directions");
      console.error("Directions error:", errorMessage, error);
      Alert.alert("Error", errorMessage);
    }
  };

  const clearRoute = () => {
    setRouteCoordinates([]);
  };

  return { routeCoordinates, getDirections, clearRoute, isDirectionsAvailable };
}

