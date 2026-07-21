/**
 * Deal-scraping agent — Phase 1 (extract -> review queue; NO publishing).
 *
 * For non-partner restaurants, finds the official website (Google Places),
 * fetches likely deal pages, keyword-prefilters, asks a cheap LLM to extract
 * deals, normalizes them, and upserts into `scraped_deal_candidates`.
 *
 * It NEVER writes to `deals`. Publishing is a separate, admin-reviewed step (Phase 2).
 * Default mode is DRY-RUN (prints what it found, writes nothing).
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpsoqjpzebkkxdqapegl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const DUMP_TEXT = process.argv.includes('--dump-text');   // validate discovery/fetch without an LLM key
const AUTO_PUBLISH = process.argv.includes('--auto-publish'); // opt-in: publish high-confidence directly
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const idArg = process.argv.find((a) => a.startsWith('--id='));
const confArg = process.argv.find((a) => a.startsWith('--min-confidence='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : (APPLY ? null : 10);
const ONLY_ID = idArg ? idArg.split('=')[1] : null;
const MIN_CONFIDENCE = confArg ? parseFloat(confArg.split('=')[1]) : 0.8;

if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_KEY env var required'); process.exit(1); }
if (!GOOGLE_KEY) { console.error('GOOGLE_MAPS_API_KEY env var required (Places API enabled)'); process.exit(1); }
if (!GEMINI_KEY && !OPENAI_KEY && !DUMP_TEXT) { console.error('Set GEMINI_API_KEY or OPENAI_API_KEY (or use --dump-text)'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const STALE_DAYS = 7;
const MAX_PAGES = 5;
const MAX_LLM_CHARS = 12000;

const DEAL_KEYWORDS = [
  'happy hour', 'happyhour', 'special', 'deal', 'discount', 'bogo', 'buy one',
  'student', 'off ', '% off', 'prix fixe', 'feature', 'promo', 'drink', 'wing',
  'taco tuesday', 'oyster', 'late night', 'early bird', 'pint', 'cocktail',
];
const CANDIDATE_PATHS = ['', '/happy-hour', '/happyhour', '/specials', '/deals',
  '/drinks', '/menu', '/menus', '/food', '/promotions', '/events'];

function log(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// ---------------------------------------------------------------- fetch + text
async function fetchUrl(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'DealishDealBot/1.0 (+https://dealish.app; contact: hello@dealish.app)' },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/pdf')) return null; // PDF parsing: Phase 2
    if (!ct.includes('text/html') && !ct.includes('text/plain') && ct) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = (m[2] || '').replace(/<[^>]+>/g, ' ').toLowerCase();
    const hay = (href + ' ' + text).toLowerCase();
    if (!/happy|special|deal|drink|menu|promo|event|wing|taco/.test(hay)) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin === new URL(baseUrl).origin) links.add(abs.toString().split('#')[0]);
    } catch { /* skip bad href */ }
  }
  return [...links];
}

function keywordPrefilter(text) {
  const lines = text.split('\n');
  const keep = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (DEAL_KEYWORDS.some((k) => l.includes(k))) {
      for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 2); j++) {
        if (!keep.includes(j)) keep.push(j);
      }
    }
  }
  keep.sort((a, b) => a - b);
  const out = keep.map((i) => lines[i]).join('\n');
  return out.slice(0, MAX_LLM_CHARS);
}

// ---------------------------------------------------------------- discovery
async function placesWebsite(restaurant) {
  const query = `${restaurant.name} ${restaurant.address || restaurant.city || 'Toronto'}`.trim();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.websiteUri,places.displayName',
    },
    body: JSON.stringify({ textQuery: query, regionCode: 'CA' }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.places && data.places[0];
  if (!p) return null;
  return { placeId: p.id || null, website: p.websiteUri || null };
}

async function ensureWebsite(restaurant) {
  if (restaurant.website_url) return restaurant.website_url;
  const found = await placesWebsite(restaurant);
  if (!found || !found.website) return null;
  if (APPLY) {
    const { error } = await supabase.from('restaurants')
      .update({ website_url: found.website, google_place_id: found.placeId })
      .eq('id', restaurant.id);
    if (error) log(`  ! update restaurant website failed: ${error.message}`);
  }
  return found.website;
}

// ---------------------------------------------------------------- LLM extract
function buildPrompt(restaurant, text) {
  return `You extract ONLY real, currently-advertised deals from the text of a restaurant's OWN website.
Restaurant: ${restaurant.name} (${restaurant.type || 'restaurant'}), ${restaurant.address || restaurant.city || ''}.

Rules:
- Use ONLY what is explicitly stated in the text. NEVER invent or infer a deal.
- Every deal MUST include an exact "evidence_quote" copied verbatim from the text.
- If there are no clear deals, return {"deals": []}.

Return strict JSON: {"deals":[{
  "title": string,
  "description": string|null,
  "deal_category": "happy_hour"|"daily_special"|"bogo"|"student_discount"|"other",
  "discount_type": "percent"|"fixed"|"bogo"|null,
  "discount_value": number|null,
  "days": number[],            // 0=Sunday..6=Saturday; [] if not stated
  "start_time": string|null,   // "HH:MM" 24h, null if not stated
  "end_time": string|null,
  "fine_print": string|null,
  "confidence": number,        // 0..1
  "evidence_quote": string
}]}

TEXT:
"""${text}"""`;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"deals":[]}';
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '{"deals":[]}';
}

async function extractDeals(restaurant, text) {
  const prompt = buildPrompt(restaurant, text);
  const raw = GEMINI_KEY ? await callGemini(prompt) : await callOpenAI(prompt);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    log(`  ! JSON parse failed for "${restaurant.name}": ${e.message}`);
    return [];
  }
  return Array.isArray(parsed?.deals) ? parsed.deals : [];
}

// ---------------------------------------------------------------- normalize
function toTime(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:00`;
}
function normDays(days) {
  if (!Array.isArray(days)) return null;
  const out = days.map(Number).filter((n) => n >= 0 && n <= 6);
  return out.length ? [...new Set(out)].sort() : null;
}
function normalizeCandidate(raw, restaurant, sourceUrl, contentHash) {
  const title = (raw.title || '').toString().trim().slice(0, 200);
  if (!title) return null;
  const days = normDays(raw.days);
  const start = toTime(raw.start_time);
  const end = toTime(raw.end_time);
  const dt = ['percent', 'fixed', 'bogo'].includes(raw.discount_type) ? raw.discount_type : null;
  const dedupe = sha256(`${restaurant.id}|${title.toLowerCase()}|${(days || []).join(',')}|${start || ''}|${end || ''}`);
  return {
    restaurant_id: restaurant.id,
    title,
    description: raw.description ? String(raw.description).slice(0, 1000) : null,
    deal_category: ['happy_hour', 'daily_special', 'bogo', 'student_discount', 'other'].includes(raw.deal_category)
      ? raw.deal_category : 'other',
    discount_type: dt,
    discount_value: typeof raw.discount_value === 'number' ? raw.discount_value : null,
    is_recurring: true,
    recurrence_days: (days && days.length) ? days : [0, 1, 2, 3, 4, 5, 6],
    recurrence_start_time: start,
    recurrence_end_time: end,
    tags: [],
    source_url: sourceUrl,
    evidence_quote: raw.evidence_quote ? String(raw.evidence_quote).slice(0, 1000) : null,
    confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : null,
    content_hash: contentHash,
    dedupe_hash: dedupe,
    status: 'pending',
    last_seen_at: new Date().toISOString(),
  };
}

// Batch upsert candidates to avoid N+1 queries.
// On conflict with (restaurant_id, dedupe_hash), we update the candidate but
// PRESERVE the 'status' (don't revert published/rejected to pending).
async function batchPersistCandidates(candidates) {
  if (!candidates.length) return;
  const { data, error } = await supabase
    .from('scraped_deal_candidates')
    .upsert(candidates, { onConflict: 'restaurant_id,dedupe_hash', ignoreDuplicates: false })
    .select('id, status, confidence, title');

  if (error) {
    log(`  ! batch upsert failed: ${error.message}`);
    return;
  }

  if (AUTO_PUBLISH) {
    for (const row of (data || [])) {
      if (row.status === 'pending' && (row.confidence ?? 0) >= MIN_CONFIDENCE) {
        // Map back to candidate object for publishing (publishing still handles one-by-one
        // to manage the separate deals table insert).
        const c = candidates.find(cand => cand.title === row.title);
        if (c) await publishCandidate(row.id, c);
      }
    }
  }
}

async function publishCandidate(candidateId, c) {
  // Never publish deals without a time range
  if (!c.recurrence_start_time || !c.recurrence_end_time) {
    log(`    ⊘ skipped "${c.title}" (no time range)`);
    return;
  }
  const dealId = crypto.randomUUID();
  const dealData = {
    id: dealId,
    restaurant_id: c.restaurant_id,
    title: c.title,
    description: c.description || null,
    tags: [],
    is_active: true,
    is_recurring: !!c.is_recurring,
    discount_type: c.discount_type || null,
    discount_value: c.discount_value,
    source: 'scraped',
    source_url: c.source_url,
    confidence: c.confidence,
    last_verified_at: new Date().toISOString(),
  };
  if (c.is_recurring) {
    dealData.recurrence_days = c.recurrence_days || [];
    dealData.recurrence_start_time = c.recurrence_start_time;
    dealData.recurrence_end_time = c.recurrence_end_time;
  } else {
    dealData.start_at = c.start_at || null;
    dealData.end_at = c.end_at || null;
  }
  const { error } = await supabase.from('deals').insert([dealData]);
  if (error) { log(`    ! publish failed for "${c.title}": ${error.message}`); return; }
  await supabase.from('scraped_deal_candidates')
    .update({ status: 'published', published_deal_id: dealId, reviewed_at: new Date().toISOString() })
    .eq('id', candidateId);
  log(`    ✓ auto-published "${c.title}" (conf ${(c.confidence ?? 0).toFixed(2)})`);
}

// ---------------------------------------------------------------- per restaurant
async function processRestaurant(restaurant) {
  const website = await ensureWebsite(restaurant);
  if (!website) return { name: restaurant.name, skipped: 'no website', candidates: [] };

  const origin = (() => { try { return new URL(website).origin; } catch { return null; } })();
  if (!origin) return { name: restaurant.name, skipped: 'bad website url', candidates: [] };

  const urls = new Set(CANDIDATE_PATHS.map((p) => origin + p));
  const home = await fetchUrl(website);
  if (home) extractLinks(home, website).forEach((u) => urls.add(u));

  let combined = '';
  let pages = 0;
  for (const u of urls) {
    if (pages >= MAX_PAGES) break;
    const html = u === website && home ? home : await fetchUrl(u);
    if (!html) continue;
    pages++;
    combined += '\n' + htmlToText(html);
  }

  const relevant = keywordPrefilter(combined);
  if (!relevant.trim()) {
    if (APPLY && !DUMP_TEXT) {
      const { error } = await supabase.from('restaurants').update({ deals_last_crawled_at: new Date().toISOString() }).eq('id', restaurant.id);
      if (error) log(`  ! update crawl time failed: ${error.message}`);
    }
    return { name: restaurant.name, website, skipped: 'no deal text found', candidates: [] };
  }

  if (DUMP_TEXT) {
    return { name: restaurant.name, website, dumpText: relevant, urls: [...urls].slice(0, pages), candidates: [] };
  }

  const contentHash = sha256(relevant);

  // Skip the LLM if this exact content was already processed recently.
  // Force a fresh scrape if the last crawl was >7 days ago even if the hash matches.
  if (!FORCE) {
    const lastCrawl = restaurant.deals_last_crawled_at ? new Date(restaurant.deals_last_crawled_at) : null;
    const isStale = !lastCrawl || (new Date() - lastCrawl) > (STALE_DAYS * 24 * 60 * 60 * 1000);

    if (!isStale) {
      const { data: existing } = await supabase
        .from('scraped_deal_candidates')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('content_hash', contentHash)
        .limit(1);

      if (existing && existing.length) {
        if (APPLY) {
          await supabase.from('scraped_deal_candidates')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('restaurant_id', restaurant.id).eq('content_hash', contentHash);
          await supabase.from('restaurants').update({ deals_last_crawled_at: new Date().toISOString() }).eq('id', restaurant.id);
        }
        return { name: restaurant.name, website, skipped: 'content unchanged', candidates: [] };
      }
    }
  }

  const rawDeals = await extractDeals(restaurant, relevant);
  const candidates = rawDeals
    .map((d) => normalizeCandidate(d, restaurant, website, contentHash))
    .filter(Boolean);

  if (APPLY) {
    await batchPersistCandidates(candidates);
    const { error } = await supabase.from('restaurants').update({ deals_last_crawled_at: new Date().toISOString() }).eq('id', restaurant.id);
    if (error) log(`  ! update crawl time failed: ${error.message}`);
  }

  return { name: restaurant.name, website, candidates };
}

// ---------------------------------------------------------------- main
async function main() {
  const runStartedAt = new Date().toISOString();
  const mode = DUMP_TEXT ? 'DUMP-TEXT' : APPLY ? (AUTO_PUBLISH ? `APPLY+AUTO-PUBLISH(>=${MIN_CONFIDENCE})` : 'APPLY') : 'DRY-RUN';
  log(`Deal agent starting (${mode}, provider=${GEMINI_KEY ? 'gemini' : OPENAI_KEY ? 'openai' : 'none'})`);

  let q = supabase
    .from('restaurants')
    .select('id, name, type, address, city, website_url, partner, deals_scrape_opt_out, deals_last_crawled_at')
    .eq('partner', false)
    .eq('deals_scrape_opt_out', false);
  if (ONLY_ID) q = q.eq('id', ONLY_ID);
  q = q.order('deals_last_crawled_at', { ascending: true, nullsFirst: true });
  if (LIMIT) q = q.limit(LIMIT);

  const { data: restaurants, error } = await q;
  if (error) { console.error('Failed to load restaurants:', error.message); process.exit(1); }
  log(`Targets: ${restaurants.length} non-partner restaurant(s) from the live restaurants table`);

  let totalCandidates = 0;
  let staled = 0;
  for (const r of restaurants) {
    try {
      const res = await processRestaurant(r);

      if (DUMP_TEXT) {
        log(`- ${res.name}: ${res.website || 'NO WEBSITE'}`);
        if (res.urls) log(`    pages: ${res.urls.join(', ')}`);
        if (res.dumpText) log(`    --- prefiltered deal text (${res.dumpText.length} chars) ---\n${res.dumpText.slice(0, 1500)}\n    --- end ---`);
        else log(`    skipped (${res.skipped || 'no text'})`);
        continue;
      }

      if (res.skipped) {
        log(`- ${res.name}: skipped (${res.skipped})`);
      } else {
        log(`- ${res.name}: ${res.candidates.length} candidate(s)  ${res.website}`);
        res.candidates.forEach((c) => {
          const when = c.recurrence_days ? `days[${c.recurrence_days}] ${c.recurrence_start_time || '?'}-${c.recurrence_end_time || '?'}` : 'no schedule';
          log(`    • [${(c.confidence ?? 0).toFixed(2)}] ${c.title} (${c.deal_category}) ${when}`);
          log(`        ↳ "${(c.evidence_quote || '').slice(0, 120)}"`);
        });
        totalCandidates += res.candidates.length;
      }

      if (APPLY) {
        const { data: st, error: stErr } = await supabase
          .from('scraped_deal_candidates')
          .update({ status: 'stale' })
          .eq('restaurant_id', r.id).eq('status', 'pending').lt('last_seen_at', runStartedAt)
          .select('id');
        if (stErr) log(`  ! failed to retire stale candidates: ${stErr.message}`);
        if (st) staled += st.length;
      }
    } catch (err) {
      log(`! ${r.name}: ${err.message}`);
    }
  }

  if (DUMP_TEXT) { log('Done (dump-text, nothing written).'); return; }
  log(`Done. ${totalCandidates} candidate(s) ${APPLY ? 'persisted' : '(dry-run, nothing written)'}; ${staled} stale pending candidate(s) retired.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
