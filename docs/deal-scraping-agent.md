# Deal-Scraping Agent

A weekly job that auto-detects deals for **non-partner** restaurants from their own
website and feeds them into a **review queue** for admin approval. Approved deals
are published into `deals` with `source='scraped'`. (The consumer-facing
"Auto-detected · unverified" badge on `DealCard` was **removed** on 2026-07-31 by
product decision; `source='scraped'` is still stored for provenance/opt-out/flagging.)

> Status: **code complete (phases 0–3), but never provisioned or run.** As of the
> last check the agent schema is **not applied to the live DB** (`scraped_deal_candidates`,
> `restaurants.deals_scrape_opt_out`, `deals.source` all missing). Before it can run:
> 1. Apply the schema — one paste: **`database/APPLY_agent.sql`**.
> 2. Set GitHub Actions repo secrets (see "Operations").
> 3. Flip `profiles.is_operator = true` for the reviewer.
> It has also **never been run against a real website or LLM**, and the
> normalize/dedupe/prefilter logic has **no dedicated automated tests** — so a
> `--dump-text` then dry-run validation pass is strongly recommended before the
> first `--apply`. Until the schema is applied, the operator "Review Auto-Detected
> Deals" dashboard entry will error (its table doesn't exist yet).

## Why / guardrails

We publish deals about businesses we have no relationship with. The whole design is
shaped by accuracy + consent, not by extraction cleverness:

- **Website is the source of truth.** Only the restaurant's own official site (from
  Google Places `websiteUri`). No Yelp/Instagram scraping in v1 (ToS + accuracy risk).
  Instagram may be added later as a *cross-reference* signal only.
- **Human-in-the-loop.** The agent never writes to `deals`. It writes candidates;
  an admin approves; approval publishes.
- **Provenance is mandatory.** Every candidate stores `source_url`, an
  `evidence_quote` (the exact text it was read from), and a `confidence` score.
- **Unverified labeling.** ~~Published scraped deals render with an
  "Auto-detected · unverified" badge~~ — the consumer badge was **removed 2026-07-31**
  by product decision. Provenance is still tracked server-side (`source`,
  `source_url`, `evidence_quote`, `confidence`) and the "Claim / correct" partner
  funnel is unaffected. Re-adding the badge is a separate product decision.
- **One-click opt-out**, honored immediately (`restaurants.deals_scrape_opt_out`).
- **Self-correcting.** `deal_flags` thumbs-down on a scraped deal auto-deactivates it
  past a threshold.

## Reframe

This is an ETL pipeline that doubles as the **partner-acquisition funnel**: "We found
your Thu 4–6pm happy hour and showed it to N nearby users — claim your listing to
control it." The scraped deal is bait for the `partner` upgrade.

## Architecture

Runs **outside the app** as a weekly **GitHub Actions cron** invoking a Node/TS
script in `scripts/agent/`, authenticated with the Supabase **service key** (bypasses
RLS). Not an edge function — the batch is long-running/bursty, which edge functions
(CPU/time limits) handle poorly; CI logs are free observability.

### Pipeline (per restaurant)

1. **Select** — `restaurants WHERE partner=false AND deals_scrape_opt_out=false` whose
   `deals_last_crawled_at` is older than 7 days.
2. **Discover** — Google Places Details → `websiteUri` (cache `google_place_id` +
   `website_url`; one-time cost per restaurant). Candidate pages: site root +
   `/happy-hour`, `/specials`, `/deals`, `/menu`, `/drinks`, plus on-page links whose
   text/href contains those keywords. PDFs (menus) parsed as text.
3. **Fetch** — plain `fetch` + local readability → text. Escalate to a reader/headless
   only when content is too thin (JS-only sites). **Content hash:** if a page is
   unchanged since last run, skip the LLM and just bump `last_seen_at`.
4. **Pre-filter** — keep only sections containing deal keywords (`happy hour`, `$`,
   `off`, `pm`, `special`, `bogo`, `student`, `deal`…). Cuts tokens + noise.
5. **Extract (LLM)** — structured JSON: `deals[] { title, description, deal_category,
   discount_type, discount_value, days[], start_time, end_time, fine_print,
   confidence, evidence_quote }`. Cheap model (Gemini 2.0 Flash / GPT-4o-mini),
   provider-agnostic behind one `extractDeals(text)` function.
6. **Normalize + upsert** — map to the `deals` recurrence model; compute `dedupe_hash`
   = stable hash of `(restaurant_id + normalized title/days/time)`; upsert into
   `scraped_deal_candidates` on `(restaurant_id, dedupe_hash)`. Mark candidates not
   re-found this run as `stale`.

### Cost (≈170–200 restaurants/week)

- Places `websiteUri`: ~$3.40 one-time (cached thereafter).
- Fetch/readability: $0 (local).
- LLM: $0–$2/month (content-hash skip means most weeks send ~0 tokens).
- GitHub Actions: free tier.

## Data model (Phase 0 — `add_deal_scraping_agent.sql`)

- `restaurants`: `website_url`, `google_place_id`, `deals_last_crawled_at`,
  `deals_scrape_opt_out`.
- `deals`: `source ('owner'|'scraped'|'seed')`, `source_url`, `confidence`,
  `last_verified_at`.
- `scraped_deal_candidates`: full normalized deal + provenance + review workflow
  (`status: pending|published|rejected|stale|superseded`, `dedupe_hash` unique per
  restaurant). Admin-only RLS; agent writes via service role.

## Build plan (all landed)

- **Phase 0 — schema.** `add_deal_scraping_agent.sql` (+ `add_scraped_deal_flag_deactivation.sql`).
- **Phase 1 — extract.** `scripts/agent/grab-deals.js`: discover → fetch → pre-filter
  → extract → normalize → candidates. Dry-run by default; `--dump-text` validates
  discovery/fetch with no LLM key.
- **Phase 2 — review + publish.** Operator screen `app/admin/deal-review.tsx`
  (`hooks/useScrapedDealCandidates.ts`): approve publishes a `deals` row
  (`source='scraped'`; the consumer "Auto-detected · unverified" badge was removed
  2026-07-31); `deal_flags` auto-deactivation trigger retires repeatedly-flagged
  scraped deals.
- **Phase 3 — automate.** Weekly GitHub Actions cron (`.github/workflows/deal-agent.yml`);
  per-restaurant staleness expiry (un-reviewed candidates not re-found → `stale`);
  opt-in `--auto-publish --min-confidence=` (off by default — v1 is queue-only).
  Instagram cross-reference is still future work.

## Operations

**Secrets (GitHub Actions repo secrets):** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`GOOGLE_MAPS_API_KEY` (Places API enabled), and `GEMINI_API_KEY` (or `OPENAI_API_KEY`).

**Run modes** (`node scripts/agent/grab-deals.js`):
- (no flags) — dry-run over 10 restaurants; prints deals + evidence, writes nothing.
- `--dump-text` — no LLM key needed; prints the prefiltered page text per restaurant
  (validates website discovery + fetch).
- `--apply` — persist candidates to the queue + stamp `deals_last_crawled_at` + retire
  stale pending candidates.
- `--limit=N`, `--id=<uuid>`, `--force` (ignore content-hash skip).
- `--auto-publish [--min-confidence=0.8]` — opt-in; publishes high-confidence
  candidates straight to `deals` (still badged). Leave off to keep human-in-the-loop.

The reviewer must have `profiles.is_operator = true`; then "Review Auto-Detected
 Deals" appears in the owner dashboard → More.

## Open items

**Before first run (blocking):**
- Apply `database/APPLY_agent.sql` to the live DB. (Fixed: the migration now adds
  `deals.source` defensively — it previously assumed the column existed and would
  fail on the index build.)
- Set GitHub Actions secrets incl. `SUPABASE_SERVICE_KEY` + an LLM key.
- Flip `profiles.is_operator` for the reviewer.

**Validation (recommended before publishing deals about real businesses):**
- `--dump-text` smoke test: confirm Places discovery finds the official sites and
  fetch+readability+prefilter yields usable text for *these* ~170 restaurants.
- Dry-run with an LLM key on ~10 restaurants: sanity-check extraction quality,
  evidence quotes, and confidence; tune the prompt/threshold.
- Add unit coverage for normalize/dedupe/prefilter against fixture HTML.

**Deferred / future:**
- LLM provider/key (recommend Gemini 2.0 Flash for free-tier cost; GPT-4o-mini alt).
- Reader/headless fallback for JS-only sites (defer until dump-text shows it's needed).
- PDF menu parsing and Instagram cross-reference (future).
