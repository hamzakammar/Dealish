import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// --- Utilities ---

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function simpleHash(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 32);
}

// Validate API key and return restaurant_id
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

// --- Fuzzy Schema Detection (no LLM) ---

const FIELD_SYNONYMS: Record<string, string[]> = {
  title: ['title', 'name', 'item', 'product', 'deal', 'dish', 'menu item', 'item name', 'deal name', 'offer', 'description title', 'food item'],
  description: ['description', 'details', 'notes', 'info', 'about', 'promo', 'text', 'body', 'summary', 'note'],
  original_price: ['original price', 'regular price', 'full price', 'normal price', 'price', 'retail price', 'original', 'reg price', 'base price', 'msrp'],
  deal_price: ['deal price', 'sale price', 'discounted price', 'offer price', 'promo price', 'discount price', 'new price', 'special price', 'deal', 'sale', 'cost'],
  discount_percent: ['discount', 'discount %', 'discount percent', '% off', 'percent off', 'savings %', 'off %', 'reduction'],
  is_active: ['active', 'available', 'enabled', 'live', 'on', 'status', 'visible', 'show', 'published', 'active?', 'available?'],
  valid_from: ['valid from', 'start date', 'start', 'from', 'begins', 'start time', 'valid start', 'effective date', 'begins on'],
  valid_until: ['valid until', 'expiry', 'expires', 'end date', 'end', 'until', 'valid to', 'expiration', 'expiry date', 'ends', 'ends on', 'deadline'],
  category: ['category', 'type', 'kind', 'group', 'section', 'cuisine', 'food type', 'item type', 'tag', 'tags'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[_\-\/\\]+/g, ' ').replace(/\s+/g, ' ');
}

function detectSchema(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeHeader(h) }));

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let matched: string | null = null;

    // Exact match first
    for (const { original, normalized } of normalizedHeaders) {
      if (synonyms.includes(normalized)) {
        matched = original;
        break;
      }
    }

    // Partial match if no exact
    if (!matched) {
      for (const { original, normalized } of normalizedHeaders) {
        if (synonyms.some(s => normalized.includes(s) || s.includes(normalized))) {
          matched = original;
          break;
        }
      }
    }

    mapping[field] = matched;
  }

  // If deal_price not found but original_price is, use original_price as deal_price too
  if (!mapping.deal_price && mapping.original_price) {
    mapping.deal_price = mapping.original_price;
    mapping.original_price = null;
  }

  return mapping;
}

// --- Row Normalization ---

function normalizeRow(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string | null>
): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};

  for (const [field, col] of Object.entries(mapping)) {
    if (col && rawRow[col] !== undefined && rawRow[col] !== '') {
      mapped[field] = rawRow[col];
    }
  }

  if (!mapped.title) return null;

  const deal: Record<string, unknown> = { title: String(mapped.title) };

  if (mapped.description) deal.description = String(mapped.description);

  const toNum = (v: unknown) => {
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? undefined : n;
  };

  if (mapped.original_price) deal.original_price = toNum(mapped.original_price);
  if (mapped.deal_price) deal.deal_price = toNum(mapped.deal_price);
  if (mapped.discount_percent) deal.discount_percent = toNum(mapped.discount_percent);
  if (mapped.category) deal.category = String(mapped.category);

  const activeRaw = String(mapped.is_active ?? 'true').toLowerCase().trim();
  deal.is_active = ['true', 'yes', 'y', '1', 'active', 'on', 'x', '✓', '✅'].includes(activeRaw);

  const toISO = (v: unknown) => {
    try { const d = new Date(String(v)); return isNaN(d.getTime()) ? undefined : d.toISOString(); }
    catch { return undefined; }
  };
  if (mapped.valid_from) deal.valid_from = toISO(mapped.valid_from);
  if (mapped.valid_until) deal.valid_until = toISO(mapped.valid_until);

  return deal;
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

      const { sheet_id, sheet_tab = 'Sheet1', headers, sample_rows, webhook_url } = await req.json();
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
      const results: { row_index: number; action: string; deal_id?: string; error?: string }[] = [];

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

          const deal = normalizeRow(rowData, mapping);
          if (!deal) {
            results.push({ row_index, action: 'skipped_no_title' });
            continue;
          }

          const dealPayload: any = {
            restaurant_id: restaurantId,
            title: deal.title,
            description: deal.description || null,
            is_active: deal.is_active ?? true,
            source: 'sheets',
          };

          if (deal.deal_price) dealPayload.deal_price = deal.deal_price;
          if (deal.original_price) dealPayload.original_price = deal.original_price;
          if (deal.discount_percent) dealPayload.discount_percent = deal.discount_percent;
          if (deal.valid_from) dealPayload.valid_from = deal.valid_from;
          if (deal.valid_until) dealPayload.valid_until = deal.valid_until;
          if (deal.category) dealPayload.category = deal.category;

          let dealId: string;
          let action: string;

          if (existingSync?.deal_id) {
            const { error } = await supabase.from('deals').update(dealPayload).eq('id', existingSync.deal_id);
            if (error) throw error;
            dealId = existingSync.deal_id;
            action = 'updated';
          } else {
            const { data: newDeal, error } = await supabase.from('deals').insert(dealPayload).select().single();
            if (error) throw error;
            dealId = newDeal.id;
            action = 'created';
          }

          await supabase.from('sheet_synced_rows').upsert({
            integration_id,
            row_index,
            deal_id: dealId,
            row_hash: rowHash,
            last_synced_at: new Date().toISOString(),
            sync_direction: 'sheet_to_dealish',
          }, { onConflict: 'integration_id,row_index' });

          results.push({ row_index, action, deal_id: dealId });
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
      status: 500,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
