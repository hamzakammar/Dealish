import { useEffect, useState, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { Restaurant, Deal } from "@/types/restaurant";
import { filterActiveDeals } from "@/utils/dealActivity";

/**
 * Hook to batch fetch active deals for multiple restaurants
 * Returns a map of restaurant ID -> hasActiveDeal boolean
 */
export function useActiveDealsMap(restaurants: Restaurant[], atTime: Date | null = null) {
  const [activeDealsMap, setActiveDealsMap] = useState<Map<string, boolean>>(new Map());
  const [dealTitlesMap, setDealTitlesMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    if (restaurants.length === 0) {
      setActiveDealsMap(new Map());
      setDealTitlesMap(new Map());
      setLoading(false);
      return;
    }

    async function fetchActiveDeals() {
      try {
        const restaurantIds = restaurants.map((r: Restaurant) => r.id);

        // Batch fetch all deals for all restaurants
        const { data, error } = await supabase
          .from("deals")
          .select("*")
          .in("restaurant_id", restaurantIds)
          .eq("is_active", true)
          .neq("is_flagged", true);

        if (error) throw error;

        if (!mountedRef.current) return;

        // Filter to only active deals (at the selected time, or now)
        const activeDeals: Deal[] = filterActiveDeals(data || [], atTime);

        // Create a map: restaurant_id -> hasActiveDeal
        const dealsMap = new Map<string, boolean>();
        const titlesMap = new Map<string, string[]>();
        
        // Initialize all restaurants to false
        restaurantIds.forEach((id: string) => {
          dealsMap.set(id, false);
          titlesMap.set(id, []);
        });

        // Mark restaurants with active deals as true and collect titles
        activeDeals.forEach((deal: Deal) => {
          dealsMap.set(deal.restaurant_id, true);
          const existing = titlesMap.get(deal.restaurant_id) || [];
          titlesMap.set(deal.restaurant_id, [...existing, deal.title || '', deal.description || '']);
        });

        setActiveDealsMap(dealsMap);
        setDealTitlesMap(titlesMap);
        setLoading(false);
      } catch (e: unknown) {
        console.error("Error fetching active deals:", e);
        if (mountedRef.current) {
          const emptyMap = new Map<string, boolean>();
          const emptyTitles = new Map<string, string[]>();
          restaurants.forEach((r: Restaurant) => {
            emptyMap.set(r.id, false);
            emptyTitles.set(r.id, []);
          });
          setActiveDealsMap(emptyMap);
          setDealTitlesMap(emptyTitles);
          setLoading(false);
        }
      }
    }

    fetchActiveDeals();

    const interval = setInterval(() => {
      if (mountedRef.current && document.visibilityState === 'visible') {
        fetchActiveDeals();
      }
    }, 300000); // Match PR #21 slow poll

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [restaurants, atTime]);

  return { activeDealsMap, dealTitlesMap, loading };
}
