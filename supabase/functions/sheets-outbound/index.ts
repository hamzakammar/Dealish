import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This function is called by a Supabase Database Webhook on deals INSERT/UPDATE/DELETE
// Payload: { type: 'INSERT'|'UPDATE'|'DELETE', table: 'deals', record: {...}, old_record: {...} }

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

    // Fire outbound webhook to Google Apps Script
    const webhookResp = await fetch(integration.webhook_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!webhookResp.ok) {
      console.error(`Outbound webhook failed: ${webhookResp.status}`);
    }

    return new Response('ok', { status: 200 });
  } catch (err: any) {
    console.error('sheets-outbound error:', err);
    return new Response(err.message, { status: 500 });
  }
});
