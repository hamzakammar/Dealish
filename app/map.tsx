import { supabase } from '@/app/lib/supabase';
import { useAuthContext } from "@/app/providers/auth";
import MapTypeSelector from "@/components/MapTypeSelector";
import RestaurantDetailCard, { RestaurantDetailCardRef } from "@/components/RestaurantDetailCard";
import RestaurantList from "@/components/listView";
import RestaurantMarker from "@/components/RestaurantMarker";
import UserLocationMarker from "@/components/UserLocationMarker";
import { useDirections } from "@/hooks/useDirections";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useUserLocation } from "@/hooks/useUserLocation";
import { MapType, Restaurant } from "@/types/restaurant";
import React, { useRef, useState, useEffect } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";

const fallbackRegion: Region = {
  latitude: 43.46946,
  longitude: -80.55348,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const restaurantCardRef = useRef<RestaurantDetailCardRef>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [isShowingDirections, setIsShowingDirections] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { userLocation, region, loading: locationLoading } = useUserLocation(mapRef);
  const { routeCoordinates, getDirections, clearRoute, isDirectionsAvailable } = useDirections();

  const loading = restaurantsLoading || locationLoading;

  const {session} = useAuthContext();

  const handleGetDirections = () => {
    if (selectedRestaurant) {
      setIsShowingDirections(true);
      getDirections(userLocation, selectedRestaurant.lat, selectedRestaurant.lng, mapRef);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        Alert.alert(
          'Sign Out Failed',
          error.message || 'Unable to sign out. Please try again.',
          [{ text: 'OK' }]
        );
      }
      // If successful, the AuthProvider will automatically update the session state
    } catch (error: any) {
      Alert.alert(
        'Sign Out Failed',
        error?.message || 'An unexpected error occurred while signing out. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSigningOut(false);
    }
  };

  const handleCloseRestaurant = () => {
    setSelectedRestaurant(null);
    setIsShowingDirections(false);
    clearRoute();
  };

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
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

      {/* View Mode Toggle Button */}
      <TouchableOpacity
        style={styles.viewToggleButton}
        onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
      >
        <Text style={styles.viewToggleText}>
          {viewMode === "map" ? "📋 List" : "🗺️ Map"}
        </Text>
      </TouchableOpacity>

      {selectedRestaurant && (
        <>
          {/* Overlay to close card when tapping outside - must be behind the card */}
          <TouchableOpacity
            style={styles.mapOverlay}
            activeOpacity={1}
            onPress={() => restaurantCardRef.current?.closeWithAnimation()}
          />
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
      {session && (
        <TouchableOpacity 
          style={[
            styles.signOutButton,
            signingOut && styles.signOutButtonDisabled
          ]} 
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      )}

      {viewMode === "map" && <MapTypeSelector mapType={mapType} onMapTypeChange={setMapType} />}
    </View>
  );
}

const styles = StyleSheet.create({
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
    // This overlay is behind the card, so taps on the card won't reach here
  },
  signOutButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#FE902A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  signOutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  viewToggleButton: {
    position: 'absolute',
    top: 50,
    left: 16,
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