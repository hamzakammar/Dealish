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
    const { user_id, title, body, data, type } = await req.json() as NotificationRequest;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's profile for settings and all registered push tokens
    const [profileResult, tokensResult] = await Promise.all([
      supabase.from('profiles').select('settings').eq('id', user_id).single(),
      supabase.from('user_push_tokens').select('push_token').eq('user_id', user_id)
    ]);

    if (profileResult.error) {
      throw new Error(`Profile fetch error: ${profileResult.error.message}`);
    }

    // Determine all active tokens for this user
    // We check both the new multi-token table and the legacy column on profiles
    const tokens = new Set<string>();
    if (tokensResult.data) {
      tokensResult.data.forEach((t: any) => tokens.add(t.push_token));
    }
    
    // Check legacy column as fallback (from profiles schema)
    const { data: legacyProfile } = await supabase.from('profiles').select('push_token').eq('id', user_id).single();
    if (legacyProfile?.push_token) {
      tokens.add(legacyProfile.push_token);
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
