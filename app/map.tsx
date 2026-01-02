import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Restaurant, MapType } from "@/types/restaurant";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useDirections } from "@/hooks/useDirections";
import RestaurantMarker from "@/components/RestaurantMarker";
import UserLocationMarker from "@/components/UserLocationMarker";
import MapTypeSelector from "@/components/MapTypeSelector";
import RestaurantDetailCard from "@/components/RestaurantDetailCard";

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
  const { routeCoordinates, getDirections, clearRoute } = useDirections();

  const loading = restaurantsLoading || locationLoading;

  const handleGetDirections = () => {
    if (selectedRestaurant) {
      getDirections(userLocation, selectedRestaurant.lat, selectedRestaurant.lng, mapRef);
    }
  };

  const handleCloseRestaurant = () => {
    setSelectedRestaurant(null);
    clearRoute();
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

        {restaurants.map((r) => (
          <RestaurantMarker
            key={r.id}
            restaurant={r}
            isSelected={selectedRestaurant?.id === r.id}
            onPress={setSelectedRestaurant}
          />
        ))}

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
        />
      )}

      <MapTypeSelector mapType={mapType} onMapTypeChange={setMapType} />
    </View>
  );
}
