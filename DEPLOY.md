# Dealish — Deploy / Go-Live Checklist

Everything needed to take the committed fixes from the repo into a working app.
Order is load-bearing: server changes first (1–3), then ship the app (4).

## CORE APP — fixes the 4 deployment bugs + analytics

### 1. Apply the database fixes
Supabase → SQL Editor → paste **`database/APPLY_core_fixes.sql`** → Run.
Confirm the 5 read-only VERIFY rows at the bottom look right.
Fixes: Bug D (QR scan attribution) server-side, analytics, DEBT-001/002/005/009/016.

### 2. Create `restaurant-images` Storage policies
Dashboard → Storage → `restaurant-images` → Policies:
- **SELECT** (anon, authenticated): `bucket_id = 'restaurant-images'`
- **INSERT/UPDATE/DELETE** (authenticated): `bucket_id = 'restaurant-images'
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('owner','admin'))`

### 3. Deploy the Places edge function + secret
Fixes Bug A (restaurant creation), Bug C (address autocomplete), Bug B (Google rating fetch).
```bash
supabase secrets set GOOGLE_MAPS_API_KEY=<key with Places API enabled>
supabase functions deploy places
```

### 4. Rebuild & ship the app  (MANDATORY — old build has none of the fixes)
```bash
eas build --platform ios --profile production   # confirm eas.json has this profile
eas submit --platform ios                        # or install the build directly
```

### 5. Verify on the new build
- Create a restaurant → address autocompletes and saves (coords populate).
- Restaurant rating/reviews are read-only ("pulled from Google").
- Scan a deal QR on the owner device → success, scan recorded, customer credited.
- Admin → Analytics shows the scan (no longer "No Data Yet").

---

## DEAL-SCRAPING AGENT — optional new feature (do after the core app works)

### 6. Apply the agent migrations
`database/migrations/add_deal_scraping_agent.sql`, then
`database/migrations/add_scraped_deal_flag_deactivation.sql`.

### 7. Make yourself the reviewer
```sql
update public.profiles set is_operator = true where id = '<your-auth-user-id>';
```

### 8. GitHub Actions secrets (repo → Settings → Secrets and variables → Actions)
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY` (or `OPENAI_API_KEY`).

### 9. Validate, then automate
```bash
node scripts/agent/grab-deals.js --dump-text --limit=10   # no LLM key needed; checks discovery
node scripts/agent/grab-deals.js --limit=10               # dry-run; read the extractions + evidence
node scripts/agent/grab-deals.js --apply                  # fill the review queue
```
Then review in-app: owner dashboard → More → "Review Auto-Detected Deals".
The Monday cron (`.github/workflows/deal-agent.yml`) runs `--apply` automatically.

---

## Things only you can confirm
- `GOOGLE_MAPS_API_KEY` has **Places API enabled** + billing on (Step 3 fails otherwise).
- `eas.json` has a `production` build profile (Step 4).
- If `scripts/seed_analytics.js` was ever run against prod, ask for a cleanup query to
  remove the fake `qr_code_scans` rows before trusting analytics.
