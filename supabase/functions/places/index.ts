// Server-side Google Places proxy (New Places API v1).
//
// Why server-side: the Google key stays out of the app bundle, and Places API
// can be enabled/restricted on a single server key (the same one already used by
// scripts/refresh-restaurant-photos-places.js). The app calls this via
// supabase.functions.invoke('places', { body: { action, ... } }).
//
// Actions:
//   { action: 'autocomplete', input }          -> { suggestions: [{ placeId, description }] }
//   { action: 'details', placeId }             -> { place }
//   { action: 'geocode', address }             -> { place }   (first text-search match)
// where `place` = { lat, lng, address, name, rating, userRatingCount }.
//
// Required secret (set in Supabase): GOOGLE_MAPS_API_KEY (Places API must be enabled).
//   supabase secrets set GOOGLE_MAPS_API_KEY=...
//   supabase functions deploy places

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Default to Canada; override per request if needed.
const REGION = 'ca';

type PlaceResult = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  name: string | null;
  rating: number | null;
  userRatingCount: number | null;
};

function normalizePlace(p: any): PlaceResult {
  return {
    lat: p?.location?.latitude ?? null,
    lng: p?.location?.longitude ?? null,
    address: p?.formattedAddress ?? null,
    name: p?.displayName?.text ?? null,
    rating: typeof p?.rating === 'number' ? p.rating : null,
    userRatingCount: typeof p?.userRatingCount === 'number' ? p.userRatingCount : null,
  };
}

const DETAILS_FIELDS = 'location,formattedAddress,displayName,rating,userRatingCount';
const SEARCH_FIELDS =
  'places.location,places.formattedAddress,places.displayName,places.rating,places.userRatingCount,places.id';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return json({ error: 'Places not configured (GOOGLE_MAPS_API_KEY secret missing).' }, 500);
  }

  // Edge functions verify the caller's JWT by default; require it explicitly too.
  if (!req.headers.get('authorization')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = payload?.action as string | undefined;

  try {
    if (action === 'autocomplete') {
      const input = (payload?.input ?? '').toString().trim();
      if (input.length < 3) return json({ suggestions: [] });

      const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
        body: JSON.stringify({ input, includedRegionCodes: [REGION] }),
      });
      if (!resp.ok) {
        return json({ error: `Autocomplete failed (HTTP ${resp.status})`, suggestions: [] }, 502);
      }
      const data = await resp.json();
      const suggestions = (data?.suggestions ?? [])
        .map((s: any) => s?.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
          placeId: p.placeId,
          description: p?.text?.text ?? p?.structuredFormat?.mainText?.text ?? '',
        }))
        .filter((s: any) => s.placeId && s.description);
      return json({ suggestions });
    }

    if (action === 'details') {
      const placeId = (payload?.placeId ?? '').toString().trim();
      if (!placeId) return json({ error: 'Missing placeId' }, 400);

      const resp = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
        { headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAILS_FIELDS } }
      );
      if (!resp.ok) return json({ error: `Details failed (HTTP ${resp.status})` }, 502);
      const data = await resp.json();
      return json({ place: normalizePlace(data) });
    }

    if (action === 'geocode') {
      const address = (payload?.address ?? '').toString().trim();
      if (!address) return json({ error: 'Missing address' }, 400);

      const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': SEARCH_FIELDS,
        },
        body: JSON.stringify({ textQuery: address, regionCode: REGION.toUpperCase() }),
      });
      if (!resp.ok) return json({ error: `Geocode failed (HTTP ${resp.status})` }, 502);
      const data = await resp.json();
      const first = data?.places?.[0];
      if (!first) return json({ place: null });
      return json({ place: normalizePlace(first) });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Places request failed' }, 500);
  }
});
