import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Verify user JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: CORS });

    const { code, redirect_uri, restaurant_id, sheet_id, sheet_tab = 'Sheet1' } = await req.json();
    if (!code || !redirect_uri || !restaurant_id) {
      return new Response(JSON.stringify({ error: 'Missing code, redirect_uri, or restaurant_id' }), { status: 400, headers: CORS });
    }

    // Verify restaurant ownership
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurant_id)
      .eq('owner_id', user.id)
      .single();

    if (!restaurant) return new Response(JSON.stringify({ error: 'Restaurant not found or not yours' }), { status: 403, headers: CORS });

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      console.error('Token exchange failed:', err);
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: err }), { status: 400, headers: CORS });
    }

    const tokens = await tokenResp.json();
    if (!tokens.refresh_token) {
      return new Response(JSON.stringify({ error: 'No refresh token returned. Ensure prompt=consent was set.' }), { status: 400, headers: CORS });
    }

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens
    await supabase.from('google_oauth_tokens').upsert({
      user_id: user.id,
      restaurant_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,restaurant_id' });

    // Create/update sheet integration record
    if (sheet_id) {
      await supabase.from('sheet_integrations').upsert({
        restaurant_id,
        sheet_id,
        sheet_tab,
        sync_method: 'oauth_cron',
      }, { onConflict: 'restaurant_id,sheet_id' });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'content-type': 'application/json' } });
  } catch (err: any) {
    console.error('google-oauth error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
