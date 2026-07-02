import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationRequest {
  user_id: string;
  type?: 'new_deal' | 'deal_redeemed' | 'new_partner';
  title: string;
  body: string;
  data?: {
    deal_id?: string;
    restaurant_id?: string;
    screen?: string;
    [key: string]: any;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Initialize Supabase client (service role for token/settings lookups).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, title, body, data, type } = await req.json() as NotificationRequest;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // AUTHORIZATION: this function is deployed with JWT verification, so any
    // authenticated caller reaches here. Prevent one user from spamming another:
    // allow only (a) notifying yourself, or (b) owner/admin callers who legitimately
    // fan out deal/partner notifications. Anything else is rejected.
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { data: { user: caller }, error: callerErr } = await supabase.auth.getUser(jwt);
    if (callerErr || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (caller.id !== user_id) {
      const { data: callerProfile } = await supabase
        .from('profiles').select('role').eq('id', caller.id).single();
      const isMerchant = callerProfile?.role === 'owner' || callerProfile?.role === 'admin';
      if (!isMerchant) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to notify other users' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get user's profile (settings + legacy push_token column) and all registered
    // push tokens in one round trip each.
    const [profileResult, tokensResult] = await Promise.all([
      supabase.from('profiles').select('settings, push_token').eq('id', user_id).single(),
      supabase.from('user_push_tokens').select('push_token').eq('user_id', user_id)
    ]);

    if (profileResult.error) {
      throw new Error(`Profile fetch error: ${profileResult.error.message}`);
    }

    // Determine all active tokens for this user. We check both the new multi-token
    // table and the legacy column on profiles.
    const tokens = new Set<string>();
    if (tokensResult.data) {
      tokensResult.data.forEach((t: any) => tokens.add(t.push_token));
    }
    if (profileResult.data?.push_token) {
      tokens.add(profileResult.data.push_token);
    }

    if (tokens.size === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check user notification settings
    const settings = profileResult.data.settings || {};
    const notifications = settings.notifications || {};
    const notificationType = type || data?.type;
    
    let shouldSend = true;
    if (notificationType === 'new_deal') {
      shouldSend = notifications.favorites !== false;
    } else if (notificationType === 'deal_redeemed') {
      shouldSend = notifications.visits !== false;
    } else if (notificationType === 'new_partner') {
      shouldSend = notifications.deals !== false;
    }

    if (!shouldSend) {
      return new Response(
        JSON.stringify({ message: 'Notification disabled by user settings' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notifications for all tokens
    const messages = Array.from(tokens).map(token => ({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: {
        ...data,
        type: notificationType,
      },
    }));

    // Send notifications via Expo Push Service (batch request)
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text();
      throw new Error(`Expo Push Service error: ${errorText}`);
    }

    const result = await pushResponse.json();
    
    // Cleanup invalid tokens (optional enhancement: detect "DeviceNotRegistered")
    // For Phase 3, we'll just log the result
    console.log(`Sent ${messages.length} notifications for user ${user_id}`, result);
    
    return new Response(
      JSON.stringify({ success: true, count: messages.length, result }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
