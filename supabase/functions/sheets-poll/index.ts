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
  const nowPlus5 = new Date(Date.now() + 5 * 60 * 1000); // refresh if <5 min left

  if (expiry > nowPlus5) return tokenRow.access_token;

  // Refresh
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  if (!refreshed) return null;

  // Update in DB
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

// --- LLM schema detection ---

async function detectSchema(headers: string[], sampleRows: unknown[][]): Promise<Record<string, string | null>> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return {};

  const prompt = `You are analyzing a restaurant inventory/menu Google Sheet to map columns to deal fields.

Headers: ${JSON.stringify(headers)}
Sample rows (first 5):
${sampleRows.slice(0, 5).map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n')}

Map the headers to these Dealish deal fields (use null if no suitable column exists):
- title: deal or item name
- description: details, notes, promo text
- original_price: regular/full price (number)
- deal_price: sale/discounted price (number)
- discount_percent: percentage off (number)
- is_active: whether deal is active (boolean/checkbox/Y-N/Yes-No)
- valid_from: start date
- valid_until: end date or expiry
- category: food category or type

Return ONLY a JSON object using exact header names as values, or null:
{"title":"...", "description":null, ...}`;

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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]); } catch { return {}; }
}

// --- Row normalization ---

function simpleHash(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).slice(0, 32);
}

async function normalizeRow(
  rowObj: Record<string, unknown>,
  mapping: Record<string, string | null>
): Promise<Record<string, unknown> | null> {
  // Apply direct mapping first
  const mapped: Record<string, unknown> = {};
  for (const [field, col] of Object.entries(mapping)) {
    if (col && rowObj[col] !== undefined && rowObj[col] !== '') {
      mapped[field] = rowObj[col];
    }
  }

  if (!mapped.title) {
    // Try LLM for tricky rows
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) return null;

    const prompt = `Convert this restaurant inventory row to a deal. Row: ${JSON.stringify(rowObj)}
Return ONLY JSON: {"title":"...","description":"...","deal_price":0,"original_price":0,"discount_percent":0,"is_active":true,"valid_until":null,"category":"..."}
Omit fields you can't determine.`;

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
      if (match) Object.assign(mapped, JSON.parse(match[0]));
    } catch (_) {}
  }

  if (!mapped.title) return null;

  // Normalize types
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

  // is_active
  const activeRaw = String(mapped.is_active ?? 'true').toLowerCase().trim();
  deal.is_active = ['true', 'yes', 'y', '1', 'active', 'on', 'x', '✓', '✅', 'TRUE'].includes(activeRaw);

  // Dates
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

  // Get token for this restaurant
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

  // Fetch sheet data
  const sheetData = await fetchSheetData(accessToken, sheet_id, sheet_tab || 'Sheet1');
  if (!sheetData || !sheetData.headers.length) {
    console.log(`Empty sheet for integration ${integrationId}`);
    return { skipped: true, reason: 'empty_sheet' };
  }

  const { headers, rows } = sheetData;

  // Detect schema if not yet done
  let mapping = detected_mapping;
  if (!mapping || Object.keys(mapping).length === 0) {
    console.log(`Detecting schema for integration ${integrationId}`);
    mapping = await detectSchema(headers, rows);
    await supabase
      .from('sheet_integrations')
      .update({ detected_mapping: mapping })
      .eq('id', integrationId);
  }

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // 1-based, +1 for header row
    const rowData = rows[i];

    // Build named object
    const rowObj: Record<string, unknown> = {};
    headers.forEach((h, j) => { if (h) rowObj[h] = rowData[j] ?? ''; });

    // Skip completely empty rows
    if (Object.values(rowObj).every(v => v === '' || v === null || v === undefined)) {
      results.skipped++;
      continue;
    }

    const rowHash = simpleHash(rowObj);

    // Check if unchanged
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

    // Normalize
    const deal = await normalizeRow(rowObj, mapping);
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

  // Update last_synced_at
  await supabase
    .from('sheet_integrations')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', integrationId);

  return results;
}

// --- Entry point ---

serve(async (req) => {
  // Allow manual trigger via POST, or cron call
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Optionally poll a single integration (for testing)
    let query = supabase
      .from('sheet_integrations')
      .select('*')
      .eq('sync_method', 'oauth_cron');

    // If specific restaurant_id passed, filter to that one
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
