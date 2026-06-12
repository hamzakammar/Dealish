// Square Catalog & Inventory Sync
// Pulls catalog items (menu) and inventory counts from Square POS
// and syncs them into square_catalog_items + Dealish products/inventory tables.
//
// Called on-demand via POST or by a scheduled cron.
// Requires: restaurant_id in body (or syncs all connected restaurants if omitted).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SQUARE_API = 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2024-01-18';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetRestaurantId = body.restaurant_id || null;

    // Get all active Square connections (or just one if specified)
    let query = supabase
      .from('square_oauth_tokens')
      .select('restaurant_id, merchant_id, location_ids, access_token_id')
      .eq('is_active', true);

    if (targetRestaurantId) {
      query = query.eq('restaurant_id', targetRestaurantId);
    }

    const { data: connections, error: connErr } = await query;
    if (connErr) throw connErr;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No active Square connections' }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const conn of connections) {
      try {
        // Read access token from vault
        const { data: accessToken } = await supabase.rpc('read_oauth_secret', {
          p_id: conn.access_token_id,
        });

        if (!accessToken) {
          results.push({ restaurant_id: conn.restaurant_id, error: 'No access token in vault' });
          continue;
        }

        const headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': SQUARE_VERSION,
          'Content-Type': 'application/json',
        };

        // Sync catalog items
        const catalogResult = await syncCatalog(supabase, conn.restaurant_id, headers);

        // Sync inventory counts for all locations
        const inventoryResult = await syncInventory(supabase, conn.restaurant_id, conn.location_ids || [], headers);

        results.push({
          restaurant_id: conn.restaurant_id,
          catalog_items: catalogResult.count,
          inventory_updated: inventoryResult.count,
        });

        // Log the sync
        await supabase.from('inventory_sync_logs').insert({
          restaurant_id: conn.restaurant_id,
          source: 'square',
          status: 'success',
          items_synced: catalogResult.count,
          details: { catalog: catalogResult.count, inventory: inventoryResult.count },
        });
      } catch (err: any) {
        console.error(`Sync failed for restaurant ${conn.restaurant_id}:`, err);
        results.push({ restaurant_id: conn.restaurant_id, error: err.message });

        await supabase.from('inventory_sync_logs').insert({
          restaurant_id: conn.restaurant_id,
          source: 'square',
          status: 'error',
          items_synced: 0,
          details: { error: err.message },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  } catch (err: any) {
    console.error('square-sync error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});

async function syncCatalog(supabase: any, restaurantId: string, headers: Record<string, string>) {
  let cursor: string | undefined;
  let totalCount = 0;

  do {
    const body: any = {
      object_types: ['ITEM'],
      include_related_objects: true,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const resp = await fetch(`${SQUARE_API}/catalog/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Catalog fetch failed: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    const objects = data.objects || [];
    cursor = data.cursor;

    // Build category lookup from related objects
    const categories: Record<string, string> = {};
    for (const obj of (data.related_objects || [])) {
      if (obj.type === 'CATEGORY') {
        categories[obj.id] = obj.category_data?.name || '';
      }
    }

    const upserts: any[] = [];
    for (const item of objects) {
      if (item.type !== 'ITEM') continue;
      const itemData = item.item_data;
      if (!itemData) continue;

      const categoryName = itemData.category_id ? (categories[itemData.category_id] || null) : null;

      for (const variation of (itemData.variations || [])) {
        const varData = variation.item_variation_data;
        if (!varData) continue;

        upserts.push({
          restaurant_id: restaurantId,
          square_item_id: item.id,
          square_variation_id: variation.id,
          name: itemData.name + (varData.name && varData.name !== 'Regular' ? ` (${varData.name})` : ''),
          description: itemData.description || null,
          category: categoryName,
          price_cents: varData.price_money?.amount || null,
          currency: varData.price_money?.currency || 'CAD',
          synced_at: new Date().toISOString(),
        });
      }
    }

    if (upserts.length > 0) {
      await supabase
        .from('square_catalog_items')
        .upsert(upserts, { onConflict: 'restaurant_id,square_item_id,square_variation_id' });
      totalCount += upserts.length;
    }
  } while (cursor);

  return { count: totalCount };
}

async function syncInventory(supabase: any, restaurantId: string, locationIds: string[], headers: Record<string, string>) {
  if (locationIds.length === 0) return { count: 0 };

  // Get all catalog variation IDs we've synced
  const { data: catalogItems } = await supabase
    .from('square_catalog_items')
    .select('square_variation_id')
    .eq('restaurant_id', restaurantId);

  if (!catalogItems || catalogItems.length === 0) return { count: 0 };

  const variationIds = catalogItems.map((c: any) => c.square_variation_id).filter(Boolean);
  let totalUpdated = 0;

  // Batch in groups of 100 (Square limit)
  for (let i = 0; i < variationIds.length; i += 100) {
    const batch = variationIds.slice(i, i + 100);

    const resp = await fetch(`${SQUARE_API}/inventory/counts/batch-retrieve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        catalog_object_ids: batch,
        location_ids: locationIds,
      }),
    });

    if (!resp.ok) continue;

    const data = await resp.json();
    const counts = data.counts || [];

    for (const count of counts) {
      const quantity = parseFloat(count.quantity || '0');
      const inStock = quantity > 0;

      await supabase
        .from('square_catalog_items')
        .update({ in_stock: inStock, synced_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId)
        .eq('square_variation_id', count.catalog_object_id);

      totalUpdated++;
    }
  }

  return { count: totalUpdated };
}
