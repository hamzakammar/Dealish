/**
 * Seed fake QR code scans for analytics testing.
 *
 * Usage:
 *   SUPABASE_URL=https://hpsoqjpzebkkxdqapegl.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service_role_key> \
 *   RESTAURANT_ID=<your_restaurant_uuid> \
 *   node scripts/seed_analytics.js
 *
 * Optional:
 *   SCAN_COUNT=50       (default: 30)
 *   DAYS_BACK=14        (default: 7)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpsoqjpzebkkxdqapegl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESTAURANT_ID = process.env.RESTAURANT_ID;
const SCAN_COUNT = parseInt(process.env.SCAN_COUNT || '30', 10);
const DAYS_BACK = parseInt(process.env.DAYS_BACK || '7', 10);

if (!SUPABASE_KEY) {
  console.error('❌  Set SUPABASE_SERVICE_KEY env var (service role key from Supabase dashboard)');
  process.exit(1);
}
if (!RESTAURANT_ID) {
  console.error('❌  Set RESTAURANT_ID env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function randomDate(daysBack) {
  const now = Date.now();
  const earliest = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(earliest + Math.random() * (now - earliest)).toISOString();
}

async function main() {
  // Get deals for the restaurant
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, title')
    .eq('restaurant_id', RESTAURANT_ID);

  if (dealsError) {
    console.error('❌  Error fetching deals:', dealsError.message);
    process.exit(1);
  }

  if (!deals || deals.length === 0) {
    console.error('❌  No deals found for restaurant', RESTAURANT_ID);
    console.log('    Create at least one deal first.');
    process.exit(1);
  }

  console.log(`✅  Found ${deals.length} deal(s):`);
  deals.forEach(d => console.log(`    - ${d.title} (${d.id})`));
  console.log(`\n⏳  Inserting ${SCAN_COUNT} fake scans over the last ${DAYS_BACK} days...\n`);

  // Get a real user ID to use (or use null for anonymous scans)
  const { data: profiles } = await supabase.from('profiles').select('id').limit(5);
  const userIds = (profiles || []).map(p => p.id);

  const scans = Array.from({ length: SCAN_COUNT }, (_, i) => {
    const deal = deals[Math.floor(Math.random() * deals.length)];
    const userId = userIds.length > 0
      ? userIds[Math.floor(Math.random() * userIds.length)]
      : null;
    const scannedAt = randomDate(DAYS_BACK);
    return {
      deal_id: deal.id,
      restaurant_id: RESTAURANT_ID,
      user_id: userId,
      scanned_at: scannedAt,
      created_at: scannedAt,
    };
  });

  // Insert in batches of 10
  let inserted = 0;
  for (let i = 0; i < scans.length; i += 10) {
    const batch = scans.slice(i, i + 10);
    const { error } = await supabase.from('qr_code_scans').insert(batch);
    if (error) {
      console.error(`❌  Error inserting batch ${i}-${i+10}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r    Inserted ${inserted}/${SCAN_COUNT}...`);
    }
  }

  console.log(`\n\n✅  Done! Inserted ${inserted} fake scans.`);
  console.log('    Open the analytics screen in the app to see the data.');
}

main().catch(err => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
