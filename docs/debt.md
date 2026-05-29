# Technical Debt Log

> This file is the authoritative record of known technical debt in Dealish.  
> **Rule:** If you knowingly defer something, add it here before merging. Do not leave debt undocumented.

---

## How to Use This File

Each entry follows this format:

```
### [DEBT-NNN] Short title
- **Severity:** low | medium | high | critical
- **Area:** component / module / system affected
- **Logged:** YYYY-MM-DD
- **Author:** name or handle
- **Description:** What is the problem and why does it exist?
- **Impact:** What breaks or degrades if this is not fixed?
- **Fix:** What would a correct resolution look like?
- **Unblocked by:** What needs to happen before this can be addressed? (optional)
```

Severity guide:
- **critical** — actively causing data loss, security issues, or production outages.
- **high** — causing user-facing bugs or significantly slowing development.
- **medium** — creates friction; should be fixed within the next 2–3 milestones.
- **low** — nice-to-have cleanup; address opportunistically.

---

## Open Debt

<!-- Add new entries below this line, newest first. -->

> Entries DEBT-001..016 were logged on 2026-05-29 from a full repo + live-schema
> audit. Severities reflect impact at time of logging. Findings 1–3 were verified
> by grepping the app (it never references `merchant`, `mint_redemption`,
> `verify_redemption`, or `redemptions`).
>
> ### Resolution status (2026-05-29 remediation pass)
>
> | ID | Status | Where |
> |---|---|---|
> | DEBT-001 | Fixed in repo — **apply migration** | `database/migrations/fix_is_merchant_role.sql` |
> | DEBT-002 | Fixed in repo — **apply migration** | `database/migrations/drop_redundant_deals_select_policy.sql` |
> | DEBT-003 | Fixed in repo — **apply migration** | `add_redeem_deal_scan_rpc.sql` + `utils/qrCode.ts`, `app/qr-scanner.tsx` |
> | DEBT-004 | Corrected + documented | `database/migrations/add_notification_triggers.sql` (optional, not applied) |
> | DEBT-005 | Fixed in repo — **apply migration** | `database/migrations/drop_restaurants_owner_id_default.sql` |
> | DEBT-006 | **Resolved** | `components/listView.tsx` (`onError`) |
> | DEBT-007 | **Resolved** | `__mocks__/app/lib/supabase.ts`, `StyledText-test.js` |
> | DEBT-008 | Partially fixed — **AASA still mismatched** | `package.json` 1.5.0; bundle id kept `com.anonymous.Dealish`; reconcile `apple-app-site-association` |
> | DEBT-009 | Fixed in repo — **apply migration + dashboard policies** | `database/migrations/setup_restaurant_images_storage.sql` |
> | DEBT-010 | Open — product decision | (no safe code fix) |
> | DEBT-011 | **Resolved** | docs + `LAUNCH_CHECKLIST.md` |
> | DEBT-012 | Fixed in repo | `database/schema_base.sql` |
> | DEBT-013 | Mostly resolved | `npm audit fix` (0 high; 19 moderate need SDK bump) |
> | DEBT-014 | **Resolved** | `.github/workflows/ci.yml` |
> | DEBT-015 | **Resolved** | `package.json` (`typecheck`) |
> | DEBT-016 | Fixed in repo — **apply migration** | `database/migrations/change_recents_to_jsonb.sql` |
>
> **"Apply migration"** = the SQL exists in the repo but must be run against the
> live Supabase project (it is not auto-applied). Apply `change_recents_to_jsonb.sql`
> before `add_redeem_deal_scan_rpc.sql`.

### [DEBT-001] `is_merchant()` is always false — server-side redemption system is dead
- **Severity:** high
- **Area:** Supabase RLS + RPCs (`is_merchant`, `verify_redemption`, `mint_redemption`, `redemptions`)
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `is_merchant()` checks `profiles.role = 'merchant'`, but the
  `profiles_role_check` constraint only allows `user`/`owner`/`admin`. So the
  predicate can never be true. `verify_redemption()` requires `is_merchant()` and
  always returns "Not a merchant"; all `*_merchant_*` RLS policies are inert; and
  `mint_redemption()` + the secure token/PIN `redemptions` design are unused by the
  app (which uses the `qr_code_scans` path instead).
- **Impact:** A whole secure-redemption subsystem exists but is unreachable. Anyone
  who tries to adopt it will hit a silent always-deny. Dead code invites confusion
  and future foot-guns.
- **Fix:** Decide one path: (a) adopt `redemptions` — add a `merchant` role (or change
  `is_merchant()` to accept `owner`/`admin`) and wire the app to `mint`/`verify`; or
  (b) delete `redemptions`, `mint_redemption`, `verify_redemption`, `is_merchant`,
  and the `*_merchant_*` policies. Do not half-adopt.

### [DEBT-002] Deal schedule gating bypassed by overlapping RLS policies
- **Severity:** medium
- **Area:** Supabase RLS on `deals`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `deals` has two permissive SELECT policies:
  `deals_public_read_active_now` (time-window via `is_deal_active_now`) and the
  legacy `Public can view active deals` (`is_active = true`). Permissive policies
  are OR'd, so the looser legacy policy wins and `start_at`/`end_at` are not enforced
  at the DB.
- **Impact:** Scheduled/expired-but-active deals are publicly readable from the DB.
  The UI hides them only because the app re-filters client-side
  (`hooks/useActiveDealsMap.ts`).
- **Fix:** Drop the legacy `Public can view active deals` policy if server-side
  schedule gating is intended; otherwise document that gating is client-side only.

### [DEBT-003] Two redemption systems; app uses the weaker one + scan attribution bug
- **Severity:** medium
- **Area:** redemption flow (`app/qr-scanner.tsx`, `utils/activity.ts`, `qr_code_scans`)
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** The app records redemptions in `qr_code_scans` (plain log) using
  the customer `user_id` from the QR payload, but `trackRedemption()` in
  `utils/activity.ts` uses `supabase.auth.getUser()` (the scanner/admin device), so
  analytics attribution and profile recent-activity attribution can diverge. A
  stronger system (`redemptions`) exists but is dormant (see DEBT-001).
- **Impact:** Inconsistent redemption attribution; weaker security than the
  available token/PIN design.
- **Fix:** Make attribution consistent (pass the scanned customer id through to
  `trackRedemption`), then resolve DEBT-001 to pick the canonical system.

### [DEBT-004] Notification-trigger migration was never applied (stale `is_partner`)
- **Severity:** medium
- **Area:** `database/migrations/add_notification_triggers.sql`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** The live DB has no triggers on `restaurants` beyond
  `set_updated_at`, and no `is_partner` column. The committed migration references
  `NEW.is_partner` and `net.http_post` and was never applied. New-partner push is
  sent from app code (`utils/notifications.ts`) instead.
- **Impact:** A committed migration that would fail if run as-is (wrong column,
  requires `pg_net` + custom settings). Misleads anyone trying to rebuild the DB.
- **Fix:** Either delete/rewrite the migration to match reality (`partner` column,
  real config) or mark it explicitly as not-applied/aspirational.

### [DEBT-005] `restaurants.owner_id` defaults to a hardcoded UUID
- **Severity:** low
- **Area:** `restaurants` table default
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `owner_id` has `DEFAULT '41995df0-4f14-421c-a481-5e0a62fb96d1'::uuid`.
  Any insert omitting `owner_id` silently assigns that account.
- **Impact:** Footgun. The working INSERT policy requires `auth.uid() = owner_id`,
  so for others it just produces an RLS failure rather than a mis-owned row — but
  it's surprising and unsafe.
- **Fix:** Drop the column default; require `owner_id` to be set explicitly.

### [DEBT-006] TypeScript build fails (`expo-image` prop in listView)
- **Severity:** high
- **Area:** `components/listView.tsx`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `npx tsc --noEmit` fails:
  `Property 'onLoadError' does not exist on type ImageProps` (line ~75).
  `expo-image` uses `onError`, not `onLoadError`.
- **Impact:** No clean type check; broken signal for any type-gated CI.
- **Fix:** Replace `onLoadError` with `onError` (verify the handler signature).

### [DEBT-007] Test suite exits non-zero despite passing assertions
- **Severity:** high
- **Area:** Jest setup / mocks
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `npm test` reports all tests passing, then exits code 1 due to a
  React test-renderer teardown error (`TypeError: window.dispatchEvent is not a
  function`). The Supabase mock also lacks `.neq()`, logging errors in list tests,
  and `StyledText-test.js` emits an `act()` warning + generates a snapshot.
- **Impact:** CI would fail; tests can't be trusted as a green gate.
- **Fix:** Add a `window`/RN environment shim (or remove the legacy starter test),
  extend the Supabase mock with `.neq()` and any other missing chain methods.

### [DEBT-008] App identifier and version mismatches
- **Severity:** medium
- **Area:** `app.json`, `package.json`, `apple-app-site-association`, launch docs
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `package.json` version `1.0.3` vs `app.json` `1.5`; `app.json`
  bundle ID `com.anonymous.Dealish` vs `LAUNCH_READY.md`/AASA `ca.hamzaammar.dealish`.
- **Impact:** Breaks universal links, Apple Sign-In, and App Store assumptions;
  confusing release state.
- **Fix:** Pick the real bundle ID/version and reconcile all four sources.
  **Status (2026-05-29):** version aligned to `1.5.0`; bundle id kept as
  `com.anonymous.Dealish` (maintainer decision). Still to do: update
  `apple-app-site-association` (declares `ca.hamzaammar.dealish`) and the stale
  `LAUNCH_READY.md` note to match `com.anonymous.Dealish`.

### [DEBT-009] `restaurant-images` storage bucket not represented in repo
- **Severity:** medium
- **Area:** Supabase Storage
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `utils/uploadImage.ts` and the photo scripts use a
  `restaurant-images` bucket, but only `avatars` has a setup migration. The bucket
  and its policies exist (if at all) only in the hosted project.
- **Impact:** Can't recreate Storage from the repo; uploads may fail in a fresh env.
- **Fix:** Add a migration/seed for the `restaurant-images` bucket + RLS policies.

### [DEBT-010] Google Sheets integration is split-brain (dormant edge fns vs CSV import)
- **Severity:** medium
- **Area:** `app/admin/integrations.tsx`, `supabase/functions/sheets-*`, `google-oauth*`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** The app does a simple public-CSV import; the edge-function +
  OAuth + cron sync (and tables `api_keys`, `sheet_integrations`, `sheet_synced_rows`,
  `google_oauth_tokens`) are dormant. No app handler exists for the
  `dealish://oauth-google-sheets` deep link the redirect function emits.
- **Impact:** Two competing designs; dead server code and unreachable deep link.
- **Fix:** Decide CSV-only vs full sync; remove or finish the unused path and add
  the missing deep-link handler if keeping OAuth.

### [DEBT-011] Stale/contradictory docs and config references
- **Severity:** low
- **Area:** `docs/`, `LAUNCH_CHECKLIST.md`, `LAUNCH_READY.md`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `architecture.md` previously said migrations live in
  `supabase/migrations/` (they're in `database/migrations/`) — now fixed.
  `LAUNCH_CHECKLIST.md` references `EXPO_PUBLIC_AUTH_REDIRECT_URL` but the code
  hardcodes `dealish://auth/callback`. Launch docs assert config that `app.json`
  contradicts (see DEBT-008).
- **Impact:** Misleads contributors and agents.
- **Fix:** Audit launch docs against current code; remove or correct stale claims.

### [DEBT-012] Base DB schema is hosted-only (repo can't recreate the database)
- **Severity:** medium
- **Area:** `database/migrations/`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `profiles`, `restaurants`, `deals`, `redemptions`, `menu_items`,
  `menu_item_ingredients`, and the `append_favourite`/`remove_favourite` RPCs have
  no `CREATE` migration in the repo. `docs/database-schema.md` is the only in-repo
  record of their shape.
- **Impact:** A fresh Supabase project cannot be built from this repo alone;
  onboarding/disaster-recovery is manual.
- **Fix:** Add baseline migrations (or a `schema.sql` dump) for all hosted-only
  objects and keep them in sync.

### [DEBT-013] Dependency vulnerabilities (npm audit)
- **Severity:** low
- **Area:** dependencies
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** `npm audit` reports 29 vulnerabilities (22 moderate, 7 high; 0
  critical), mostly transitive (`undici`, `tar`, `node-forge`, `minimatch`,
  `picomatch`, `@xmldom/xmldom`, `@isaacs/brace-expansion`).
- **Impact:** Mostly build/tooling transitive risk; low runtime exposure.
- **Fix:** Run `npm audit fix` and bump the Expo SDK/toolchain as feasible; re-audit.

### [DEBT-014] No CI configured
- **Severity:** low
- **Area:** repo tooling
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** No `.github/workflows` (or other CI) exists. Type check and tests
  are run manually.
- **Impact:** Regressions (e.g. DEBT-006/007) land unguarded.
- **Fix:** Add CI running `tsc --noEmit` and `jest` on PRs once they pass.

### [DEBT-015] No `typecheck` npm script
- **Severity:** low
- **Area:** `package.json`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** Type checking requires remembering `npx tsc --noEmit`; there's no
  `typecheck` script.
- **Impact:** Minor friction; easy to skip.
- **Fix:** Add `"typecheck": "tsc --noEmit"` to `package.json` scripts.

### [DEBT-016] `profiles.recents` is `uuid[]` but the app stores activity objects
- **Severity:** high
- **Area:** `profiles.recents`, `utils/activity.ts`, `app/account.tsx`
- **Logged:** 2026-05-29
- **Author:** schema audit
- **Description:** The live column is `uuid[]`, but `trackVisit`/`trackRedemption`
  and `app/account.tsx` read/write activity OBJECTS
  (`{ restaurant_id, activity_type, deal_id, amount_saved, created_at }`). Writing
  objects into a `uuid[]` column fails, so visit/savings/recent-activity tracking
  is silently broken app-wide (errors are caught and swallowed).
- **Impact:** Recent-activity feed and visit/savings counters never populate from
  the `recents` path.
- **Fix:** Change `recents` to `jsonb` to match usage.
  **Status:** migration written (`database/migrations/change_recents_to_jsonb.sql`);
  apply it (before `add_redeem_deal_scan_rpc.sql`).

---

## Resolved Debt

<!-- Move entries here when fixed, and note the resolution. -->

### [DEBT-006] TypeScript build fails (`expo-image` prop in listView)
- **Resolved 2026-05-29:** changed `onLoadError` → `onError` in
  `components/listView.tsx`. `npx tsc --noEmit` now passes.

### [DEBT-007] Test suite exits non-zero despite passing assertions
- **Resolved 2026-05-29:** rewrote `components/__tests__/StyledText-test.js` to use
  `@testing-library/react-native` instead of raw `react-test-renderer` (the source
  of the teardown `window.dispatchEvent` crash), and extended
  `__mocks__/app/lib/supabase.ts` with `.neq()` + the rest of the PostgREST chain
  and a thenable resolver. `npm test` now exits 0 (5 suites, 28 tests).

### [DEBT-011] Stale/contradictory docs and config references
- **Resolved 2026-05-29:** corrected `docs/architecture.md` migration path,
  reconciled `LAUNCH_CHECKLIST.md`/`docs/configuration.md` with the actual
  `dealish://auth/callback` redirect and the chosen bundle id.

### [DEBT-014] No CI configured
- **Resolved 2026-05-29:** added `.github/workflows/ci.yml` running `npm ci`,
  `npm run typecheck`, and `npm test` on push/PR to `main`.

### [DEBT-015] No `typecheck` npm script
- **Resolved 2026-05-29:** added `"typecheck": "tsc --noEmit"` to `package.json`.
