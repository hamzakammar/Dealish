# Feature Breakdown

Each feature lists the primary screens, hooks, utils, components, and the database
objects it touches. Database details live in [`database-schema.md`](./database-schema.md).

---

## 1. Auth & session

- **Screens:** `app/auth.tsx`, `app/auth/callback.tsx`, `app/reset-password.tsx`
- **Provider:** `app/providers/auth.tsx` (session + `profiles` row, AsyncStorage key `dealish-auth-token`)
- **Client:** `app/lib/supabase.ts` (singleton, env-driven)
- **Helpers:** `utils/rateLimit.ts` (5 failed attempts / 15 min, client-side), `utils/sendConfirmationEmail.ts`, `app/lib/recoveryState.ts`
- **Components:** `components/PasswordChangeModal.tsx`
- **DB:** `profiles` (auto-created by `handle_new_auth_user()` trigger on signup), `auth.users`
- **Notes:** Email/password + Google + Apple OAuth via Supabase. Recovery flow uses
  a module-level flag to avoid an index-redirect race. Unauthenticated browsing is allowed.

## 2. Map & list discovery

- **Screen:** `app/map.tsx` (map/list toggle)
- **Hooks:** `useRestaurants`, `useUserLocation`, `useRestaurantFilters`,
  `useActiveDealsMap`, `useDirections`
- **Components:** `components/listView.tsx`, `RestaurantMarker.tsx`,
  `RestaurantDetailCard.tsx`, `FilterPanel.tsx`, `MapTypeSelector.tsx`,
  `UserLocationMarker.tsx`, `DirectionsButton.tsx`, `RatingDisplay.tsx`
- **Utils:** `utils/distance.ts`, `utils/geocode.ts`, `utils/navigation.ts`
- **DB:** `restaurants` (public read where `is_active`), `deals` (public read of active)
- **Notes:** Restaurants limited to 500; fallback region is Toronto. Active-deal
  filtering for the map happens in `useActiveDealsMap` (expired out; recurring/one-time
  active-now or starting within 1h; flagged excluded). The list view applies its own
  filtering — keep the two in sync.

## 3. Favourites

- **Components:** `components/AccountPanel.tsx`, `RestaurantDetailCard.tsx`
- **DB:** `profiles.favourites` (`uuid[]`), mutated via RPCs `append_favourite` / `remove_favourite`
- **Notes:** Favourites are an array on the profile, not a join table. Guests are
  prompted to create an account to save favourites.

## 4. QR deal redemption

- **Screens:** `app/qr-scanner.tsx` (scanner), deal QR shown from `components/DealQRCode.tsx`
- **Hooks:** `useDealQRCode`
- **Utils:** `utils/qrCode.ts`, `utils/activity.ts`
- **Components:** `components/QRScanner.tsx`
- **DB:** `deals.qr_code_token`, `qr_code_scans`, `profiles.recents` / `num_visits` / `amount_saved`
- **Flow:** `useDealQRCode` ensures a `qr_code_token` exists, then builds
  `dealish://scan?deal_id=...&token=...&user_id=...`. The owner/admin scanner validates
  and inserts a `qr_code_scans` row, sends a redemption push, and records activity.
- **Important:** There is a separate, **dormant** server-side redemption system
  (`redemptions` table + `mint_redemption`/`verify_redemption` RPCs) the app does
  not use. See [`database-schema.md`](./database-schema.md) critical findings and
  [`debt.md`](./debt.md) (DEBT-001, DEBT-003).

## 5. Account, settings, onboarding

- **Screens:** `app/account.tsx`, `app/settings.tsx`, `app/onboarding.tsx`,
  `app/welcome.tsx`, `app/permissions.tsx`, `app/about.tsx`, `app/help.tsx`
- **Hooks:** `useUserSettings`, `useProfileSetup`, `useThemeColors`, `useAccountNavigation`
- **Utils:** `utils/uploadImage.ts` (avatar upload), `utils/permissions.ts`
- **Components:** `components/RecentActivityCard.tsx`, `Themed.tsx`, `StyledText.tsx`,
  `useColorScheme*.ts`
- **DB:** `profiles.settings` (jsonb: notifications/privacy/appearance), `avatar_url`
- **Notes:** Theme is light/dark/auto. `hasSeenWelcome` / `hasCompletedOnboarding`
  gate the first-run flows.

## 6. Admin / owner dashboard

- **Screens:** `app/admin.tsx`, `app/admin/create-restaurant.tsx`, `app/admin/restaurant.tsx`,
  `app/admin/deals.tsx`, `app/admin/deal-form.tsx`, `app/admin/analytics.tsx`,
  `app/admin/partner-requests.tsx`
- **Hooks:** `useRestaurantDeals`, `usePartnerRequests`
- **Components:** `components/DashboardSidebar.tsx`
- **Utils:** `utils/geocode.ts`, `utils/uploadImage.ts`, `utils/notifications.ts`
- **DB:** `restaurants`, `deals`, `qr_code_scans` (analytics), `partner_requests`, `menu_items` (KPI prices)
- **Notes:** Admins are redirected from `/admin` to `/qr-scanner`. Approving a
  partner request sets `restaurants.partner = true`. Analytics aggregates
  `qr_code_scans` by time range and deal, with CSV export.

## 7. Inventory management

- **Screens:** `app/admin/inventory.tsx` + `app/admin/inventory/{item-form,product-form,scanner,alerts,recommendations}.tsx`
- **Hooks:** `useInventory`, `useProducts`, `useInventoryAlerts`, `useDealRecommendations`
- **Utils:** `utils/generateInventoryAlerts.ts`, `utils/generateRecommendations.ts`,
  `utils/recommendations.ts`, `utils/recommendationThresholds.ts`, `utils/unitConversion.ts`,
  `utils/productDefaults.ts`
- **Components:** `components/BarcodeScanner.tsx`
- **DB:** `products`, `inventory_items`, `inventory_alerts`, `deal_recommendations`,
  `menu_items`, `menu_item_ingredients`, `inventory_sync_logs`, `external_system_credentials`
- **Notes:** Alerts and recommendations derive from `expiration_date` /
  `received_date`. Barcode scanner looks up/creates products.

## 8. Google Sheets / inventory import

- **In-app (current):** `app/admin/integrations.tsx` — paste a **public** Google
  Sheet URL; the app fetches its CSV export, maps columns via header aliases, and
  inserts `products` / `inventory_items`. This path does **not** use edge functions.
- **Server (dormant):** `supabase/functions/sheets-{sync,poll,outbound}` +
  `google-oauth*` + `docs/sheets-integration/dealish-sheets.gs`, backed by
  `api_keys`, `sheet_integrations`, `sheet_synced_rows`, `google_oauth_tokens`.
  See [`edge-functions.md`](./edge-functions.md) and [`debt.md`](./debt.md) (DEBT-010).

## 9. Push notifications

- **Hook:** `usePushNotifications` (registers Expo token → `profiles.push_token`)
- **Util:** `utils/notifications.ts` (sends via edge function; favourite/partner notifications)
- **Edge:** `supabase/functions/send-push-notification`
- **DB:** `profiles.push_token`, `profiles.settings.notifications`
- **Notes:** New-partner notifications are sent from **app code**, not DB triggers
  (the committed trigger migration was never applied — DEBT-004).

## 10. Cross-cutting

- **Error handling:** `components/ErrorBoundary.tsx`, Sentry (gated by DSN)
- **Splash/branding:** `components/splashScreen.tsx`, `scripts/gen_splash.js`
- **Async/util:** `utils/async.ts`
- **Maps native config:** `plugins/withGoogleMaps.js`, `plugins/withEntitlementsModification.js`
- **Seed/maintenance scripts:** `scripts/seed-deals.js`, `scripts/seed_analytics.js`,
  `scripts/refresh-restaurant-photos.js`, `scripts/refresh-restaurant-photos-places.js`
