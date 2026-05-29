# Routing Map (Expo Router)

Routing is file-based via `expo-router`. Files in `app/` become routes; the stack
is declared in `app/_layout.tsx`. The URL scheme is `dealish://` (see
[`configuration.md`](./configuration.md)).

## Conventions

- `app/_layout.tsx` — root layout: Sentry init, font loading, `AuthProvider`,
  theme provider, notification handler, `<Stack>` declaration, deep-link listener.
- `app/index.tsx` — startup router; decides where to send you based on auth state,
  role, onboarding/welcome flags, and recovery deep links.
- `+html.tsx`, `+not-found.tsx` — Expo Router special files (web HTML shell, 404).
- `app/lib/` and `app/providers/` are **not routes** (helpers/context colocated
  under `app/`).

## Top-level routes

| Route | File | Purpose | Auth |
|---|---|---|---|
| `/` | `app/index.tsx` | Startup router / redirect hub | any |
| `/welcome` | `app/welcome.tsx` | First-run carousel (gated by `hasSeenWelcome`) | guest ok |
| `/onboarding` | `app/onboarding.tsx` | Profile setup (gated by `hasCompletedOnboarding`) | signed-in |
| `/permissions` | `app/permissions.tsx` | Location/notification permission priming | any |
| `/auth` | `app/auth.tsx` | Sign in / sign up (email + Google + Apple) | guest |
| `/auth/callback` | `app/auth/callback.tsx` | OAuth + password-recovery deep-link landing | any |
| `/reset-password` | `app/reset-password.tsx` | Set new password after recovery | recovery |
| `/map` | `app/map.tsx` | Main map + list discovery surface | guest ok |
| `/account` | `app/account.tsx` | Profile, stats, recent activity | signed-in |
| `/settings` | `app/settings.tsx` | Notifications / privacy / appearance | signed-in |
| `/partner` | `app/partner.tsx` | "Partner with us" marketing/contact | any |
| `/about` | `app/about.tsx` | About the app | any |
| `/help` | `app/help.tsx` | FAQ / help | any |
| `/qr-scanner` | `app/qr-scanner.tsx` | Redemption scanner (admins routed here) | owner/admin |

## Admin / owner console

| Route | File | Purpose |
|---|---|---|
| `/admin` | `app/admin.tsx` | Dashboard home (KPIs, restaurant list); admins are redirected to `/qr-scanner` |
| `/admin/create-restaurant` | `app/admin/create-restaurant.tsx` | Create a restaurant |
| `/admin/restaurant` | `app/admin/restaurant.tsx` | Edit a restaurant (geocode, image upload) |
| `/admin/deals` | `app/admin/deals.tsx` | List/manage a restaurant's deals |
| `/admin/deal-form` | `app/admin/deal-form.tsx` | Create/edit a deal (recurrence, discount, tags) |
| `/admin/analytics` | `app/admin/analytics.tsx` | QR redemption analytics + CSV export |
| `/admin/integrations` | `app/admin/integrations.tsx` | Google Sheet (public CSV) bulk import for inventory |
| `/admin/partner-requests` | `app/admin/partner-requests.tsx` | Approve/reject partner requests |

### Inventory subsection

| Route | File | Purpose |
|---|---|---|
| `/admin/inventory` | `app/admin/inventory.tsx` | Inventory home (items + products) |
| `/admin/inventory/item-form` | `app/admin/inventory/item-form.tsx` | Add/edit an inventory item (stock) |
| `/admin/inventory/product-form` | `app/admin/inventory/product-form.tsx` | Add/edit a product (catalog entry) |
| `/admin/inventory/scanner` | `app/admin/inventory/scanner.tsx` | Barcode scanner to look up/add products |
| `/admin/inventory/alerts` | `app/admin/inventory/alerts.tsx` | Expiry / slow-moving alerts |
| `/admin/inventory/recommendations` | `app/admin/inventory/recommendations.tsx` | Deal recommendations from at-risk inventory |

## Startup routing logic (`app/index.tsx`)

Order of decisions (simplified):
1. If opened via a **password-recovery** deep link (flag in `app/lib/recoveryState.ts`),
   allow navigation to `/reset-password`.
2. If signed in and `role` is `owner`/`admin` → `/admin`.
3. If signed in as a regular user → `/onboarding` (if incomplete) else `/map`.
4. If guest → `/welcome` (first run) then `/map`.

Deep links handled in `app/_layout.tsx` include OAuth/recovery callbacks
(`dealish://auth/callback`) and the QR scan payload (`dealish://scan?...`). Note:
`dealish://oauth-google-sheets` is emitted by an edge function but has **no app
handler** — see [`debt.md`](./debt.md).
