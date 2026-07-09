import { useEffect, useState, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { supabase } from "@/app/lib/supabase";
import { Deal } from "@/types/restaurant";
import { filterActiveDeals } from "@/utils/dealActivity";

const PAGE_SIZE = 20;

export function useRestaurantDeals(restaurantId: string | null, atTime: Date | null = null) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const mountedRef = useRef(true);
  const fetchCountRef = useRef(0);

  const fetchDeals = useCallback(async (isInitial = true) => {
    if (!restaurantId || !mountedRef.current) return;
    
    const currentFetchId = ++fetchCountRef.current;
    
    setLoading(true);
    setError(null);

    try {
      const currentPage = isInitial ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .neq("is_flagged", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (mountedRef.current && currentFetchId === fetchCountRef.current) {
        const processedDeals = filterActiveDeals(data || [], atTime);
        
        if (isInitial) {
          setDeals(processedDeals);
          setPage(1);
        } else {
          setDeals(prev => [...prev, ...processedDeals]);
          setPage(prev => prev + 1);
        }
        
        setHasMore((data?.length || 0) === PAGE_SIZE);
      }
    } catch (e: unknown) {
      console.error("Error fetching deals:", e);
      if (mountedRef.current && currentFetchId === fetchCountRef.current) {
        setError(e instanceof Error ? e : new Error('Unknown error'));
      }
    } finally {
      if (mountedRef.current && currentFetchId === fetchCountRef.current) {
        setLoading(false);
      }
    }
  }, [restaurantId, page, atTime]);

  useEffect(() => {
    mountedRef.current = true;
    setPage(0);
    setDeals([]);
    setHasMore(true);
    
    if (restaurantId) {
      fetchDeals(true);
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && mountedRef.current && restaurantId) fetchDeals(true);
    });

    const interval = setInterval(() => {
      if (mountedRef.current && restaurantId) fetchDeals(true);
    }, 300000);

    return () => {
      mountedRef.current = false;
      subscription.remove();
      clearInterval(interval);
    };
  }, [restaurantId, atTime]);

  return { 
    deals, 
    loading, 
    error, 
    hasMore, 
    loadMore: () => fetchDeals(false) 
  };
}