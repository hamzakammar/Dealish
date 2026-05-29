# Dealish — Product Overview

## What it is

Dealish is a mobile app (Expo / React Native, iOS + Android, with a web export
target) for discovering restaurant deals nearby and redeeming them in person. It
also ships an owner/admin console for restaurants to publish deals, manage
inventory, and see redemption analytics. The backend is entirely Supabase
(Auth, Postgres, Storage, Edge Functions) — there is no separate API server.

## Who uses it

| Persona | `profiles.role` | What they do |
|---|---|---|
| **Diner / guest** | `user` (or unauthenticated) | Browse the map/list, filter, favourite, view deals, redeem via QR |
| **Restaurant owner** | `owner` | Manage their restaurants, deals, inventory, view analytics, handle partner requests |
| **Admin** | `admin` | Same as owner plus cross-restaurant access; routed to the QR scanner to redeem |

Unauthenticated browsing is intentional (App Store compliance): a guest can open
the app and explore the map without an account. Account creation is required to
favourite, redeem, and track savings.

## Core loops

### Diner loop
1. Open app → (first run) welcome carousel → map.
2. Map shows active-deal restaurants near you; filter by distance, rating, cuisine,
   partner status, has-active-deals.
3. Tap a restaurant → detail sheet with its deals, directions, favourite toggle.
4. Open a deal → QR code → show it at the restaurant to redeem.
5. Account screen tracks visits, amount saved, and recent activity.

### Owner loop
1. Sign in as `owner` → admin dashboard.
2. Create/edit restaurants (geocode address, upload images).
3. Create/edit deals (one-time or recurring, discount type/value, tags).
4. Manage inventory (products + stock), receive expiry / slow-moving alerts, and
   get auto-generated deal recommendations from at-risk inventory.
5. View QR redemption analytics; approve/reject partner requests.

### Admin redemption loop
1. Sign in as `admin` → routed to QR scanner.
2. Scan a diner's deal QR code → records a scan and notifies the diner.

## Where things live (one-liner)

- **Screens:** `app/` (Expo Router, file-based)
- **Shared UI:** `components/`
- **Data/side-effects:** `hooks/`
- **Pure helpers:** `utils/`
- **Domain types:** `types/`
- **DB changes:** `database/migrations/` (note: base tables are hosted-only)
- **Server logic:** `supabase/functions/` (Deno)

See [`architecture.md`](./architecture.md) and [`features.md`](./features.md) for detail.

## Status snapshot (2026-05-29)

- App version (`app.json`): `1.5`; package version (`package.json`): `1.0.3` (mismatch).
- Pre-launch audit docs exist (`LAUNCH_CHECKLIST.md`, `LAUNCH_READY.md`) but are
  partly stale; see [`debt.md`](./debt.md).
- `npx tsc --noEmit` currently fails (1 error); `npm test` asserts pass but the
  process exits non-zero. Tracked in [`debt.md`](./debt.md) and [`testing.md`](./testing.md).
