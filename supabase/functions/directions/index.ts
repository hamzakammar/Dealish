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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('ORS_API_KEY');
  if (!apiKey) {
    return json({ error: 'Directions not configured (ORS_API_KEY secret missing).' }, 500);
  }

  if (!req.headers.get('authorization')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { start, end } = payload ?? {};
  if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
    return json({ error: 'Missing start/end coordinates ([lng, lat])' }, 400);
  }

  try {
    const resp = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car?format=geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({ coordinates: [start, end] }),
      }
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      return json({ error: `ORS API error (${resp.status}): ${errorText}` }, 502);
    }

    const data = await resp.json();
    return json(data);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Directions request failed' }, 500);
  }
});
