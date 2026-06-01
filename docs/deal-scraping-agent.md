# Deal-Scraping Agent

A weekly job that auto-detects deals for **non-partner** restaurants from their own
website and feeds them into a **review queue** for admin approval. Approved deals
are published into `deals` with `source='scraped'` and an "unverified" badge.

> Status: **Phase 0 (schema)** landed. Phases 1–3 below are the build plan.

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
- **Unverified labeling.** Published scraped deals render with an
  "Auto-detected · unverified" badge + a "Claim / correct" CTA (partner funnel).
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

## Build plan

- **Phase 0 — schema.** ✅ `add_deal_scraping_agent.sql`.
- **Phase 1 — extract, no publish.** `scripts/agent/grab-deals.ts` over ~10
  restaurants: discover → fetch → pre-filter → extract → write candidates. Dry-run
  mode. *Eyeball real extractions before automating anything.*
- **Phase 2 — review + publish.** Admin queue screen (approve/reject/edit);
  publishing inserts a `deals` row (`source='scraped'`, recurrence, badge); wire
  `deal_flags` auto-deactivation.
- **Phase 3 — automate.** Weekly GitHub Actions cron; staleness expiry; optional
  high-confidence (>0.8) auto-publish (still badged); Instagram cross-reference.

## Open items

- LLM provider/key (recommend Gemini 2.0 Flash for free-tier cost; GPT-4o-mini alt).
- Reader/headless fallback choice for JS-only sites (defer until Phase 1 shows it's needed).
