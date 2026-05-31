import { supabase } from "@/app/lib/supabase";

/**
 * Client wrapper for the server-side `places` edge function (Google Places API).
 * Keeps the Google key server-side. Each call is best-effort: on any failure the
 * helpers return null/[] so callers can fall back (e.g. manual lat/lng entry).
 */

export type PlaceSuggestion = {
  placeId: string;
  description: string;
};

export type PlaceDetails = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  name: string | null;
  rating: number | null;
  userRatingCount: number | null;
};

async function invokePlaces<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("places", { body });
    if (error) {
      console.warn("places fn error:", error.message);
      return null;
    }
    return data as T;
  } catch (err) {
    console.warn("places fn threw:", err);
    return null;
  }
}

export async function placesAutocomplete(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.trim().length < 3) return [];
  const data = await invokePlaces<{ suggestions?: PlaceSuggestion[] }>({
    action: "autocomplete",
    input: input.trim(),
  });
  return data?.suggestions ?? [];
}

export async function placeDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId) return null;
  const data = await invokePlaces<{ place?: PlaceDetails | null }>({
    action: "details",
    placeId,
  });
  return data?.place ?? null;
}

export async function placesGeocode(address: string): Promise<PlaceDetails | null> {
  if (!address || !address.trim()) return null;
  const data = await invokePlaces<{ place?: PlaceDetails | null }>({
    action: "geocode",
    address: address.trim(),
  });
  return data?.place ?? null;
}
