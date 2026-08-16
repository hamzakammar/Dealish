#!/usr/bin/env node
/**
 * notify-active-deals.js
 *
 * Notifies users who favourited a restaurant when one of its deals has just
 * entered its active window. Complements the "new deal published" push
 * (utils/notifications.ts notifyNewDeal, sent at deal-creation time).
 *
 * Idempotency lives in the DB: claim_active_deal_notifications() (an atomic
 * UPDATE ... RETURNING that stamps deals.last_active_notified_at) is the claim,
 * so overlapping/re-run crons never double-send. We deliberately claim BEFORE
 * sending — if an Expo send fails, the failure mode is a rare miss, never a
 * duplicate/spam.
 *
 * Run by .github/workflows/notify-active-deals.yml on a schedule.
 * Requires SUPABASE_SERVICE_KEY (service role) — server-side only, never shipped.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpsoqjpzebkkxdqapegl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_KEY env var required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mirror getNotificationRecipients()'s favourites gate in utils/notifications.ts:
// a new-deal / favourites notification is on unless explicitly disabled.
function favouritesEnabled(settings) {
  const n = settings && settings.notifications;
  return !n || n.favorites !== false;
}

// Union of legacy profiles.push_token + multi-device user_push_tokens for every
// user who favourited the restaurant and hasn't disabled favourites notifications.
async function tokensForFavouriters(restaurantId) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, push_token, settings, favourites')
    .contains('favourites', [restaurantId]);
  if (error) throw error;

  const users = (profiles || []).filter((p) => favouritesEnabled(p.settings));
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);
  const { data: deviceTokens } = await supabase
    .from('user_push_tokens')
    .select('user_id, push_token')
    .in('user_id', userIds);

  const tokenSet = new Set();
  for (const u of users) if (u.push_token) tokenSet.add(u.push_token);
  for (const t of deviceTokens || []) if (t.push_token) tokenSet.add(t.push_token);
  return [...tokenSet];
}

async function sendExpo(messages) {
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error('Expo push failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (e) {
      console.error('Expo push threw:', e.message || e);
    }
  }
}

async function main() {
  const { data: deals, error } = await supabase.rpc('claim_active_deal_notifications');
  if (error) {
    console.error('claim_active_deal_notifications failed:', error.message);
    process.exit(1);
  }
  if (!deals || deals.length === 0) {
    console.log('No newly-active deals to notify.');
    return;
  }

  let totalDevices = 0;
  for (const d of deals) {
    const tokens = await tokensForFavouriters(d.restaurant_id);
    if (tokens.length === 0) continue;
    const messages = tokens.map((token) => ({
      to: token,
      title: `Deal active now at ${d.restaurant_name}`,
      body: `${d.deal_title} is live`,
      sound: 'default',
      priority: 'high',
      data: {
        deal_id: d.deal_id,
        restaurant_id: d.restaurant_id,
        screen: '/map',
        type: 'deal_active',
      },
    }));
    await sendExpo(messages);
    totalDevices += tokens.length;
    console.log(`Notified ${tokens.length} device(s): "${d.deal_title}" @ ${d.restaurant_name}`);
  }
  console.log(`Done. ${deals.length} deal(s), ${totalDevices} device(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
