import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SQUARE_TOKEN_URL = 'https://connect.squareup.com/oauth2/token';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: CORS });

    const { code, restaurant_id } = await req.json();
    if (!code || !restaurant_id) {
      return new Response(JSON.stringify({ error: 'Missing code or restaurant_id' }), { status: 400, headers: CORS });
    }

    // Verify restaurant access
    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('role')
      .eq('restaurant_id', restaurant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not authorized for this restaurant' }), { status: 403, headers: CORS });
    }

    // Exchange code for tokens
    const clientId = Deno.env.get('SQUARE_APPLICATION_ID');
    const clientSecret = Deno.env.get('SQUARE_APPLICATION_SECRET');

    const tokenResp = await fetch(SQUARE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error('Square token exchange failed:', err);
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: err }), { status: 400, headers: CORS });
    }

    const tokens = await tokenResp.json();
    const { access_token, refresh_token, expires_at, merchant_id } = tokens;

    if (!access_token || !refresh_token) {
      return new Response(JSON.stringify({ error: 'Missing tokens in Square response' }), { status: 400, headers: CORS });
    }

    // Fetch merchant locations
    const locResp = await fetch('https://connect.squareup.com/v2/locations', {
      headers: { 'Authorization': `Bearer ${access_token}`, 'Square-Version': '2024-01-18' },
    });
    const locData = locResp.ok ? await locResp.json() : { locations: [] };
    const locationIds = (locData.locations || []).map((l: any) => l.id);

    // Store tokens in Vault
    const { data: existingRow } = await supabase
      .from('square_oauth_tokens')
      .select('id, access_token_id, refresh_token_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    let accessTokenId: string;
    let refreshTokenId: string;

    if (existingRow?.access_token_id && existingRow?.refresh_token_id) {
      await supabase.rpc('update_oauth_secret', { p_id: existingRow.access_token_id, p_value: access_token });
      await supabase.rpc('update_oauth_secret', { p_id: existingRow.refresh_token_id, p_value: refresh_token });
      accessTokenId = existingRow.access_token_id;
      refreshTokenId = existingRow.refresh_token_id;
    } else {
      const { data: aId } = await supabase.rpc('create_oauth_secret', {
        p_value: access_token,
        p_name: `square_access_${user.id}_${restaurant_id}`,
      });
      const { data: rId } = await supabase.rpc('create_oauth_secret', {
        p_value: refresh_token,
        p_name: `square_refresh_${user.id}_${restaurant_id}`,
      });
      if (!aId || !rId) throw new Error('Failed to store tokens in vault');
      accessTokenId = aId as string;
      refreshTokenId = rId as string;
    }

    await supabase.from('square_oauth_tokens').upsert({
      user_id: user.id,
      restaurant_id,
      merchant_id,
      location_ids: locationIds,
      access_token_id: accessTokenId,
      refresh_token_id: refreshTokenId,
      token_expiry: expires_at,
      scopes: ['ITEMS_READ', 'ORDERS_READ', 'MERCHANT_PROFILE_READ', 'INVENTORY_READ'],
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,restaurant_id' });

    return new Response(JSON.stringify({ ok: true, merchant_id, locations: locationIds.length }), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (err: any) {
    console.error('square-oauth error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
