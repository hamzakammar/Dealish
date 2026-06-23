import { useEffect, useState, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { Restaurant } from "@/types/restaurant";
import { filterActiveDeals } from "@/utils/dealActivity";

/**
 * Hook to batch fetch active deals for multiple restaurants
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
        const restaurantIds = restaurants.map((r) => r.id);

        // N+1 Optimization: Move geographic and time filtering to DB if possible.
        // For now, we at least batch the IDs.
        const { data, error } = await supabase
          .from("deals")
          .select("*")
          .in("restaurant_id", restaurantIds)
          .eq("is_active", true)
          .neq("is_flagged", true);

        if (error) throw error;

        if (!mountedRef.current) return;

        const activeDeals = filterActiveDeals(data || [], atTime);

        const dealsMap = new Map<string, boolean>();
        const titlesMap = new Map<string, string[]>();
        
        restaurantIds.forEach((id) => {
          dealsMap.set(id, false);
          titlesMap.set(id, []);
        });

        activeDeals.forEach((deal) => {
          dealsMap.set(deal.restaurant_id, true);
          const existing = titlesMap.get(deal.restaurant_id) || [];
          titlesMap.set(deal.restaurant_id, [...existing, deal.title || '']);
        });

        setActiveDealsMap(dealsMap);
        setDealTitlesMap(titlesMap);
        setLoading(false);
      } catch (e: unknown) {
        console.error("Error fetching active deals:", e);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetchActiveDeals();

    // Disable continuous polling in favor of focus-based triggers
    const handleFocus = () => {
      if (document.visibilityState === 'visible') fetchActiveDeals();
    };
    
    document.addEventListener("visibilitychange", handleFocus);

    const interval = setInterval(() => {
      if (mountedRef.current && document.visibilityState === 'visible') {
        fetchActiveDeals();
      }
    }, 300000); // 5 minute slow poll

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(interval);
    };
  }, [restaurants, atTime]);

  return { activeDealsMap, dealTitlesMap, loading };
}
