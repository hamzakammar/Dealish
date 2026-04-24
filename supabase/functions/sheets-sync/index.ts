import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function simpleHash(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 32);
}

async function validateApiKey(supabase: any, rawKey: string): Promise<string | null> {
  const hash = await sha256(rawKey);
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, restaurant_id')
    .eq('key_hash', hash)
    .single();
  if (error || !data) return null;
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return data.restaurant_id;
}

// --- Fuzzy Schema Detection ---

const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ['name', 'item', 'product', 'title', 'item name', 'product name', 'food item', 'dish', 'ingredient', 'description'],
  category: ['category', 'type', 'kind', 'group', 'section', 'food type', 'item type', 'tag', 'tags', 'cuisine'],
  unit: ['unit', 'uom', 'unit of measure', 'measure', 'size', 'pack size', 'packaging'],
  supplier: ['supplier', 'vendor', 'source', 'brand', 'distributor', 'from'],
  quantity: ['quantity', 'qty', 'amount', 'count', 'stock', 'on hand', 'in stock', 'units', 'total', 'available', 'inventory'],
  unit_cost: ['cost', 'price', 'unit cost', 'unit price', 'purchase price', 'buy price', 'cost per unit', 'each', 'per unit'],
  expiration_date: ['expiry', 'expiration', 'expires', 'expiration date', 'expiry date', 'best before', 'use by', 'best by', 'sell by', 'exp', 'exp date'],
  location: ['location', 'storage', 'store', 'where', 'place', 'area', 'section', 'zone', 'bin', 'shelf'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'memo', 'info', 'details'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_\-\/\\]+/g, ' ').replace(/\s+/g, ' ');
}

function detectSchema(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeHeader(h) }));

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let matched: string | null = null;
    for (const { original, normalized } of normalizedHeaders) {
      if (synonyms.includes(normalized)) { matched = original; break; }
    }
    if (!matched) {
      for (const { original, normalized } of normalizedHeaders) {
        if (synonyms.some(s => normalized.includes(s) || s.includes(normalized))) {
          matched = original; break;
        }
      }
    }
    mapping[field] = matched;
  }

  return mapping;
}

function normalizeRow(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string | null>
): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(mapping)) {
    if (col && rowObj[col] !== undefined && rowObj[col] !== '') {
      mapped[field] = rowObj[col];
    }
  }

  if (!mapped.name) return null;

  const result: Record<string, unknown> = { name: String(mapped.name).trim() };

  if (mapped.category) result.category = String(mapped.category).trim().toLowerCase();
  if (mapped.unit) result.unit = String(mapped.unit).trim().toLowerCase();
  if (mapped.supplier) result.supplier = String(mapped.supplier).trim();
  if (mapped.notes) result.notes = String(mapped.notes).trim();

  const toNum = (v: unknown) => {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? undefined : n;
  };

  if (mapped.quantity !== undefined) result.quantity = toNum(mapped.quantity) ?? 1;
  if (mapped.unit_cost !== undefined) result.unit_cost = toNum(mapped.unit_cost);

  const toISO = (v: unknown) => {
    try { const d = new Date(String(v)); return isNaN(d.getTime()) ? undefined : d.toISOString(); }
    catch { return undefined; }
  };

  if (mapped.expiration_date) result.expiration_date = toISO(mapped.expiration_date);
  if (mapped.location) result.location = String(mapped.location).trim().toLowerCase();

  return result;
}

// --- Main Handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/sheets-sync/, '');

    // --- POST /detect ---
    if (path === '/detect' && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401, headers: CORS });

      const restaurantId = await validateApiKey(supabase, apiKey);
      if (!restaurantId) return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403, headers: CORS });

      const { sheet_id, sheet_tab = 'Sheet1', headers, webhook_url } = await req.json();
      if (!sheet_id || !headers) {
        return new Response(JSON.stringify({ error: 'Missing sheet_id or headers' }), { status: 400, headers: CORS });
      }

      const mapping = detectSchema(headers);

      const { data: integration, error: upsertErr } = await supabase
        .from('sheet_integrations')
        .upsert({
          restaurant_id: restaurantId,
          sheet_id,
          sheet_tab,
          webhook_url: webhook_url || null,
          detected_mapping: mapping,
          mapping_confirmed: false,
        }, { onConflict: 'restaurant_id,sheet_id' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      return new Response(JSON.stringify({ integration_id: integration.id, mapping }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // --- POST /sync ---
    if (path === '/sync' && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401, headers: CORS });

      const restaurantId = await validateApiKey(supabase, apiKey);
      if (!restaurantId) return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403, headers: CORS });

      const { integration_id, rows } = await req.json();
      if (!integration_id || !rows?.length) {
        return new Response(JSON.stringify({ error: 'Missing integration_id or rows' }), { status: 400, headers: CORS });
      }

      const { data: integration, error: intErr } = await supabase
        .from('sheet_integrations')
        .select('*')
        .eq('id', integration_id)
        .eq('restaurant_id', restaurantId)
        .single();

      if (intErr || !integration) {
        return new Response(JSON.stringify({ error: 'Integration not found' }), { status: 404, headers: CORS });
      }

      const mapping = integration.detected_mapping || {};
      const results: { row_index: number; action: string; inventory_item_id?: string; error?: string }[] = [];

      for (const { row_index, data: rowData } of rows) {
        try {
          const rowHash = simpleHash(rowData);

          const { data: existingSync } = await supabase
            .from('sheet_synced_rows')
            .select('*')
            .eq('integration_id', integration_id)
            .eq('row_index', row_index)
            .single();

          if (existingSync?.row_hash === rowHash) {
            results.push({ row_index, action: 'skipped_unchanged' });
            continue;
          }

          const item = normalizeRow(rowData, mapping);
          if (!item) {
            results.push({ row_index, action: 'skipped_no_name' });
            continue;
          }

          let inventoryItemId: string;
          let action: string;

          if (existingSync?.deal_id) {
            inventoryItemId = existingSync.deal_id;
            const { data: existingItem } = await supabase.from('inventory_items').select('product_id').eq('id', inventoryItemId).single();

            if (existingItem) {
              await supabase.from('products').update({
                name: item.name, category: item.category || null,
                unit: item.unit || 'unit', supplier: item.supplier || null,
                updated_at: new Date().toISOString(),
              }).eq('id', existingItem.product_id);

              const inv: any = { updated_at: new Date().toISOString() };
              if (item.quantity !== undefined) inv.quantity = item.quantity;
              if (item.unit_cost !== undefined) inv.unit_cost = item.unit_cost;
              if (item.expiration_date) inv.expiration_date = item.expiration_date;
              if (item.location) inv.location = item.location;
              if (item.notes) inv.notes = item.notes;
              await supabase.from('inventory_items').update(inv).eq('id', inventoryItemId);
            }
            action = 'updated';
          } else {
            const { data: newProduct, error: pErr } = await supabase.from('products').insert({
              restaurant_id: restaurantId,
              name: item.name,
              category: item.category || 'other',
              unit: item.unit || 'unit',
              supplier: item.supplier || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select().single();
            if (pErr) throw pErr;

            const invPayload: any = {
              restaurant_id: restaurantId,
              product_id: newProduct.id,
              quantity: item.quantity ?? 1,
              unit: item.unit || 'unit',
              status: 'active',
              received_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            if (item.unit_cost !== undefined) invPayload.unit_cost = item.unit_cost;
            if (item.expiration_date) invPayload.expiration_date = item.expiration_date;
            if (item.location) invPayload.location = item.location;
            if (item.notes) invPayload.notes = item.notes;

            const { data: newItem, error: iErr } = await supabase.from('inventory_items').insert(invPayload).select().single();
            if (iErr) throw iErr;
            inventoryItemId = newItem.id;
            action = 'created';
          }

          await supabase.from('sheet_synced_rows').upsert({
            integration_id,
            row_index,
            deal_id: inventoryItemId,
            row_hash: rowHash,
            last_synced_at: new Date().toISOString(),
            sync_direction: 'sheet_to_dealish',
          }, { onConflict: 'integration_id,row_index' });

          results.push({ row_index, action, inventory_item_id: inventoryItemId });
        } catch (err: any) {
          results.push({ row_index, action: 'error', error: err.message });
        }
      }

      await supabase.from('sheet_integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', integration_id);

      return new Response(JSON.stringify({ results }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // --- POST /confirm-mapping ---
    if (path === '/confirm-mapping' && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401, headers: CORS });

      const restaurantId = await validateApiKey(supabase, apiKey);
      if (!restaurantId) return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403, headers: CORS });

      const { integration_id, mapping } = await req.json();
      const { error } = await supabase
        .from('sheet_integrations')
        .update({ detected_mapping: mapping, mapping_confirmed: true })
        .eq('id', integration_id)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS });
  } catch (err: any) {
    console.error('sheets-sync error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
