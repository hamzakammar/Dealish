// Square Webhook Handler
// Receives order.created events and matches them to Dealish deal redemptions.
//
// Deploy: supabase functions deploy square-webhook --no-verify-jwt
// Register https://<project>.supabase.co/functions/v1/square-webhook
// as a webhook subscription in Square Developer Console for:
//   - order.created
//   - order.updated
//   - catalog.version.updated
//   - inventory.count.updated

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const SQUARE_WEBHOOK_SIGNATURE_KEY = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY') || '';

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

function verifySignature(body: string, signature: string, url: string): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY is not set — rejecting request');
    return false;
  }
  const payload = url + body;
  const hash = createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY)
    .update(payload)
    .digest('base64');
  return timingSafeEqual(hash, signature);
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature') || '';
  const url = req.url;

  if (!verifySignature(body, signature, url)) {
    console.error('Invalid Square webhook signature');
    return new Response('Invalid signature', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const event = JSON.parse(body);
    const eventType = event.type;
    const merchantId = event.merchant_id;

    // Find the restaurant linked to this Square merchant
    const { data: tokenRow } = await supabase
      .from('square_oauth_tokens')
      .select('restaurant_id')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .maybeSingle();

    if (!tokenRow) {
      console.log(`No active restaurant for merchant ${merchantId}`);
      return new Response('OK', { status: 200 });
    }

    const restaurantId = tokenRow.restaurant_id;

    if (eventType === 'order.created' || eventType === 'order.updated') {
      await handleOrder(supabase, restaurantId, event.data?.object?.order);
    } else if (eventType === 'inventory.count.updated') {
      await handleInventoryUpdate(supabase, restaurantId, event.data?.object?.inventory_counts);
    } else if (eventType === 'catalog.version.updated') {
      // Queue a full catalog re-sync (handled by square-sync function)
      console.log(`Catalog updated for restaurant ${restaurantId}, triggering sync`);
    }

    return new Response('OK', { status: 200 });
  } catch (err: any) {
    console.error('square-webhook error:', err);
    return new Response('OK', { status: 200 }); // Always 200 to prevent retries on parse errors
  }
});

async function handleOrder(supabase: any, restaurantId: string, orderData: any) {
  if (!orderData) return;

  const order = orderData;
  const squareOrderId = order.id;
  const locationId = order.location_id;

  // Extract line items
  const lineItems = (order.line_items || []).map((li: any) => ({
    name: li.name,
    quantity: parseInt(li.quantity || '1', 10),
    base_price_cents: li.base_price_money?.amount || 0,
    total_cents: li.total_money?.amount || 0,
    catalog_object_id: li.catalog_object_id || null,
    variation_name: li.variation_name || null,
  }));

  // Calculate totals
  const totalCents = order.total_money?.amount || 0;
  const discountCents = (order.total_discount_money?.amount || 0);
  const netCents = totalCents;
  const itemCount = lineItems.reduce((sum: number, li: any) => sum + li.quantity, 0);

  // Check if any discounts match a Dealish deal
  // We match by: looking at recent redemptions for this restaurant within a 10-minute window
  const orderTime = order.created_at || new Date().toISOString();
  const windowStart = new Date(new Date(orderTime).getTime() - 10 * 60 * 1000).toISOString();

  let dealId: string | null = null;
  let scanId: string | null = null;

  if (discountCents > 0) {
    const { data: recentScans } = await supabase
      .from('qr_code_scans')
      .select('id, deal_id')
      .eq('restaurant_id', restaurantId)
      .gte('scanned_at', windowStart)
      .lte('scanned_at', orderTime)
      .order('scanned_at', { ascending: false })
      .limit(1);

    if (recentScans && recentScans.length > 0) {
      dealId = recentScans[0].deal_id;
      scanId = recentScans[0].id;
    }
  }

  await supabase.from('square_orders').upsert({
    restaurant_id: restaurantId,
    square_order_id: squareOrderId,
    square_location_id: locationId,
    deal_id: dealId,
    redemption_scan_id: scanId,
    total_cents: totalCents,
    discount_cents: discountCents,
    net_cents: netCents,
    item_count: itemCount,
    line_items: lineItems,
    order_created_at: orderTime,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'restaurant_id,square_order_id' });
}

async function handleInventoryUpdate(supabase: any, restaurantId: string, counts: any[]) {
  if (!counts || counts.length === 0) return;

  for (const count of counts) {
    const catalogObjectId = count.catalog_object_id;
    const quantity = parseFloat(count.quantity || '0');
    const inStock = quantity > 0;

    // Update the synced catalog item's stock status
    await supabase
      .from('square_catalog_items')
      .update({ in_stock: inStock, synced_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .eq('square_variation_id', catalogObjectId);

    // Also update Dealish inventory if we have a matching product
    const { data: catalogItem } = await supabase
      .from('square_catalog_items')
      .select('name')
      .eq('restaurant_id', restaurantId)
      .eq('square_variation_id', catalogObjectId)
      .maybeSingle();

    if (catalogItem) {
      // Try to match to existing product by name
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .ilike('name', catalogItem.name)
        .maybeSingle();

      if (product) {
        await supabase
          .from('inventory_items')
          .update({
            quantity,
            status: inStock ? 'active' : 'low_stock',
            updated_at: new Date().toISOString(),
          })
          .eq('product_id', product.id)
          .eq('restaurant_id', restaurantId);
      }
    }
  }
}
