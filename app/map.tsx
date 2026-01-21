import { useAuthContext } from "@/app/providers/auth";
import AccountPanel from "@/components/AccountPanel";
import RestaurantList from "@/components/listView";
import RestaurantDetailCard, { RestaurantDetailCardRef } from "@/components/RestaurantDetailCard";
import RestaurantMarker from "@/components/RestaurantMarker";
import UserLocationMarker from "@/components/UserLocationMarker";
import { useDirections } from "@/hooks/useDirections";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useUserLocation } from "@/hooks/useUserLocation";
import { MapType, Restaurant } from "@/types/restaurant";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Camera, Polyline, Region } from "react-native-maps";

const fallbackRegion: Region = {
  latitude: 43.46946,
  longitude: -80.55348,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const restaurantCardRef = useRef<RestaurantDetailCardRef>(null);
  const currentRegionRef = useRef<Region | null>(null);
  const regionBeforeSelectRef = useRef<Region | null>(null);
  const cameraBeforeSelectRef = useRef<Camera | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isShowingDirections, setIsShowingDirections] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(true);

  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { userLocation, region, loading: locationLoading } = useUserLocation(mapRef);
  const { routeCoordinates, getDirections, clearRoute, isDirectionsAvailable } = useDirections();

  const loading = restaurantsLoading || locationLoading;

  const { session } = useAuthContext();

  // Check if location permission was denied and set initial view to list
  useEffect(() => {
    if (!locationLoading && !userLocation) {
      // No location available - switch to list view
      setHasLocationPermission(false);
      setViewMode("list");
    }
  }, [locationLoading, userLocation]);

  const handleGetDirections = () => {
    if (selectedRestaurant) {
      setIsShowingDirections(true);
      getDirections(userLocation, selectedRestaurant.lat, selectedRestaurant.lng, mapRef);
    }
  };

  const handleCloseRestaurant = async () => {
    // If we zoomed/panned into a restaurant, restore the previous map view on close.
    // Prefer restoring the full camera (keeps rotation/bearing + pitch), fallback to region.
    if (viewMode === "map") {
      if (cameraBeforeSelectRef.current) {
        mapRef.current?.animateCamera(cameraBeforeSelectRef.current, { duration: 800 });
        cameraBeforeSelectRef.current = null;
        regionBeforeSelectRef.current = null;
      } else if (regionBeforeSelectRef.current) {
        mapRef.current?.animateToRegion(regionBeforeSelectRef.current, 800);
        regionBeforeSelectRef.current = null;
      }
    }
    setSelectedRestaurant(null);
    setIsShowingDirections(false);
    clearRoute();
  };

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    // Capture current view before zooming in, so we can restore it on close.
    if (!regionBeforeSelectRef.current) {
      regionBeforeSelectRef.current = currentRegionRef.current ?? region ?? fallbackRegion;
    }
    if (!cameraBeforeSelectRef.current) {
      // getCamera is async; fire-and-forget to capture rotation/pitch too
      mapRef.current?.getCamera?.().then((cam) => {
        if (!cameraBeforeSelectRef.current) cameraBeforeSelectRef.current = cam;
      }).catch(() => {});
    }
    setSelectedRestaurant(restaurant);

    // If we're in list view, switch to map view first
    if (viewMode === "list") {
      setViewMode("map");
    }

    // Pan/animate the map to the selected restaurant
    mapRef.current?.animateToRegion(
      {
        latitude: restaurant.lat - 0.002, // Slightly offset to account for card overlay
        longitude: restaurant.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800 // Animation duration in milliseconds
    );
  };

  useEffect(() => {
    if (isShowingDirections && selectedRestaurant && userLocation) {
      getDirections(userLocation, selectedRestaurant.lat, selectedRestaurant.lng, mapRef);
    }
  }, [userLocation, isShowingDirections, selectedRestaurant]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {viewMode === "map" ? (
        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={{ flex: 1 }}
          initialRegion={region ?? fallbackRegion}
          showsMyLocationButton={true}
          mapType={mapType}
          onRegionChangeComplete={(r) => {
            currentRegionRef.current = r;
          }}
          onPress={(e) => {
            // Close restaurant card when tapping on map (not on markers)
            if (e.nativeEvent.action === 'marker-press') {
              return; // Don't close if tapping a marker
            }
            if (selectedRestaurant) {
              // Use the animated close method
              restaurantCardRef.current?.closeWithAnimation();
            }
          }}
        >
          {userLocation && <UserLocationMarker location={userLocation} />}

          {restaurants.map((r) => {
            const isSelected = selectedRestaurant !== null && selectedRestaurant.id === r.id;
            return (
              <RestaurantMarker
                key={r.id}
                restaurant={r}
                isSelected={isSelected}
                onPress={handleRestaurantSelect}
              />
            );
          })}

          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#FE902A"
              strokeWidth={4}
            />
          )}
        </MapView>
      ) : (
        <RestaurantList
          restaurants={restaurants}
          onRestaurantPress={handleRestaurantSelect}
          selectedRestaurant={selectedRestaurant}
        />
      )}

      {/* Menu Button (opens account panel) - hidden when panel is open */}
      {!isAccountPanelOpen && (
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setIsAccountPanelOpen(!isAccountPanelOpen)}
          activeOpacity={0.8}
        >
          <AntDesign name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* View Mode Toggle Button - disabled when no location */}
      {hasLocationPermission && (
        <TouchableOpacity
          style={styles.viewToggleButton}
          onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
          activeOpacity={0.8}
        >
          <Text style={styles.viewToggleText}>
            {viewMode === "map" ? "📋 List" : "🗺️ Map"}
          </Text>
        </TouchableOpacity>
      )}

      {selectedRestaurant && (
        <>
          <RestaurantDetailCard
            ref={restaurantCardRef}
            restaurant={selectedRestaurant}
            onClose={handleCloseRestaurant}
            onGetDirections={handleGetDirections}
            isDirectionsAvailable={isDirectionsAvailable}
            userLocation={userLocation}
          />
        </>
      )}

      {/* {viewMode === "map" && <MapTypeSelector mapType={mapType} onMapTypeChange={setMapType} />} */}

      {/* Account Panel */}
      <AccountPanel
        isOpen={isAccountPanelOpen}
        onClose={() => setIsAccountPanelOpen(false)}
        onSelectRestaurant={(restaurant) => {
          setSelectedRestaurant(restaurant);
          setViewMode("map");
        }}
        onPanToRestaurant={(lat, lng) => {
          if (!regionBeforeSelectRef.current) {
            regionBeforeSelectRef.current = currentRegionRef.current ?? region ?? fallbackRegion;
          }
          if (!cameraBeforeSelectRef.current) {
            mapRef.current?.getCamera?.().then((cam) => {
              if (!cameraBeforeSelectRef.current) cameraBeforeSelectRef.current = cam;
            }).catch(() => {});
          }
          mapRef.current?.animateToRegion(
            {
              latitude: lat - 0.002,
              longitude: lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            800
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    backgroundColor: '#FE902A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 10,
  },
  viewToggleButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#FE902A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  viewToggleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});