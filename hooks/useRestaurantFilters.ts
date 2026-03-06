import { useMemo, useState, useEffect } from "react";
import { Restaurant } from "@/types/restaurant";
import { FilterState, DEFAULT_FILTERS } from "@/types/filters";
import { calculateDistance } from "@/utils/distance";
import { UserLocation } from "@/types/restaurant";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FILTER_STORAGE_KEY = "@dealish_filters";

export function useRestaurantFilters(
  restaurants: Restaurant[],
  userLocation: UserLocation | null,
  activeDealsMap?: Map<string, boolean>
) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Load saved filters on mount
  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    try {
      const saved = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        setFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  };

  const saveFilters = async (newFilters: FilterState) => {
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(newFilters));
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  };

  const updateFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    saveFilters(newFilters);
  };

  const clearFilters = () => {
    updateFilters(DEFAULT_FILTERS);
  };

  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.maxDistance !== null) count++;
    if (filters.minRating !== null) count++;
    if (filters.types.length > 0) count++;
    if (filters.partnerOnly) count++;
    if (filters.hasDealsOnly) count++;
    return count;
  };

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => {
      // Distance filter
      if (filters.maxDistance !== null && userLocation) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          restaurant.lat,
          restaurant.lng
        );
        if (distance > filters.maxDistance) {
          return false;
        }
      }

      // Rating filter
      if (filters.minRating !== null) {
        if (!restaurant.rating || restaurant.rating < filters.minRating) {
          return false;
        }
      }

      // Type filter
      if (filters.types.length > 0) {
        if (!restaurant.type || !filters.types.includes(restaurant.type)) {
          return false;
        }
      }

      // Partner filter
      if (filters.partnerOnly && !restaurant.partner) {
        return false;
      }

      // Has deals filter - use the activeDealsMap if provided
      if (filters.hasDealsOnly && activeDealsMap) {
        const hasActiveDeal = activeDealsMap.get(restaurant.id);
        if (!hasActiveDeal) {
          return false;
        }
      }

      return true;
    });
  }, [restaurants, filters, userLocation, activeDealsMap]);

  return {
    filters,
    updateFilters,
    clearFilters,
    filteredRestaurants,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    activeFilterCount: getActiveFilterCount(),
  };
}
