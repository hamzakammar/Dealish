import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This function is called by a Supabase Database Webhook on deals INSERT/UPDATE/DELETE
// Payload: { type: 'INSERT'|'UPDATE'|'DELETE', table: 'deals', record: {...}, old_record: {...} }

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const WEBHOOK_TIMEOUT_MS = 10_000;

async function postWithRetry(url: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  let lastStatus = 0;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) return { ok: true, status: resp.status };
      lastStatus = resp.status;
      lastError = `HTTP ${resp.status}`;
      // Don't retry 4xx client errors (misconfigured webhook URL, auth, etc.)
      if (resp.status >= 400 && resp.status < 500) break;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { type, record, old_record } = await req.json();
    const deal = record || old_record;
    if (!deal?.restaurant_id) return new Response('ok', { status: 200 });

    // Skip deals that came from sheets (avoid sync loops)
    if (deal.source === 'sheets') return new Response('ok', { status: 200 });

    // Find integration for this restaurant
    const { data: integration } = await supabase
      .from('sheet_integrations')
      .select('id, webhook_url')
      .eq('restaurant_id', deal.restaurant_id)
      .not('webhook_url', 'is', null)
      .single();

    if (!integration?.webhook_url) return new Response('ok', { status: 200 });

    // Find the synced row for this deal (if any)
    const { data: syncedRow } = await supabase
      .from('sheet_synced_rows')
      .select('row_index')
      .eq('integration_id', integration.id)
      .eq('deal_id', deal.id)
      .single();

    // Build payload to send to Apps Script
    const payload = {
      event: type.toLowerCase(), // 'insert' | 'update' | 'delete'
      deal: {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        deal_price: deal.deal_price,
        original_price: deal.original_price,
        discount_percent: deal.discount_percent,
        is_active: deal.is_active,
        valid_from: deal.valid_from,
        valid_until: deal.valid_until,
        category: deal.category,
      },
      row_index: syncedRow?.row_index || null, // null = new row, Apps Script appends
    };

    const result = await postWithRetry(integration.webhook_url, payload);

    if (!result.ok) {
      console.error(`sheets-outbound webhook failed after ${MAX_ATTEMPTS} attempts:`, result.error);
      await supabase.from('sheet_sync_errors').insert({
        integration_id: integration.id,
        deal_id: deal.id,
        event_type: type.toLowerCase(),
        error_message: result.error || 'unknown',
        http_status: result.status || null,
      }).then((res: { error?: { message: string } | null }) => {
        // sheet_sync_errors table may not exist yet — don't fail the handler if so
        if (res?.error) console.error('failed to log sync error:', res.error.message);
      });
    }

    return new Response('ok', { status: 200 });
  } catch (err: any) {
    console.error('sheets-outbound error:', err);
    return new Response(err.message, { status: 500 });
  }
});
