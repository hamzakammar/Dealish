import { useState } from "react";
import { Alert } from "react-native";
// @ts-ignore - @mapbox/polyline doesn't have types
import polyline from "@mapbox/polyline";
import { RouteCoordinate, UserLocation } from "@/types/restaurant";

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";

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

    if (!ORS_API_KEY) {
      Alert.alert("Error", "OpenRouteService API key not configured");
      return;
    }

    try {
      const start = [userLocation.lng, userLocation.lat];
      const end = [destinationLng, destinationLat];

      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&format=geojson`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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

      if (data.routes && data.routes.length > 0) {
        const geometry = data.routes[0].geometry;

        let coordinates: RouteCoordinate[] = [];

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
          const latDelta = (maxLat - minLat) * 1.5;
          const lngDelta = (maxLng - minLng) * 1.5;

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
      }
    } catch (error: any) {
      console.error("Directions error:", error);
      Alert.alert("Error", error.message || "Failed to get directions");
    }
  };

  const clearRoute = () => {
    setRouteCoordinates([]);
  };

  return { routeCoordinates, getDirections, clearRoute };
}

