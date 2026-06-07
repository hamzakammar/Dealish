# On-device test evidence (Android emulator, API 35, Pixel 7)

Captured by driving a headless Android emulator via `adb` against a real
`expo run:android` debug build (BUILD SUCCESSFUL, 36m). The app talked to the
live Supabase project with the publishable key, browsing unauthenticated.

| # | Screenshot | What it proves |
|---|------------|----------------|
| 01 | `01-app-booted-welcome.png` | Native build installs, launches, JS bundle loads (welcome carousel). |
| 02 | `02-map-restaurant-markers.png` | Map renders Google tiles + app restaurant markers (deal `$` badges). |
| 03 | `03-planning-for-live.png` | **#2** FilterPanel "Planning for" renders: Now/day/hour chips, "Showing deals available now". |
| 04 | `04-planning-for-tomorrow-7pm.png` | **#2** Tapping Tomorrow + 7PM highlights both chips and updates label to "Showing deals available Tomorrow at 7PM". |
| 05 | `05-list-with-deal-badges.png` | List view populated; deals render as badges (e.g. "50% Off Pizza", "$10 Classic Margarita"). |
| 06 | `06-q1-test-restaurant-hidden.png` | **#1** Searching "Emporium" returns zero results — John's Food Emporium hidden from anon by RLS. |
| 07 | `07-q3-redeem-screen.png` | **#3** Redeem screen renders with the "for owners & staff only — customers don't need a code" banner. |
| 08 | `08-q3-redeem-rpc-not-signed-in.png` | **#3** Entering a code + Redeem calls the RPC; logged-out path shows "Not signed in" gracefully. |

## Authenticated #3 paths (verified with a confirmed login)
Using a real confirmed account (role started as `user`), driven through the actual UI:

| # | Screenshot | What it proves |
|---|------------|----------------|
| 09 | `09-q3-account-entry-user.png` | Logged-in `user`: account screen shows the "Restaurant owner or staff?" → "Enter admin access code" entry. |
| 10 | `10-q3-redeem-invalid-code-authed.png` | Authenticated bogus code returns **"Invalid code"** (distinct from the logged-out "Not signed in") — auth'd RPC + validation branch. |
| 11 | `11-q3-redeem-success-admin-to-scanner.png` | **Success path**: redeeming a valid `admin` invite flipped role `user`→`admin` (verified server-side, `use_count` 0→1) and routed into `/admin`, which correctly redirects an `admin` (scan-staff) to the QR scanner. |
| 12 | `12-q3-operator-invites-role-selector.png` | Operator "Admin Invites" screen: restaurant picker + Role selector ("Owner (manages restaurant)" vs "Admin (scans QR only)") + Generate button. |
| 13 | `13-q3-operator-code-created.png` | Generating a code works: "Code N4PJJD (admin) for Aera. Valid 14 days, single use." (throwaway code deleted afterward). |
| 14 | `14-q3-account-switch-to-admin-view.png` | With role `admin`, the account screen swaps the entry to "Switch to Admin View" — the other branch of the same conditional. |

Role model confirmed in `app/admin.tsx`: `owner` → full dashboard; `admin` → QR scanner (scan-staff). The redeem RPC only reassigns `restaurants.owner_id` for `owner` invites, so the `admin` test transferred no ownership.

## Also verified (not pictured)
- API: anon GET of the test restaurant returns `[]` (RLS); `redeem_restaurant_invite` + `redeem_deal_scan` RPCs live.
- `tsc` clean; 36/36 jest (8 new real-function time-travel tests); `expo export` bundled 2477 modules.

## Remaining gap (pre-existing code, not part of #3)
The **owner** KPI dashboard itself (Total Sales / Quick Actions) was not screenshotted
because the QA account was given the `admin` role (which routes to the scanner). The
dashboard is verified by reading `app/admin.tsx`; an `owner` login would show it. The
operator entries that live on that dashboard ("Admin Access Codes", "Review Auto-Detected
Deals") were exercised directly via deep link instead.

Known dev-only warning: `app/admin.tsx` calls `router.replace('/qr-scanner')` during
render for `admin`, which triggers a "Cannot update a component during render" LogBox
warning. Harmless in production; should move into a `useEffect`. Pre-existing.
(FIXED 2026-06-05, `3355a17` -- redirect moved into the effect; verified on-device.)

## Android icon check (2026-06-05)
`15-android-list-icons.png`, `16-android-detail-hero.png`. Asked to verify the
recurring "cropped restaurant icons" issue on Android. Checked every customer-facing
image surface on the emulator -- **all render correctly, no cropping reproduced**:
- Map markers: orange `$` bubbles (no image -- can't crop).
- List thumbnails (`expo-image`, `contentFit="cover"`): clean storefront/interior photos.
- Detail-card peek thumbnail (64x64, RN `Image` `cover` in an `overflow:hidden` round
  container): clean.
- Detail-card full hero (`cover`): fills width, no distortion.

Data note: `restaurants.logo_url` / `image_url` columns **do not exist** -- only
`display_image` (185/185, a Google Places photo). So the `logo_url || image_url ||
display_image` fallback in `RestaurantDetailCard.tsx` + `listView.tsx` is dead code that
always resolves to the photo; `cover` is correct for photos. Latent trap: if a real
logo is ever stored, `cover` would crop it (logos want `contain`). No current bug.

## Multi-manager backend (live, post-migration, 2026-06-05)
After `add_restaurant_members.sql` was applied: `restaurant_members` backfilled (184
rows), `redeem_restaurant_invite` live with the new signature (bogus code -> `Invalid
code`), anon still reads active deals (no customer-read regression from the deals-RLS
rescope). QA account confirmed reset (role=user, is_operator=false).
