import { supabase } from "@/app/lib/supabase";
import { Restaurant } from "@/types/restaurant";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

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
          .select("id,name,lat,lng,address,phone,hero_image_url")
          .eq("is_active", true)
          .limit(500);

        if (error) throw error;

        const parsed: Restaurant[] =
          data?.map((r: any) => ({
            id: r.id,
            name: r.name,
            lat: Number(r.lat),
            lng: Number(r.lng),
            description: r.description ?? undefined,
            address: r.address ?? undefined,
            phone: r.phone ?? undefined,
            cuisine_type: r.cuisine_type ?? undefined,
            image_url: r.hero_image_url ?? undefined,
            logo_url: r.hero_image_url ?? undefined,
          })) ?? [];

        if (mounted) setRestaurants(parsed);
      } catch (e: any) {
        console.error(e);
        if (mounted) {
          setError(e);
          Alert.alert("Error", e?.message ?? "Unable to load restaurants. Please check your internet connection and try again.");
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

