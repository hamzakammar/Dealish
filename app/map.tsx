import MapTypeSelector from "@/components/MapTypeSelector";
import RestaurantDetailCard from "@/components/RestaurantDetailCard";
import RestaurantMarker from "@/components/RestaurantMarker";
import UserLocationMarker from "@/components/UserLocationMarker";
import { useDirections } from "@/hooks/useDirections";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useUserLocation } from "@/hooks/useUserLocation";
import { MapType, Restaurant } from "@/types/restaurant";
import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { useAuthContext } from "./providers/auth";
import { supabase } from '@/app/lib/supabase';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const fallbackRegion: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { userLocation, region, loading: locationLoading } = useUserLocation(mapRef);
  const { routeCoordinates, getDirections, clearRoute, isDirectionsAvailable } = useDirections();

  const loading = restaurantsLoading || locationLoading;

  const {session} = useAuthContext();

  const handleGetDirections = () => {
    if (selectedRestaurant) {
      getDirections(userLocation, selectedRestaurant.lat, selectedRestaurant.lng, mapRef);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCloseRestaurant = () => {
    setSelectedRestaurant(null);
    clearRoute();
  };

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
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
        showsMyLocationButton={true}
        mapType={mapType}
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

      {selectedRestaurant && (
        <RestaurantDetailCard
          restaurant={selectedRestaurant}
          onClose={handleCloseRestaurant}
          onGetDirections={handleGetDirections}
          isDirectionsAvailable={isDirectionsAvailable}
        />
      )}
      {session && (
        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      )}

      <MapTypeSelector mapType={mapType} onMapTypeChange={setMapType} />
    </View>
  );
}
const styles = StyleSheet.create({
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
});
