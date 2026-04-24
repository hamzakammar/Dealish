import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// --- Token management ---

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry: Date } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    console.error('Token refresh failed:', await resp.text());
    return null;
  }

  const data = await resp.json();
  return {
    access_token: data.access_token,
    expiry: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function getValidAccessToken(
  supabase: any,
  tokenRow: { id: string; access_token: string; refresh_token: string; token_expiry: string }
): Promise<string | null> {
  const expiry = new Date(tokenRow.token_expiry);
  const nowPlus5 = new Date(Date.now() + 5 * 60 * 1000);
  if (expiry > nowPlus5) return tokenRow.access_token;

  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  if (!refreshed) return null;

  await supabase
    .from('google_oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      token_expiry: refreshed.expiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenRow.id);

  return refreshed.access_token;
}

// --- Google Sheets API ---

async function fetchSheetData(
  accessToken: string,
  sheetId: string,
  tab: string
): Promise<{ headers: string[]; rows: unknown[][] } | null> {
  const range = encodeURIComponent(`${tab}!A1:Z500`);
  const resp = await fetch(`${SHEETS_API_BASE}/${sheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    console.error(`Sheets API error ${resp.status}:`, await resp.text());
    return null;
  }

  const data = await resp.json();
  const values: unknown[][] = data.values || [];
  if (values.length < 2) return { headers: [], rows: [] };

  const headers = (values[0] as string[]).map(h => String(h || '').trim());
  const rows = values.slice(1);
  return { headers, rows };
}

// --- Fuzzy Schema Detection ---

const FIELD_SYNONYMS: Record<string, string[]> = {
  // Product fields
  name: ['name', 'item', 'product', 'title', 'item name', 'product name', 'food item', 'dish', 'ingredient', 'description'],
  category: ['category', 'type', 'kind', 'group', 'section', 'food type', 'item type', 'tag', 'tags', 'cuisine'],
  unit: ['unit', 'uom', 'unit of measure', 'measure', 'size', 'pack size', 'packaging'],
  supplier: ['supplier', 'vendor', 'source', 'brand', 'distributor', 'from'],
  // Inventory fields
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

// --- Row normalization ---

function simpleHash(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 32);
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

  // Must have at least a name
  if (!mapped.name) return null;

  const result: Record<string, unknown> = {
    name: String(mapped.name).trim(),
  };

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
    try {
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch { return undefined; }
  };

  if (mapped.expiration_date) result.expiration_date = toISO(mapped.expiration_date);
  if (mapped.location) result.location = String(mapped.location).trim().toLowerCase();

  return result;
}

// --- Main poll logic ---

async function pollIntegration(supabase: any, integration: any) {
  const { id: integrationId, restaurant_id, sheet_id, sheet_tab, detected_mapping } = integration;

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .single();

  if (tokenErr || !tokenRow) {
    console.log(`No OAuth token for restaurant ${restaurant_id}, skipping`);
    return { skipped: true, reason: 'no_token' };
  }

  const accessToken = await getValidAccessToken(supabase, tokenRow);
  if (!accessToken) {
    console.error(`Could not get valid token for restaurant ${restaurant_id}`);
    return { skipped: true, reason: 'token_refresh_failed' };
  }

  const sheetData = await fetchSheetData(accessToken, sheet_id, sheet_tab || 'Sheet1');
  if (!sheetData || !sheetData.headers.length) {
    console.log(`Empty sheet for integration ${integrationId}`);
    return { skipped: true, reason: 'empty_sheet' };
  }

  const { headers, rows } = sheetData;

  let mapping = detected_mapping;
  if (!mapping || Object.keys(mapping).length === 0) {
    console.log(`Detecting schema for integration ${integrationId}`);
    mapping = detectSchema(headers);
    await supabase.from('sheet_integrations').update({ detected_mapping: mapping }).eq('id', integrationId);
  }

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2;
    const rowData = rows[i];

    const rowObj: Record<string, unknown> = {};
    headers.forEach((h, j) => { if (h) rowObj[h] = rowData[j] ?? ''; });

    if (Object.values(rowObj).every(v => v === '' || v === null || v === undefined)) {
      results.skipped++;
      continue;
    }

    const rowHash = simpleHash(rowObj);

    const { data: existingSync } = await supabase
      .from('sheet_synced_rows')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('row_index', rowIndex)
      .single();

    if (existingSync?.row_hash === rowHash) {
      results.skipped++;
      continue;
    }

    const item = normalizeRow(rowObj, mapping);
    if (!item) { results.skipped++; continue; }

    try {
      let productId: string;
      let inventoryItemId: string;

      if (existingSync?.deal_id) {
        // deal_id column reused to store inventory_item_id for backward compat
        inventoryItemId = existingSync.deal_id;

        // Get existing inventory item to find product_id
        const { data: existingItem } = await supabase
          .from('inventory_items')
          .select('product_id')
          .eq('id', inventoryItemId)
          .single();

        if (existingItem) {
          productId = existingItem.product_id;

          // Update product
          await supabase.from('products').update({
            name: item.name,
            category: item.category || null,
            unit: item.unit || 'unit',
            supplier: item.supplier || null,
            updated_at: new Date().toISOString(),
          }).eq('id', productId);

          // Update inventory item
          const inventoryUpdate: any = { updated_at: new Date().toISOString() };
          if (item.quantity !== undefined) inventoryUpdate.quantity = item.quantity;
          if (item.unit_cost !== undefined) inventoryUpdate.unit_cost = item.unit_cost;
          if (item.expiration_date) inventoryUpdate.expiration_date = item.expiration_date;
          if (item.location) inventoryUpdate.location = item.location;
          if (item.notes) inventoryUpdate.notes = item.notes;

          await supabase.from('inventory_items').update(inventoryUpdate).eq('id', inventoryItemId);
          results.updated++;
        }
      } else {
        // Create product first
        const { data: newProduct, error: productErr } = await supabase
          .from('products')
          .insert({
            restaurant_id,
            name: item.name,
            category: item.category || 'other',
            unit: item.unit || 'unit',
            supplier: item.supplier || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (productErr) throw productErr;
        productId = newProduct.id;

        // Create inventory item linked to product
        const inventoryPayload: any = {
          restaurant_id,
          product_id: productId,
          quantity: item.quantity ?? 1,
          unit: item.unit || 'unit',
          status: 'active',
          received_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (item.unit_cost !== undefined) inventoryPayload.unit_cost = item.unit_cost;
        if (item.expiration_date) inventoryPayload.expiration_date = item.expiration_date;
        if (item.location) inventoryPayload.location = item.location;
        if (item.notes) inventoryPayload.notes = item.notes;

        const { data: newItem, error: itemErr } = await supabase
          .from('inventory_items')
          .insert(inventoryPayload)
          .select()
          .single();

        if (itemErr) throw itemErr;
        inventoryItemId = newItem.id;
        results.created++;
      }

      // Track synced row (reusing deal_id column for inventory_item_id)
      await supabase.from('sheet_synced_rows').upsert({
        integration_id: integrationId,
        row_index: rowIndex,
        deal_id: inventoryItemId,
        row_hash: rowHash,
        last_synced_at: new Date().toISOString(),
        sync_direction: 'sheet_to_dealish',
      }, { onConflict: 'integration_id,row_index' });

    } catch (err: any) {
      console.error(`Row ${rowIndex} error:`, err.message);
      results.errors++;
    }
  }

  await supabase.from('sheet_integrations').update({ last_synced_at: new Date().toISOString() }).eq('id', integrationId);
  return results;
}

// --- Entry point ---

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    let query = supabase.from('sheet_integrations').select('*').eq('sync_method', 'oauth_cron');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.restaurant_id) query = query.eq('restaurant_id', body.restaurant_id);
      } catch (_) {}
    }

    const { data: integrations, error } = await query;
    if (error) throw error;
    if (!integrations?.length) {
      return new Response(JSON.stringify({ message: 'No OAuth integrations to poll' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const summary: Record<string, unknown>[] = [];
    for (const integration of integrations) {
      const result = await pollIntegration(supabase, integration);
      summary.push({ integration_id: integration.id, restaurant_id: integration.restaurant_id, ...result });
    }

    return new Response(JSON.stringify({ polled: summary.length, summary }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    console.error('sheets-poll error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
