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
  return btoa(JSON.stringify(obj)).slice(0, 32);
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

  // Update last_used_at (fire and forget)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);

  return data.restaurant_id;
}

// --- LLM Schema Detection ---

async function detectSchema(headers: string[], sampleRows: unknown[][]): Promise<Record<string, string>> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = `You are analyzing a restaurant inventory/menu Google Sheet to map its columns to deal fields.

Headers: ${JSON.stringify(headers)}
Sample rows (first 5):
${sampleRows.slice(0, 5).map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n')}

Map the headers to these Dealish deal fields (use null if no match):
- title: the deal or item name
- description: details, notes, or promo text
- original_price: original/regular price (number)
- deal_price: discounted/sale price (number)
- discount_percent: percentage off (number)
- is_active: whether the deal is currently active (boolean/checkbox/Y/N)
- valid_from: start date/time
- valid_until: end date/time or expiry
- category: food category or type

Return ONLY a JSON object like:
{
  "title": "Item Name",
  "description": "Notes",
  "original_price": "Regular Price",
  "deal_price": "Sale Price",
  "discount_percent": null,
  "is_active": "Active?",
  "valid_from": null,
  "valid_until": "Expiry",
  "category": "Category"
}
Use exact header names as values, or null if not found.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const json = await resp.json();
  const text = json.content?.[0]?.text || '{}';

  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM returned no JSON');
  return JSON.parse(match[0]);
}

// --- Row Normalization ---

async function normalizeRow(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string | null>
): Promise<Partial<{
  title: string;
  description: string;
  original_price: number;
  deal_price: number;
  discount_percent: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  category: string;
}>> {
  // Apply mapping directly first
  const mapped: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(mapping)) {
    if (col && rawRow[col] !== undefined) {
      mapped[field] = rawRow[col];
    }
  }

  // If we got at least a title, try direct parse before hitting LLM
  if (mapped.title) {
    const deal: any = { title: String(mapped.title) };

    if (mapped.description) deal.description = String(mapped.description);
    if (mapped.original_price) deal.original_price = parseFloat(String(mapped.original_price).replace(/[^0-9.]/g, '')) || undefined;
    if (mapped.deal_price) deal.deal_price = parseFloat(String(mapped.deal_price).replace(/[^0-9.]/g, '')) || undefined;
    if (mapped.discount_percent) deal.discount_percent = parseFloat(String(mapped.discount_percent).replace(/[^0-9.]/g, '')) || undefined;
    if (mapped.valid_from) deal.valid_from = new Date(String(mapped.valid_from)).toISOString().catch?.(() => undefined) ?? undefined;
    if (mapped.valid_until) deal.valid_until = new Date(String(mapped.valid_until)).toISOString().catch?.(() => undefined) ?? undefined;
    if (mapped.category) deal.category = String(mapped.category);

    // Parse is_active
    const activeRaw = String(mapped.is_active || '').toLowerCase().trim();
    deal.is_active = ['true', 'yes', 'y', '1', 'active', 'on', 'x', '✓', '✅'].includes(activeRaw);

    // If we have enough data, skip LLM
    if (deal.title && (deal.deal_price || deal.discount_percent || deal.description)) {
      return deal;
    }
  }

  // Fall through to LLM for messy/ambiguous rows
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return mapped as any;

  const prompt = `Convert this restaurant inventory/menu row into a structured deal.
Row data: ${JSON.stringify(rawRow)}

Return ONLY valid JSON with these fields (omit fields you can't determine):
{
  "title": "string - deal name",
  "description": "string - details",
  "deal_price": number,
  "original_price": number,
  "discount_percent": number,
  "is_active": boolean,
  "valid_until": "ISO date string or null",
  "category": "string"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = await resp.json();
    const text = json.content?.[0]?.text || '{}';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (_) {
    // LLM failed — return what we have
  }

  return mapped as any;
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

    // --- POST /detect — detect schema from sheet sample ---
    if (path === '/detect' && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401, headers: CORS });

      const restaurantId = await validateApiKey(supabase, apiKey);
      if (!restaurantId) return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403, headers: CORS });

      const { sheet_id, sheet_tab = 'Sheet1', headers, sample_rows, webhook_url } = await req.json();
      if (!sheet_id || !headers || !sample_rows) {
        return new Response(JSON.stringify({ error: 'Missing sheet_id, headers, or sample_rows' }), { status: 400, headers: CORS });
      }

      const mapping = await detectSchema(headers, sample_rows);

      // Upsert integration record
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

    // --- POST /sync — sync rows from sheet ---
    if (path === '/sync' && req.method === 'POST') {
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API key' }), { status: 401, headers: CORS });

      const restaurantId = await validateApiKey(supabase, apiKey);
      if (!restaurantId) return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 403, headers: CORS });

      const { integration_id, rows } = await req.json();
      // rows: Array<{ row_index: number, data: Record<string, unknown> }>

      if (!integration_id || !rows?.length) {
        return new Response(JSON.stringify({ error: 'Missing integration_id or rows' }), { status: 400, headers: CORS });
      }

      // Verify integration belongs to this restaurant
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

          // Check if row already synced and unchanged
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

          // Normalize the row
          const deal = await normalizeRow(rowData, mapping);

          if (!deal.title) {
            results.push({ row_index, action: 'skipped_no_title' });
            continue;
          }

          // Build deal payload
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
            // Update existing deal
            const { error } = await supabase
              .from('deals')
              .update(dealPayload)
              .eq('id', existingSync.deal_id);
            if (error) throw error;
            dealId = existingSync.deal_id;
            action = 'updated';
          } else {
            // Insert new deal
            const { data: newDeal, error } = await supabase
              .from('deals')
              .insert(dealPayload)
              .select()
              .single();
            if (error) throw error;
            dealId = newDeal.id;
            action = 'created';
          }

          // Upsert sync record
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

      // Update last_synced_at on integration
      await supabase
        .from('sheet_integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', integration_id);

      return new Response(JSON.stringify({ results }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // --- POST /confirm-mapping — owner confirms or adjusts LLM mapping ---
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

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'content-type': 'application/json' },
      });
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
