import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Deal } from "@/types/restaurant";

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
          setDeals(data || []);
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

    return () => {
      mounted = false;
    };
  }, [restaurantId]);

  return { deals, loading, error };
}