import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal, Restaurant } from "@/types/restaurant";

/**
 * Checks if a recurring deal is currently active based on day and time
 */
function isRecurringDealActive(deal: Deal): boolean {
  if (!deal.is_recurring || !deal.recurrence_days || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"

  // Check if today is in the recurrence days
  if (!deal.recurrence_days.includes(currentDay)) {
    return false;
  }

  // Check if current time is within the recurrence time range
  return currentTime >= deal.recurrence_start_time && currentTime <= deal.recurrence_end_time;
}

/**
 * Checks if a one-time deal is currently active
 */
function isOneTimeDealActive(deal: Deal): boolean {
  const now = new Date();

  // If deal has an end_at and it's passed, deal is expired
  if (deal.end_at && new Date(deal.end_at) < now) {
    return false;
  }

  // If deal has a start_at and it hasn't started yet, deal is not active
  if (deal.start_at && new Date(deal.start_at) > now) {
    return false;
  }

  // Deal is active if we're within the time range (or no time restrictions)
  return true;
}

/**
 * Filters deals to only show currently active ones
 */
function filterActiveDeals(deals: Deal[]): Deal[] {
  return deals.filter((deal) => {
    // Check overall validity period if set (for recurring deals with date range)
    const now = new Date();
    if (deal.start_at && new Date(deal.start_at) > now) {
      return false; // Deal hasn't started yet
    }
    if (deal.end_at && new Date(deal.end_at) < now) {
      return false; // Deal has expired
    }

    // Check if it's a recurring deal
    if (deal.is_recurring) {
      return isRecurringDealActive(deal);
    }

    // Otherwise, it's a one-time deal
    return isOneTimeDealActive(deal);
  });
}

/**
 * Hook to batch fetch active deals for multiple restaurants
 * Returns a map of restaurant ID -> hasActiveDeal boolean
 */
export function useActiveDealsMap(restaurants: Restaurant[]) {
  const [activeDealsMap, setActiveDealsMap] = useState<Map<string, boolean>>(new Map());
  const [dealTitlesMap, setDealTitlesMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurants.length === 0) {
      setActiveDealsMap(new Map());
      setDealTitlesMap(new Map());
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchActiveDeals() {
      try {
        const restaurantIds = restaurants.map((r) => r.id);

        // Batch fetch all deals for all restaurants
        const { data, error } = await supabase
          .from("deals")
          .select("*")
          .in("restaurant_id", restaurantIds)
          .eq("is_active", true);

        if (error) throw error;

        if (!mounted) return;

        // Filter to only active deals
        const activeDeals = filterActiveDeals(data || []);

        // Create a map: restaurant_id -> hasActiveDeal
        const dealsMap = new Map<string, boolean>();
        const titlesMap = new Map<string, string[]>();
        
        // Initialize all restaurants to false
        restaurantIds.forEach((id) => {
          dealsMap.set(id, false);
          titlesMap.set(id, []);
        });

        // Mark restaurants with active deals as true and collect titles
        activeDeals.forEach((deal) => {
          dealsMap.set(deal.restaurant_id, true);
          const existing = titlesMap.get(deal.restaurant_id) || [];
          titlesMap.set(deal.restaurant_id, [...existing, deal.title || '', deal.description || '']);
        });

        setActiveDealsMap(dealsMap);
        setDealTitlesMap(titlesMap);
        setLoading(false);
      } catch (e: any) {
        console.error("Error fetching active deals:", e);
        if (mounted) {
          const emptyMap = new Map<string, boolean>();
          const emptyTitles = new Map<string, string[]>();
          restaurants.forEach((r) => {
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
      if (mounted) fetchActiveDeals();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [restaurants]);

  return { activeDealsMap, dealTitlesMap, loading };
}
