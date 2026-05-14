import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal, Restaurant } from "@/types/restaurant";

const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead

/**
 * Returns true if a recurring deal is active now or starts within 1 hour today.
 */
function isRecurringDealActive(deal: Deal): boolean {
  if (!deal.is_recurring || !deal.recurrence_days || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    return false;
  }

  const now = new Date();
  if (!deal.recurrence_days.includes(now.getDay())) {
    return false;
  }

  const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"

  // Active right now
  if (currentTime >= deal.recurrence_start_time && currentTime <= deal.recurrence_end_time) {
    return true;
  }

  // Starts within 1 hour
  if (currentTime < deal.recurrence_start_time) {
    const [sh, sm] = deal.recurrence_start_time.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return startMinutes - nowMinutes <= 60;
  }

  return false;
}

/**
 * Returns true if a one-time deal is active now or starts within 1 hour.
 */
function isOneTimeDealActive(deal: Deal): boolean {
  const now = new Date();

  if (deal.end_at && new Date(deal.end_at) < now) {
    return false;
  }

  if (deal.start_at) {
    const startAt = new Date(deal.start_at);
    if (startAt > now) {
      // Not started yet — show if starting within 1 hour
      return startAt.getTime() - now.getTime() <= SOON_MS;
    }
  }

  return true;
}

/**
 * Filters deals to active now or starting within 1 hour.
 */
function filterActiveDeals(deals: Deal[]): Deal[] {
  return deals.filter((deal) => {
    const now = new Date();

    if (deal.end_at && new Date(deal.end_at) < now) {
      return false; // Expired
    }

    if (deal.is_recurring && deal.recurrence_days && deal.recurrence_start_time && deal.recurrence_end_time) {
      return isRecurringDealActive(deal);
    }

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
  }, [restaurants]);

  return { activeDealsMap, dealTitlesMap, loading };
}
