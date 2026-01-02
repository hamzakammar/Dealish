import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { supabase } from "@/app/lib/supabase";
import { Restaurant } from "@/types/restaurant";

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRestaurants() {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id,name,lat,lng")
          .eq("is_active", true)
          .limit(500);

        if (error) throw error;

        const parsed: Restaurant[] =
          data?.map((r: any) => ({
            id: r.id,
            name: r.name,
            lat: Number(r.lat),
            lng: Number(r.lng),
          })) ?? [];

        if (mounted) setRestaurants(parsed);
      } catch (e: any) {
        console.error(e);
        if (mounted) {
          setError(e);
          Alert.alert("Error", e?.message ?? "Something went wrong");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchRestaurants();
    return () => {
      mounted = false;
    };
  }, []);

  return { restaurants, loading, error };
}

