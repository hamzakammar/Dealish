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

    // Prepare notifications for all tokens. Keep token order so we can map each
    // Expo response ticket back to the exact token that failed.
    const tokenList = Array.from(tokens);
    const messages = tokenList.map(token => ({
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

    // Inspect the per-message tickets. Expo returns { data: [ { status, id?,
    // message?, details? }, ... ] } in the SAME order as `messages`. A 200 from
    // Expo does NOT mean the notification was delivered: an Android/FCM misconfig
    // (details.error = "InvalidCredentials" / "MismatchSenderId") or a stale token
    // ("DeviceNotRegistered") shows up per-ticket. Previously these were logged as
    // a success and silently swallowed — which is exactly why broken Android push
    // looked healthy. Surface them, and prune permanently-dead tokens.
    const tickets: Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }> =
      Array.isArray(result?.data) ? result.data : [];

    let okCount = 0;
    const errors: Array<{ token: string; message?: string; error?: string }> = [];
    const deadTokens: string[] = [];

    tickets.forEach((ticket, i) => {
      const token = tokenList[i];
      if (ticket?.status === 'ok') {
        okCount++;
        return;
      }
      const errCode = ticket?.details?.error;
      errors.push({ token, message: ticket?.message, error: errCode });
      // DeviceNotRegistered => token is permanently invalid; stop using it.
      if (errCode === 'DeviceNotRegistered') deadTokens.push(token);
    });

    if (errors.length > 0) {
      console.error(
        `Push errors for user ${user_id}: ${errors.length}/${tickets.length} failed`,
        JSON.stringify(errors)
      );
    }

    // Prune permanently-dead tokens so we stop trying (and stop miscounting).
    if (deadTokens.length > 0) {
      await supabase.from('user_push_tokens').delete().in('push_token', deadTokens);
      if (profileResult.data?.push_token && deadTokens.includes(profileResult.data.push_token)) {
        await supabase.from('profiles').update({ push_token: null }).eq('id', user_id);
      }
    }

    console.log(
      `Push for user ${user_id}: ${okCount} ok, ${errors.length} error(s), ${deadTokens.length} pruned`
    );

    // `success` now reflects reality: false if any ticket errored. Still HTTP 200
    // (fire-and-forget callers shouldn't treat a partial failure as a hard error),
    // but the body carries the FCM error details for logs/observability.
    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        sent: okCount,
        failed: errors.length,
        pruned: deadTokens.length,
        errors,
      }),
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
