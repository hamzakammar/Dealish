# Changelog

Notable changes to Dealish. Newest first.

## 2026-06-02 — Deal-scraping agent: Phases 2–3 (review queue + automation)

Completed the agent end to end. It still publishes nothing without operator approval.

- **Phase 2 — review + publish.** Operator screen `app/admin/deal-review.tsx`
  (`hooks/useScrapedDealCandidates.ts`): shows restaurant, confidence, schedule,
  verbatim evidence, and source link; approve publishes a `deals` row
  (`source='scraped'`), reject marks the candidate rejected. Gated by
  `profiles.is_operator` (RLS + UI). `DealCard` renders an
  "Auto-detected · not yet verified" badge for scraped deals.
- **Phase 3 — automation.** Weekly GitHub Actions cron
  (`.github/workflows/deal-agent.yml`, Mondays 09:00 UTC; manual dispatch defaults to
  dry-run). Agent gains: `--dump-text` (validate discovery/fetch with no LLM key),
  status-preserving upsert, per-restaurant staleness expiry (un-reviewed candidates
  not re-found → `stale`; live deals never retired by a transient miss), and opt-in
  `--auto-publish --min-confidence=` (off by default).
- **Self-correction** (`add_scraped_deal_flag_deactivation.sql`): a scraped deal with
  ≥3 thumbs_down (and more downs than ups) auto-deactivates. Owner/partner deals
  untouched.

**Manual provisioning required before it runs:** apply both migrations; set
`profiles.is_operator=true` for the reviewer; set GitHub Actions secrets
(`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`).
Validate with a `--dump-text` then a dry-run before `--apply`.

## 2026-06-01 — Deal-scraping agent: design + Phases 0–1

Started the weekly agent that auto-detects deals for **non-partner** restaurants from
their own website (source of truth) into a human-in-the-loop review queue.

- **Design** (`docs/deal-scraping-agent.md`): guardrails (consent/accuracy/unverified
  labeling/opt-out), ETL-as-partner-funnel reframe, GitHub Actions cron architecture,
  and a cost model (~$3.40 one-time Places + ~$0–2/mo LLM — content-hash skip keeps
  most weekly runs at zero tokens).
- **Phase 0 schema** (`add_deal_scraping_agent.sql`, additive/idempotent):
  `restaurants.website_url/google_place_id/deals_last_crawled_at/deals_scrape_opt_out`;
  `deals.source_url/confidence/last_verified_at`; `profiles.is_operator`; and the
  `scraped_deal_candidates` review queue (provenance: `source_url`, `evidence_quote`,
  `confidence`, `content_hash`, `dedupe_hash`).
- **Phase 1 agent** (`scripts/agent/grab-deals.js`): pulls non-partner restaurants
  from the live `restaurants` table, finds the official site via Google Places,
  fetches likely deal pages, keyword-prefilters, extracts deals with a cheap LLM
  (Gemini Flash default / GPT-4o-mini) with a mandatory verbatim `evidence_quote` +
  confidence, normalizes to the deals recurrence model. Dry-run by default; never
  writes to `deals`. No new dependencies.

## 2026-05-31 — Deployment bug fixes, server-side Places, Sheets import

Fixed the deployment bugs surfaced after the technical-debt pass, and moved
geocoding/ratings off Nominatim onto Google Places (server-side).

- **Restaurant ratings are read-only**, sourced from Google (`places.rating` /
  `userRatingCount`) instead of self-reported. Removes the "restaurants can inflate
  their own stars" bug.
- **Server-side Places** edge function (`supabase/functions/places`): New Places API
  v1 proxy with `autocomplete` / `details` / `geocode`, returning
  `{lat,lng,address,name,rating,userRatingCount}`. Keyed by the `GOOGLE_MAPS_API_KEY`
  secret. Fixes restaurant-creation (coords now populate) and address autocomplete
  (Nominatim forbade as-you-type autocomplete + throttled).
- `create-restaurant` / `restaurant` admin screens wired to Places, with Nominatim
  kept only as a geocode fallback.
- **Idempotent Sheets import**: re-importing the same Google Sheet now updates rows
  (match by SKU, else name) instead of duplicating every product + inventory row.
- Docs: `places` edge function + `GOOGLE_MAPS_API_KEY` secret recorded.
