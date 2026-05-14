import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal } from "@/types/restaurant";

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
      } catch (e: unknown) {
        console.error("Error fetching deals:", e);
        if (mounted) {
          setError(e instanceof Error ? e : new Error('Unknown error'));
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