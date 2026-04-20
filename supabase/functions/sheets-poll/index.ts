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

// --- Fuzzy Schema Detection (no LLM) ---

const FIELD_SYNONYMS: Record<string, string[]> = {
  title: ['title', 'name', 'item', 'product', 'deal', 'dish', 'menu item', 'item name', 'deal name', 'offer', 'food item'],
  description: ['description', 'details', 'notes', 'info', 'about', 'promo', 'text', 'body', 'summary', 'note'],
  original_price: ['original price', 'regular price', 'full price', 'normal price', 'retail price', 'original', 'reg price', 'base price', 'msrp'],
  deal_price: ['deal price', 'sale price', 'discounted price', 'offer price', 'promo price', 'discount price', 'new price', 'special price', 'deal', 'sale', 'cost', 'price'],
  discount_percent: ['discount', 'discount %', 'discount percent', '% off', 'percent off', 'savings %', 'off %', 'reduction'],
  is_active: ['active', 'available', 'enabled', 'live', 'on', 'status', 'visible', 'show', 'published', 'active?', 'available?'],
  valid_from: ['valid from', 'start date', 'start', 'from', 'begins', 'start time', 'valid start', 'effective date'],
  valid_until: ['valid until', 'expiry', 'expires', 'end date', 'end', 'until', 'valid to', 'expiration', 'expiry date', 'ends', 'deadline'],
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
      if (synonyms.includes(normalized)) { matched = original; break; }
    }

    // Partial match fallback
    if (!matched) {
      for (const { original, normalized } of normalizedHeaders) {
        if (synonyms.some(s => normalized.includes(s) || s.includes(normalized))) {
          matched = original; break;
        }
      }
    }

    mapping[field] = matched;
  }

  // If deal_price not found but original_price is, use it as deal_price
  if (!mapping.deal_price && mapping.original_price) {
    mapping.deal_price = mapping.original_price;
    mapping.original_price = null;
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
  deal.is_active = ['true', 'yes', 'y', '1', 'active', 'on', 'x', '✓', '✅', 'TRUE'].includes(activeRaw);

  const toISO = (v: unknown) => {
    try { const d = new Date(String(v)); return isNaN(d.getTime()) ? undefined : d.toISOString(); }
    catch { return undefined; }
  };
  if (mapped.valid_from) deal.valid_from = toISO(mapped.valid_from);
  if (mapped.valid_until) deal.valid_until = toISO(mapped.valid_until);

  return deal;
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

  // Detect/re-detect schema if not confirmed
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

    const deal = normalizeRow(rowObj, mapping);
    if (!deal) { results.skipped++; continue; }

    const dealPayload: any = {
      restaurant_id,
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

    try {
      let dealId: string;

      if (existingSync?.deal_id) {
        const { error } = await supabase.from('deals').update(dealPayload).eq('id', existingSync.deal_id);
        if (error) throw error;
        dealId = existingSync.deal_id;
        results.updated++;
      } else {
        const { data: newDeal, error } = await supabase.from('deals').insert(dealPayload).select().single();
        if (error) throw error;
        dealId = newDeal.id;
        results.created++;
      }

      await supabase.from('sheet_synced_rows').upsert({
        integration_id: integrationId,
        row_index: rowIndex,
        deal_id: dealId,
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
