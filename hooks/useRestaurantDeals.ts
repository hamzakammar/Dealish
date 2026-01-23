import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal } from "@/types/restaurant";

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

export function useRestaurantDeals(restaurantId: string | null) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setDeals([]);
      return;
    }

    let mounted = true;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("deals")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (mounted) {
          // Filter deals to only show currently active ones
          const activeDeals = filterActiveDeals(data || []);
          setDeals(activeDeals);
        }
      } catch (e: any) {
        console.error("Error fetching deals:", e);
        if (mounted) {
          setError(e);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchDeals();

    // Set up interval to re-check recurring deals every minute
    const interval = setInterval(() => {
      if (mounted && restaurantId) {
        fetchDeals();
      }
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [restaurantId]);

  return { deals, loading, error };
}