#!/usr/bin/env node
/**
 * Refresh hero_image_url + display_image on restaurants by downloading
 * caller-supplied photo URLs and re-hosting them in Supabase Storage
 * (`restaurant-images` bucket). Storage URLs do not expire.
 *
 * Two modes:
 *   1. --list          dump current restaurants as JSON to stdout. Use this
 *                      to seed scripts/photo-overrides.json.
 *   2. --apply         read scripts/photo-overrides.json (or path from
 *                      --from=<path>), download each URL, upload to Storage,
 *                      update the row.
 *
 * Default is dry-run apply: prints the plan without writing.
 *
 * Env:
 *   SUPABASE_URL          required for both modes
 *   SUPABASE_SERVICE_KEY  required for --apply (DB write); --list works with
 *                         anon key since restaurants table is publicly readable
 *
 * overrides.json format:
 *   [
 *     { "id": "<uuid>", "url": "https://..." },
 *     { "id": "<uuid>", "url": "https://..." }
 *   ]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const LIST = process.argv.includes('--list');
const APPLY = process.argv.includes('--apply');
const fromArg = process.argv.find((a) => a.startsWith('--from='));
const FROM = fromArg ? fromArg.split('=')[1] : path.join(__dirname, 'photo-overrides.json');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY for --list) required');
  process.exit(1);
}

const BUCKET = 'restaurant-images';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}

async function listRestaurants() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, lat, lng, hero_image_url')
    .order('name');
  if (error) throw new Error(`Failed to load restaurants: ${error.message}`);
  // Print as JSON to stdout so the user can pipe to a file.
  console.log(JSON.stringify(data, null, 2));
  log(`Listed ${data.length} restaurants`);
}

async function downloadBytes(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Dealish/1.0)' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) {
    throw new Error(`Not an image (${ct}): ${url}`);
  }
  const ab = await res.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType: ct.split(';')[0].trim() };
}

async function uploadToStorage(restaurantId, bytes, contentType) {
  const ext = contentType.split('/')[1] || 'jpg';
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  const objectPath = `refresh/${restaurantId}-${Date.now()}.${safeExt}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

async function applyOverrides() {
  if (!fs.existsSync(FROM)) {
    console.error(`❌ overrides file not found: ${FROM}`);
    process.exit(1);
  }
  const overrides = JSON.parse(fs.readFileSync(FROM, 'utf8'));
  if (!Array.isArray(overrides)) {
    console.error(`❌ overrides file must be a JSON array of {id, url}`);
    process.exit(1);
  }

  log(APPLY ? 'APPLY MODE — writing to Storage + DB' : 'DRY-RUN MODE — pass --apply to write');
  log(`Reading ${overrides.length} entries from ${FROM}`);

  const { data: existing, error } = await supabase
    .from('restaurants')
    .select('id, name')
    .in('id', overrides.map((o) => o.id));
  if (error) throw new Error(`Failed to verify restaurants: ${error.message}`);
  const byId = new Map(existing.map((r) => [r.id, r]));

  let succeeded = 0;
  let failed = 0;
  const failures = [];

  for (const entry of overrides) {
    const r = byId.get(entry.id);
    if (!r) {
      failed++;
      failures.push({ id: entry.id, reason: 'restaurant id not found in DB' });
      log(`✗ ${entry.id} — not found in DB`);
      continue;
    }
    if (!entry.url || !/^https?:\/\//.test(entry.url)) {
      failed++;
      failures.push({ name: r.name, id: r.id, reason: 'missing or invalid url' });
      log(`✗ ${r.name} — invalid url`);
      continue;
    }

    if (!APPLY) {
      log(`→ ${r.name} would download ${entry.url}`);
      succeeded++;
      continue;
    }

    try {
      const { bytes, contentType } = await downloadBytes(entry.url);
      const newUrl = await uploadToStorage(r.id, bytes, contentType);
      const { error: upErr } = await supabase
        .from('restaurants')
        .update({ hero_image_url: newUrl, display_image: newUrl })
        .eq('id', r.id);
      if (upErr) throw new Error(`DB update failed: ${upErr.message}`);
      log(`✓ ${r.name} → ${newUrl}`);
      succeeded++;
    } catch (err) {
      failed++;
      failures.push({ name: r.name, id: r.id, reason: err.message });
      log(`✗ ${r.name} — ${err.message}`);
    }

    await new Promise((res) => setTimeout(res, 100));
  }

  log('---');
  log(`Done. ${succeeded} ${APPLY ? 'succeeded' : 'would-be-applied'}, ${failed} failed.`);
  if (failures.length) {
    log('Failures:');
    for (const f of failures) log(`  ${f.name || f.id}: ${f.reason}`);
  }
}

async function main() {
  if (LIST) {
    await listRestaurants();
    return;
  }
  await applyOverrides();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
