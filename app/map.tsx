import AntDesign from '@expo/vector-icons/AntDesign';
import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps"; // Added Polyline
import { supabase } from "./lib/supabase";
// @ts-ignore - @mapbox/polyline doesn't have types
import polyline from '@mapbox/polyline';

type Restaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type MapType = "standard" | "satellite" | "hybrid" | "terrain";
const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || ""; // Better error handling

type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [mapType, setMapType] = useState<MapType>("hybrid");
  const [showMenu, setShowMenu] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  // Single useEffect - removed duplicate
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
        }

        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          // Store user location for directions
          if (mounted) {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          }

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

  const getDirections = async (destinationLat: number, destinationLng: number) => {

    
    if (!userLocation) {
      Alert.alert("Error", "User location not available");
      return;
    }

    if (!ORS_API_KEY) {
      Alert.alert("Error", "OpenRouteService API key not configured");
      return;
    }

    try {
      // OpenRouteService expects [longitude, latitude] format
      const start = [userLocation.lng, userLocation.lat];
      const end = [destinationLng, destinationLat];

      // Request GeoJSON format to get coordinates directly, or use encoded polyline
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
        
        // Handle both encoded polyline string and coordinates array
        let coordinates: RouteCoordinate[] = [];
        
        if (typeof geometry === 'string') {
          // Step 3: Decode encoded polyline using @mapbox/polyline
          // polyline.decode returns array of [lat, lng] pairs
          try {
            const decoded = polyline.decode(geometry);
            coordinates = decoded.map((coord: [number, number]) => ({
              latitude: coord[0],  // First is latitude
              longitude: coord[1], // Second is longitude
            }));
          } catch (decodeError) {
            console.error("Polyline decode error:", decodeError);
            Alert.alert("Error", "Failed to decode route geometry");
            return;
          }
        } else if (geometry.coordinates) {
          // Coordinates array format (GeoJSON format: [lng, lat])
          coordinates = geometry.coordinates.map((coord: number[]) => ({
            latitude: coord[1], // lat is second in GeoJSON
            longitude: coord[0], // lng is first in GeoJSON
          }));
        } else {
          throw new Error("Unknown geometry format");
        }

        setRouteCoordinates(coordinates);

        // Calculate bounding box and zoom to route
        if (coordinates.length > 0) {
          const lats = coordinates.map(c => c.latitude);
          const lngs = coordinates.map(c => c.longitude);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          const latDelta = (maxLat - minLat) * 1.5; // Add padding
          const lngDelta = (maxLng - minLng) * 1.5;

          mapRef.current?.animateToRegion({
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lngDelta, 0.01),
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error("Directions error:", error);
      Alert.alert("Error", error.message || "Failed to get directions");
    }
  };

  // Fallback region if user denies location (Toronto-ish)
  const fallbackRegion: Region = {
    latitude: 43.6532,
    longitude: -79.3832,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
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
        ref={(r) => {
          mapRef.current = r;
        }}
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
            onPress={() => setSelectedRestaurant(r)}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.markerWrapper}>
              <View style={[
                styles.markerContainer,
                selectedRestaurant?.id === r.id && styles.markerContainerSelected
              ]}>
                <AntDesign 
                  name="shop" 
                  size={selectedRestaurant?.id === r.id ? 20 : 16} 
                  color="#fff" 
                />
              </View>
              <View style={[
                styles.markerPin,
                selectedRestaurant?.id === r.id && styles.markerPinSelected
              ]} />
              <View style={styles.markerPinShadow} />
            </View>
          </Marker>
        ))}

        {/* Display route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#007AFF"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Add directions button when restaurant is selected */}
      {selectedRestaurant && (
        <View style={styles.directionsContainer}>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => getDirections(selectedRestaurant.lat, selectedRestaurant.lng)}
          >
            <AntDesign name="arrow-right" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setSelectedRestaurant(null);
              setRouteCoordinates([]);
            }}
          >
            <AntDesign name="close" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      )}

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
    width: 50,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
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
  directionsContainer: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerWrapper: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  markerContainer: {
    backgroundColor: "#FE902A",
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1,
  },
  markerContainerSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#fff",
    width: 42,
    height: 42,
    borderRadius: 21,
    transform: [{ scale: 1.1 }],
  },
  markerPin: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FE902A",
    marginTop: -3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 0,
  },
  markerPinSelected: {
    borderTopColor: "#007AFF",
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
  },
  markerPinShadow: {
    width: 12,
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    marginTop: -4,
    transform: [{ scaleX: 0.8 }],
  },
});

