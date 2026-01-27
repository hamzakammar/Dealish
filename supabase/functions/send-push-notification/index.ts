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
    type?: string;
    [key: string]: any;
  };
}

serve(async (req) => {
  try {
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

    const { user_id, title, body, data } = await req.json() as NotificationRequest;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's push token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('push_token, settings')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.push_token) {
      console.error('Error fetching push token:', profileError);
      return new Response(
        JSON.stringify({ error: 'User push token not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check user settings
    const settings = profile.settings || {};
    const notifications = settings.notifications || {};
    
    // Determine if notification should be sent based on type
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
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Send notification via Expo Push Service
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: profile.push_token,
        title,
        body,
        sound: 'default',
        priority: 'high',
        data: {
          ...data,
          type: notificationType,
        },
      }),
    });

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text();
      console.error('Expo Push Service error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification', details: errorText }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await pushResponse.json();
    
    return new Response(
      JSON.stringify({ success: true, result }),
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
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
