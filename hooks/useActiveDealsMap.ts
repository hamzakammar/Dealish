import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal, Restaurant } from "@/types/restaurant";

const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead

/**
 * Returns true if a recurring deal is active at `ref`.
 * When `lookahead` is true (live mode), also counts deals starting within 1 hour.
 * When false (planning for a chosen time), only counts deals active AT that time.
 */
function isRecurringDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (!deal.is_recurring || !deal.recurrence_days || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    return false;
  }

  if (!deal.recurrence_days.includes(ref.getDay())) {
    return false;
  }

  const currentTime = ref.toTimeString().slice(0, 8); // "HH:MM:SS"

  // Active at the reference time
  if (currentTime >= deal.recurrence_start_time && currentTime <= deal.recurrence_end_time) {
    return true;
  }

  // Live mode only: starts within 1 hour
  if (lookahead && currentTime < deal.recurrence_start_time) {
    const [sh, sm] = deal.recurrence_start_time.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const refMinutes = ref.getHours() * 60 + ref.getMinutes();
    return startMinutes - refMinutes <= 60;
  }

  return false;
}

/**
 * Returns true if a one-time deal is active at `ref` (live mode also allows
 * deals starting within 1 hour).
 */
function isOneTimeDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (deal.end_at && new Date(deal.end_at) < ref) {
    return false;
  }

  if (deal.start_at) {
    const startAt = new Date(deal.start_at);
    if (startAt > ref) {
      // Not started yet — live mode shows if starting within 1 hour
      return lookahead && startAt.getTime() - ref.getTime() <= SOON_MS;
    }
  }

  return true;
}

/**
 * Filters deals to those active at `atTime`. When `atTime` is null we use "now"
 * with a 1-hour lookahead (the default live behaviour); when a time is provided
 * (planning ahead) we match deals active AT that exact time.
 */
function filterActiveDeals(deals: Deal[], atTime: Date | null): Deal[] {
  const ref = atTime ?? new Date();
  const lookahead = atTime == null;
  return deals.filter((deal) => {
    if (deal.end_at && new Date(deal.end_at) < ref) {
      return false; // Expired
    }

    if (deal.is_recurring && deal.recurrence_days && deal.recurrence_start_time && deal.recurrence_end_time) {
      return isRecurringDealActive(deal, ref, lookahead);
    }

    return isOneTimeDealActive(deal, ref, lookahead);
  });
}

/**
 * Hook to batch fetch active deals for multiple restaurants
 * Returns a map of restaurant ID -> hasActiveDeal boolean
 */
export function useActiveDealsMap(restaurants: Restaurant[], atTime: Date | null = null) {
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
          .eq("is_active", true)
          .neq("is_flagged", true);

        if (error) throw error;

        if (!mounted) return;

        // Filter to only active deals (at the selected time, or now)
        const activeDeals = filterActiveDeals(data || [], atTime);

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
      } catch (e: unknown) {
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
  }, [restaurants, atTime]);

  return { activeDealsMap, dealTitlesMap, loading };
}
