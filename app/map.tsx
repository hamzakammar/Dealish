import { useAuthContext } from "@/app/providers/auth";
import AccountPanel from "@/components/AccountPanel";
import FilterPanel from "@/components/FilterPanel";
import RestaurantList from "@/components/listView";
import RestaurantDetailCard, { RestaurantDetailCardRef } from "@/components/RestaurantDetailCard";
import RestaurantMarker from "@/components/RestaurantMarker";
import { useRestaurantFilters } from "@/hooks/useRestaurantFilters";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useActiveDealsMap } from "@/hooks/useActiveDealsMap";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useColorScheme } from "@/components/useColorScheme";
import { MapType, Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Camera, Region, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";

const fallbackRegion: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const blurredMapRef = useRef<MapView | null>(null);
  const restaurantCardRef = useRef<RestaurantDetailCardRef>(null);
  const currentRegionRef = useRef<Region | null>(null);
  const regionBeforeSelectRef = useRef<Region | null>(null);
  const cameraBeforeSelectRef = useRef<Camera | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [markerScale, setMarkerScale] = useState(1);
  const [mapIsTransitioning, setMapIsTransitioning] = useState(false);

  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { userLocation, region, loading: locationLoading } = useUserLocation(mapRef);
  const { settings } = useUserSettings();
  const colors = useThemeColors();
  
  // Batch fetch active deals for ALL restaurants (needed for filtering)
  const { activeDealsMap } = useActiveDealsMap(restaurants);
  
  const systemColorScheme = useColorScheme();
  
  // Determine if dark mode is active from settings
  const isDarkMode = useMemo(() => {
    if (!settings?.appearance?.theme) return false;
    if (settings.appearance.theme === 'dark') return true;
    if (settings.appearance.theme === 'auto') {
      return systemColorScheme === 'dark';
    }
    return false;
  }, [settings?.appearance?.theme, systemColorScheme]);
  
  // Dark map style for Google Maps
  const darkMapStyle = useMemo(() => [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ], []);
  
  // Initialize map type from user settings
  const [mapType, setMapType] = useState<MapType>(() => {
    return settings?.appearance?.defaultMapType || "standard";
  });
  
  // Filter restaurants (pass activeDealsMap for hasDealsOnly filter)
  const {
    filters,
    updateFilters,
    clearFilters,
    filteredRestaurants: filteredByFilters,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    activeFilterCount,
  } = useRestaurantFilters(restaurants, userLocation, activeDealsMap);

  // Apply search filter on top of existing filters
  const filteredRestaurants = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredByFilters;
    }
    const query = searchQuery.toLowerCase().trim();
    return filteredByFilters.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(query) ||
      restaurant.address?.toLowerCase().includes(query) ||
      restaurant.type?.toLowerCase().includes(query)
    );
  }, [filteredByFilters, searchQuery]);

  // Update map type when settings change
  useEffect(() => {
    if (settings?.appearance?.defaultMapType && settings.appearance.defaultMapType !== mapType) {
      setMapType(settings.appearance.defaultMapType);
    }
  }, [settings?.appearance?.defaultMapType, mapType]);

  // Get search suggestions (limited to top 5)
  const searchSuggestions = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const query = searchQuery.toLowerCase().trim();
    const matches = filteredByFilters.filter((restaurant) =>
      restaurant.name.toLowerCase().includes(query) ||
      restaurant.address?.toLowerCase().includes(query) ||
      restaurant.type?.toLowerCase().includes(query)
    );
    return matches.slice(0, 5); // Limit to 5 suggestions
  }, [filteredByFilters, searchQuery]);

  const handleSuggestionPress = (restaurant: Restaurant) => {
    setSearchQuery("");
    handleRestaurantSelect(restaurant);
  };

  const loading = restaurantsLoading || locationLoading;

  const { session } = useAuthContext();

  // Check if location permission was denied and set initial view to list
  useEffect(() => {
    if (!locationLoading && !userLocation) {
      // No location available - switch to list view
      setHasLocationPermission(false);
      setViewMode("list");
      setSelectedRestaurant(null); // Deselect restaurant when switching to list view
    }
  }, [locationLoading, userLocation]);
  
  // Deselect restaurant when switching to list view
  useEffect(() => {
    if (viewMode === "list") {
      setSelectedRestaurant(null);
    }
  }, [viewMode]);

  const handleCloseRestaurant = async () => {
    // If we zoomed/panned into a restaurant, restore the previous map view on close.
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
  };

  const handleGetDirections = () => {
    if (!selectedRestaurant) return;
    const { lat, lng, name } = selectedRestaurant;
    const label = encodeURIComponent(name || "Restaurant");
    const url = Platform.OS === "ios"
      ? `maps://?daddr=${lat},${lng}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}&travelmode=driving`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      }
    });
  };

  // Android back button — close restaurant card if open, otherwise default behavior
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedRestaurant) {
        handleCloseRestaurant();
        return true;
      }
      if (isAccountPanelOpen) {
        setIsAccountPanelOpen(false);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [selectedRestaurant, isAccountPanelOpen]);

  const handleRestaurantSelect = React.useCallback((restaurant: Restaurant) => {
    if (selectedRestaurant?.id === restaurant.id) {
      return;
    }
    // Signal transition so markers re-arm after animation settles
    setMapIsTransitioning(true);
    setTimeout(() => setMapIsTransitioning(false), 50);

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
    
    // Set selected restaurant immediately for responsive UI
    setSelectedRestaurant(restaurant);

    // If we're in list view, switch to map view first, then pan after a short delay
    if (viewMode === "list") {
      setViewMode("map");
      // Wait for map view to be ready before panning
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: restaurant.lat - 0.002, // Slightly offset to account for card overlay
            longitude: restaurant.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800 // Animation duration in milliseconds
        );
      }, 100);
    } else {
      // Already in map view, pan immediately
      mapRef.current?.animateToRegion(
        {
          latitude: restaurant.lat - 0.002, // Slightly offset to account for card overlay
          longitude: restaurant.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800 // Animation duration in milliseconds
      );
    }
  }, [selectedRestaurant, viewMode, region]);

  const handleRecenter = () => {
    if (!userLocation || viewMode !== "map") return;

    const targetRegion: Region = {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    mapRef.current?.animateToRegion(targetRegion, 600);
  };

  // Show minimal loading - don't block if we have restaurants or location
  // This prevents 10-second loading times
  if (loading && restaurants.length === 0 && !region) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#FE902A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.contentWrapper}>
        {viewMode === "map" ? (
          <MapView
            ref={(r) => {
              mapRef.current = r;
            }}
            style={{ flex: 1 }}
            initialRegion={region ?? fallbackRegion}
            showsMyLocationButton={false}
            showsUserLocation={true}
            mapType={mapType}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            customMapStyle={isDarkMode && mapType === "standard" && Platform.OS === 'android' ? darkMapStyle : undefined}
            pitchEnabled={Platform.OS !== 'android'}
            toolbarEnabled={false}
            onRegionChangeComplete={(r) => {
              currentRegionRef.current = r;
              // Zoom-based marker scaling: smaller delta = zoomed in = bigger markers
              const scale = Math.min(1.4, Math.max(0.6, 0.05 / r.latitudeDelta));
              setMarkerScale(scale);
              // Sync blurred map background with main map
              if (blurredMapRef.current) {
                blurredMapRef.current.animateToRegion(r, 0);
              }
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
            {filteredRestaurants.map((r) => {
              const isSelected = selectedRestaurant !== null && selectedRestaurant.id === r.id;
              const hasActiveDeal = activeDealsMap.get(r.id) ?? false;
              return (
                <RestaurantMarker
                  key={r.id}
                  restaurant={r}
                  isSelected={isSelected}
                  onPress={handleRestaurantSelect}
                  hasActiveDeal={hasActiveDeal}
                  scale={markerScale}
                  mapIsTransitioning={mapIsTransitioning}
                />
              );
            })}

          </MapView>
        ) : (
          <RestaurantList
            restaurants={filteredRestaurants}
            onRestaurantPress={handleRestaurantSelect}
            selectedRestaurant={selectedRestaurant}
            userLocation={userLocation}
          />
        )}
      </View>

      {/* Top Search and Controls Bar */}
      {!isAccountPanelOpen && !isFilterPanelOpen && (
        <View style={[styles.topBarContainer, viewMode === "list" && { backgroundColor: colors.cardSecondary }]}>
          {/* Blurred Map Background - disabled on Android to prevent duplicate map */}
          {viewMode === "map" && region && Platform.OS === 'ios' && (
            <View style={styles.blurredMapBackground}>
              <MapView
                ref={(r) => {
                  blurredMapRef.current = r;
                }}
                style={StyleSheet.absoluteFillObject}
                region={currentRegionRef.current || region || fallbackRegion}
                mapType={mapType}
                provider={PROVIDER_DEFAULT}
                customMapStyle={undefined}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                toolbarEnabled={false}
              />
              <BlurView intensity={colors.isDark ? 80 : 60} style={StyleSheet.absoluteFillObject} tint={colors.isDark ? "dark" : "light"} />
            </View>
          )}
          {/* Simple background for Android */}
          {viewMode === "map" && Platform.OS === 'android' && (
            <View style={[styles.blurredMapBackground, { backgroundColor: colors.isDark ? 'rgba(44, 44, 46, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]} />
          )}
          <View style={styles.topBarContent}>
            <View style={styles.topBar}>
            {/* Settings Button */}
            <TouchableOpacity
              style={[styles.topActionButton, { backgroundColor: colors.card }]}
              onPress={() => setIsAccountPanelOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Search Bar */}
            <View style={[styles.topSearchBar, { backgroundColor: colors.card }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.topSearchInput, { color: colors.text }]}
                placeholder="Search"
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter and Location Buttons */}
            <TouchableOpacity
              style={[
                styles.topActionButton, 
                { backgroundColor: colors.card },
                activeFilterCount > 0 && styles.topActionButtonActive
              ]}
              onPress={() => setIsFilterPanelOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="options" size={18} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topActionButton, { backgroundColor: colors.card }]}
              onPress={handleRecenter}
              activeOpacity={0.7}
              disabled={!userLocation || viewMode !== "map"}
            >
              <Ionicons 
                name="location" 
                size={18} 
                color={userLocation && viewMode === "map" ? colors.textSecondary : colors.textTertiary} 
              />
            </TouchableOpacity>
          </View>

          {/* List/Map Toggle */}
          <View style={[styles.viewToggleContainer, { backgroundColor: colors.isDark ? "#3A3A3C" : "#E9EAEB" }]}>
            <TouchableOpacity
              style={[
                styles.viewToggleSegment,
                viewMode === "list" && styles.viewToggleSegmentActive
              ]}
              onPress={() => {
                setViewMode("list");
                setSelectedRestaurant(null); // Deselect restaurant when switching to list view
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.viewToggleText,
                { color: viewMode === "list" ? "#fff" : colors.textSecondary },
                viewMode === "list" && styles.viewToggleTextActive
              ]}>
                List
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewToggleSegment,
                viewMode === "map" && styles.viewToggleSegmentActive
              ]}
              onPress={() => setViewMode("map")}
              activeOpacity={0.7}
              disabled={!hasLocationPermission}
            >
              <Text style={[
                styles.viewToggleText,
                { color: viewMode === "map" ? "#fff" : (!hasLocationPermission ? colors.textTertiary : colors.textSecondary) },
                viewMode === "map" && styles.viewToggleTextActive,
                !hasLocationPermission && styles.viewToggleTextDisabled
              ]}>
                Map
              </Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      )}

      {/* Hide restaurant detail card when filter panel is open */}
      {selectedRestaurant && !isFilterPanelOpen && (
        <>
          <RestaurantDetailCard
            ref={restaurantCardRef}
            restaurant={selectedRestaurant}
            onClose={handleCloseRestaurant}
            onGetDirections={handleGetDirections}
            isDirectionsAvailable={true}
            userLocation={userLocation}
          />
        </>
      )}

      {/* {viewMode === "map" && <MapTypeSelector mapType={mapType} onMapTypeChange={setMapType} />} */}

      {/* Overlay when account panel is open */}
      {isAccountPanelOpen && (
        <View style={[styles.accountPanelOverlay, { backgroundColor: colors.background }]} />
      )}

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
        onOpenFilters={() => setIsFilterPanelOpen(true)}
      />

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
        restaurants={restaurants}
        activeFilterCount={activeFilterCount}
      />

      {/* Search Suggestions Dropdown */}
      {!isAccountPanelOpen && !isFilterPanelOpen && searchSuggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <FlatList
            data={searchSuggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.suggestionItem,
                  { borderBottomColor: colors.border },
                  index === searchSuggestions.length - 1 && styles.suggestionItemLast
                ]}
                onPress={() => handleSuggestionPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.suggestionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="restaurant" size={18} color={colors.primary} />
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={[styles.suggestionName, { color: colors.text }]}>{item.name}</Text>
                  {item.address && (
                    <Text style={[styles.suggestionAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
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
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  blurredMapBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  topBarContent: {
    position: 'relative',
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  topSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
    margin: 0,
  },
  topActionButton: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topActionButtonActive: {
    backgroundColor: '#FFF5EB',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FE902A',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9EAEB',
    borderRadius: 10,
    padding: 4,
    height: 44,
  },
  viewToggleSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    height: '100%',
  },
  viewToggleSegmentActive: {
    backgroundColor: '#FE902A',
  },
  viewToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#fff',
  },
  viewToggleTextDisabled: {
    color: '#CCC',
  },
  recenterButton: {
    position: 'absolute',
    top: 112,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.23)',
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2, // Lower than restaurant full screen (zIndex: 10)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  searchContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: 'transparent',
    zIndex: 5, // Above map, below panels
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    zIndex: 11,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionAddress: {
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FE902A',
  },
  searchIconContainer: {
    padding: 10,
    marginLeft: 4,
    borderRadius: 10,
    backgroundColor: '#FFF5EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  clearButton: {
    marginRight: 8,
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  contentWrapper: {
    flex: 1,
    paddingTop: 160, // Space for top bar container
  },
  accountPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
});