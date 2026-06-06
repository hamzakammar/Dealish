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

## Also verified (not pictured)
- API: anon GET of the test restaurant returns `[]` (RLS); `redeem_restaurant_invite` + `redeem_deal_scan` RPCs live.
- `tsc` clean; 36/36 jest (8 new real-function time-travel tests); `expo export` bundled 2477 modules.

## Not testable on-device tonight (login-gated; needs a confirmed session)
Email confirmation is required on this project (`mailer_autoconfirm=false`) and
anonymous sign-in is disabled, so there's no headless way to obtain a session.
The following are verified by bundle + tsc + the live RPC, but their authenticated
UI was not exercised:
- The `/account` "Enter admin access code" entry and "Switch to Admin View" toggle (owner/admin only).
- The redeem **success** path (valid code → role granted → routed to /admin).
- The operator "Admin Access Codes" screen.

To finish these: confirm a signup email (or temporarily toggle off "Confirm email"
in Supabase Auth), then re-run the redeem flow with a seeded invite code.
