#!/usr/bin/env node
/**
 * Refresh hero_image_url + display_image on every restaurant by pulling
 * a fresh photo from Google Places (new API) and re-hosting it in the
 * Supabase Storage bucket `restaurant-images`. Storage URLs do not expire.
 *
 * Usage:
 *   SUPABASE_URL=https://<proj>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service_role_key> \
 *   GOOGLE_MAPS_API_KEY=<key with Places API enabled> \
 *   node scripts/refresh-restaurant-photos-places.js [--apply] [--limit=N] [--only-empty] [--id=<uuid>]
 *
 *   --apply        actually write to Storage + DB. Default is dry-run.
 *   --limit=N      only process the first N restaurants (handy for smoke test).
 *   --only-empty   only refresh rows with NULL/empty hero_image_url.
 *   --id=<uuid>    only refresh one restaurant (handy for redoing a bad match).
 *
 * Cost: Places Text Search ≈ $0.017/req, Place Photo ≈ $0.007/req.
 *       170 restaurants ≈ $4. First $200/month is free.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const APPLY = process.argv.includes('--apply');
const ONLY_EMPTY = process.argv.includes('--only-empty');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const idArg = process.argv.find((a) => a.startsWith('--id='));
const ONLY_ID = idArg ? idArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required');
  process.exit(1);
}
if (!GOOGLE_KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY env var required (Places API must be enabled)');
  process.exit(1);
}

const BUCKET = 'restaurant-images';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function findPlace(restaurant) {
  const cleanedAddress = (restaurant.address || '').replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
  const query = cleanedAddress
    ? `${restaurant.name}, ${cleanedAddress}`
    : `${restaurant.name}`;

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    },
    body: JSON.stringify({
      textQuery: query,
      ...(restaurant.lat && restaurant.lng
        ? {
            locationBias: {
              circle: {
                center: { latitude: restaurant.lat, longitude: restaurant.lng },
                radius: 500.0,
              },
            },
          }
        : {}),
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places searchText failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.places && data.places[0] ? data.places[0] : null;
}

async function fetchPhotoBytes(photoName) {
  // photoName looks like "places/ChIJ.../photos/AVz..."
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&key=${GOOGLE_KEY}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Place photo fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const ab = await res.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType: ct.split(';')[0].trim() };
}

async function uploadToStorage(restaurantId, bytes, contentType) {
  const ext = (contentType.split('/')[1] || 'jpg').toLowerCase();
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  const objectPath = `places/${restaurantId}-${Date.now()}.${safeExt}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

async function refreshOne(restaurant) {
  const place = await findPlace(restaurant);
  if (!place) {
    log(`✗ ${restaurant.name} — no Places match`);
    return { ok: false, reason: 'no_place_match' };
  }
  if (!place.photos || place.photos.length === 0) {
    log(`✗ ${restaurant.name} — Places match has no photos (${place.id})`);
    return { ok: false, reason: 'no_photos' };
  }

  const matchedName = place.displayName?.text || place.formattedAddress || place.id;
  log(`→ ${restaurant.name} matched: ${matchedName}`);

  if (!APPLY) {
    return { ok: true, dryRun: true, photoCount: place.photos.length };
  }

  const { bytes, contentType } = await fetchPhotoBytes(place.photos[0].name);
  const url = await uploadToStorage(restaurant.id, bytes, contentType);

  const { error } = await supabase
    .from('restaurants')
    .update({ hero_image_url: url, display_image: url })
    .eq('id', restaurant.id);
  if (error) throw new Error(`DB update failed: ${error.message}`);

  log(`✓ ${restaurant.name} → ${url}`);
  return { ok: true, url };
}

async function main() {
  log(APPLY ? 'APPLY MODE — writing to Storage + DB' : 'DRY-RUN MODE — pass --apply to write');
  if (ONLY_EMPTY) log('Filter: only restaurants with NULL/empty hero_image_url');
  if (ONLY_ID) log(`Filter: only id=${ONLY_ID}`);
  if (LIMIT) log(`Limit: ${LIMIT}`);

  let q = supabase.from('restaurants').select('id, name, address, lat, lng, hero_image_url').order('name');
  if (ONLY_ID) q = q.eq('id', ONLY_ID);
  if (ONLY_EMPTY) q = q.or('hero_image_url.is.null,hero_image_url.eq.');
  if (LIMIT) q = q.limit(LIMIT);

  const { data: restaurants, error } = await q;
  if (error) throw new Error(`Failed to load restaurants: ${error.message}`);

  log(`Found ${restaurants.length} restaurants to process`);

  let succeeded = 0;
  let failed = 0;
  const failures = [];

  for (const r of restaurants) {
    try {
      const result = await refreshOne(r);
      if (result.ok) succeeded++;
      else {
        failed++;
        failures.push({ name: r.name, id: r.id, reason: result.reason });
      }
    } catch (err) {
      failed++;
      failures.push({ name: r.name, id: r.id, reason: err.message });
      log(`✗ ${r.name} — ${err.message}`);
    }
    // gentle throttle to avoid Places QPS limits
    await new Promise((res) => setTimeout(res, 200));
  }

  log('---');
  log(`Done. ${succeeded} succeeded, ${failed} failed.`);
  if (failures.length) {
    log('Failures:');
    for (const f of failures) log(`  ${f.name || f.id}: ${f.reason}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
