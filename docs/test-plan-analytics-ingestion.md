# Test Plan — PostHog analytics & operator restaurant ingestion

Covers the two features. **Automated** = jest (`npm test`) / `npm run typecheck`.
**Manual** = on-device / Supabase, since RN UI + RLS + storage + real PostHog
can't be fully exercised in jest.

## 1. Analytics events

Automated (`utils/__tests__/analytics.test.ts`):
- No-op when `EXPO_PUBLIC_POSTHOG_API_KEY` is unset (`isAnalyticsEnabled()` false; capture/identify/screen do nothing).
- `captureEvent` forwards event name + properties to PostHog.
- `identifyUser` uses the Supabase id and sends **no email/phone** (PII exclusion asserted).
- `resetAnalytics` / `captureScreen` / `registerSuperProperties` forward correctly.
- Event catalog has all 16 funnel events with stable names.
- `first_app_open` fires once, then false after the flag is set.

Manual (dev build with a real key in `.env.local`, PostHog "Activity" live view):
- Cold start → `app_opened` (+ `first_app_open` on a fresh install only; reinstall re-fires).
- Onboarding start/finish/skip → `onboarding_started`, `onboarding_completed` (`method` = completed/skipped).
- Auth screen → `login_viewed`; email/OAuth success → `login_completed` (`method`/`type`); welcome "get started"/"skip" → `login_skipped`.
- Map mount → `home_viewed`; toggle to list → `restaurant_list_viewed`.
- Open a restaurant detail card → exactly ONE `restaurant_opened` with `restaurant_id/name/city/source_screen/authenticated`; rapid marker taps must NOT inflate it.
- Deals visible → one `deal_viewed` per opened restaurant (has `deal_id` when a headline deal exists).
- Merchant scans a valid QR → `deal_redeemed` with `redeemed_by_user_id` (customer) as a property.
- Type in search → one debounced `search_performed` (not per keystroke); apply/clear filters → `filter_applied`.
- Location prompt → `location_permission_requested` then `_granted`/`_denied`.
- Screen tracking: navigating routes emits one `$screen` per distinct path (no duplicates on rerender/focus).
- Identity: sign in → events attach the Supabase id + `authenticated:true`; sign out → `reset()` (next events are anonymous, not merged).

## 2. Authorization (operator-only)

Automated (`utils/__tests__/ingestRestaurant.test.ts`):
- `not_operator` RPC error → typed `{ ok:false, code:'not_operator' }`.

Manual:
- **UI gate:** as a normal user (`is_operator = false`), the "Add Restaurant (Ingestion)" item does not appear in the admin dashboard, and navigating directly to `/admin/ingest-restaurant` redirects to `/`.
- **Server gate (defence-in-depth):** call the RPC directly as a non-operator (e.g. from a signed-in non-operator session in the Supabase SQL/JS console):
  `select * from create_ingested_restaurant_with_deal('X',43.6,-79.3,'Deal');`
  → must raise `not_operator` (SQLSTATE 42501). As an operator it must succeed.

## 3. Duplicate prevention

Automated: `duplicate_place` and `duplicate_name_address` RPC errors → `{ code:'duplicate' }`.

Manual (as operator):
- Create "Test Cafe" with a Google place selected. Re-submit the **same place** → "Possible duplicate" (blocked on `google_place_id`).
- Create a second with the **same name + same address** (no place id) → blocked (`duplicate_name_address`).
- Create with the **same name within ~100m** (different address text) → blocked (coordinate-proximity branch).
- A genuinely different restaurant (different name/place) → succeeds.

## 4. Photo upload

Manual:
- Tap upload → pick an image → it uploads to the `restaurant-images` bucket and the public URL appears/previews. No Google photo-fetch is offered (removed by design).
- If the operator account lacks storage-upload permission, the helper alerts "Storage Not Configured / Upload Failed" — add the operator clause to the bucket policy (see the migration's storage note) and retry.
- Submitting **without** a photo still succeeds (photo is optional; `hero_image_url` null).

## 5. Restaurant creation

Automated: success path returns `{ ok:true, restaurantId, dealId }`; RPC called with the correct `p_*` params (name/lat/lng/place id/etc.).

Manual (as operator):
- Fill required fields (name, coordinates via place select or manual, deal title + schedule) → submit → success alert; the new restaurant row exists with `owner_id` = operator, `partner=false`, `source`-eligible for the agent, and `is_test` matching the toggle.
- With `is_test = true`, the restaurant is visible to operators only (hidden from normal users by the existing `restaurants_hide_test` policy); with `is_test = false` it's live to everyone.
- Form **resets** after success so another can be added immediately.

## 6. Deal creation

Automated: recurring input → `p_is_recurring=true`, `p_recurrence_days/times` set, `p_start_at/p_end_at` null. One-time input → dates set, recurrence null.

Manual:
- Recurring: pick valid days + start/end times → the created deal has `is_recurring=true`, `recurrence_days`, and times; `source='manual'`.
- One-time: start/end dates → deal has `start_at`/`end_at`; recurrence null.
- The deal is linked to the new restaurant and appears on its detail card.

## 7. Rollback / error handling

Automated:
- Missing returned row (no error) → `{ code:'unknown' }` (never a false success).
- Thrown client error → caught → `{ code:'unknown', message }`.
- Validation RPC errors (`missing_*`, `invalid_*`) → `{ code:'validation' }`.

Manual (atomicity):
- Force the deal insert to fail (e.g. temporarily pass an invalid recurring time to the RPC in SQL) → the whole transaction rolls back: **no** orphan restaurant or membership row is left behind (the RPC body is a single transaction). Verify `restaurants`/`restaurant_members` have no partial row afterward.
- Client-side validation blocks submit (empty name / bad coordinates / missing deal title / end-before-start) with a clear alert before any network call.

## Commands

- `npm run typecheck` — must be clean.
- `npm test` — jest (analytics + ingestion suites plus the existing deal suites).
- No lint tooling is configured in this repo (no eslint/biome); typecheck + jest are the gate.
