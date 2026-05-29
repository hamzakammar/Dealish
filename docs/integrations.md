# External Integrations

Every third-party service Dealish depends on, what it's used for, and how it's
configured. Env var details are in [`configuration.md`](./configuration.md).

| Service | Used for | Config | Code entry points |
|---|---|---|---|
| **Supabase** | Auth, Postgres, Storage, Edge Functions | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `app/lib/supabase.ts`, all hooks |
| **Google Maps** | Native map rendering | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `plugins/withGoogleMaps.js` | `app/map.tsx`, `react-native-maps` |
| **OpenRouteService (ORS)** | Driving directions / route polylines | `EXPO_PUBLIC_ORS_API_KEY` | `hooks/useDirections.ts` |
| **Expo Push** | Push notifications | Expo project (`extra.eas.projectId`) | `hooks/usePushNotifications.ts`, `utils/notifications.ts`, `send-push-notification` |
| **Google OAuth + Sheets API** | (dormant) bidirectional sheet sync | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (edge) | `google-oauth`, `google-oauth-redirect`, `sheets-poll` |
| **Resend** | Transactional email (confirmation/welcome) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (edge) | `send-confirmation-email`, `utils/sendConfirmationEmail.ts` |
| **Sentry** | Crash/error reporting | `EXPO_PUBLIC_SENTRY_DSN` (optional) | `app/_layout.tsx` |

## Supabase

The single backend. Client is a singleton in `app/lib/supabase.ts`, configured from
`EXPO_PUBLIC_*` env vars with placeholder fallbacks so static web export doesn't crash.
Auth tokens persist in AsyncStorage (`dealish-auth-token`). RLS enforces access; see
[`database-schema.md`](./database-schema.md).

**Storage buckets:**
- `avatars` — user avatars (migration `setup_avatars_storage.sql` exists).
- `restaurant-images` — restaurant hero/display images (used by `utils/uploadImage.ts`
  and the photo scripts, but **no migration/policy is in the repo** — DEBT-009).

## Google Maps

Rendered via `react-native-maps`. The API key is injected into native config by the
config plugin `plugins/withGoogleMaps.js` from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
`MapTypeSelector` switches map types. Geocoding of addresses (admin restaurant form)
goes through `utils/geocode.ts`.

## OpenRouteService

`hooks/useDirections.ts` calls the ORS directions API and decodes the route with
`@mapbox/polyline`. The feature **self-disables** if `EXPO_PUBLIC_ORS_API_KEY` is
unset (logs a warning, shows an alert when invoked) — directions are optional.

## Push notifications

`usePushNotifications` registers the device and stores the Expo token in
`profiles.push_token`. Sending is done server-side by the `send-push-notification`
edge function, called from `utils/notifications.ts`. User preferences live in
`profiles.settings.notifications` (e.g. `favorites`). New-partner notifications are
sent from app code — there is no DB trigger for this in production (DEBT-004).

## Google OAuth + Sheets API (dormant)

A full OAuth + cron-poll sheet sync exists server-side (`google-oauth`,
`google-oauth-redirect`, `sheets-poll`) with tokens stored Vault-wrapped
(`google_oauth_tokens` + `create/read/update_oauth_secret` RPCs). The app's current
Sheets UI (`app/admin/integrations.tsx`) instead does a simple public-CSV import and
does not exercise this path. There is also no app handler for the
`dealish://oauth-google-sheets` deep link the redirect function emits. Treat as
dormant until revived or removed (DEBT-010).

## Resend

The `send-confirmation-email` edge function sends welcome/confirmation email via
Resend. Invoked from `utils/sendConfirmationEmail.ts`. Requires `RESEND_API_KEY`
and `RESEND_FROM_EMAIL` in the edge environment.

## Sentry

Initialized in `app/_layout.tsx` only when `EXPO_PUBLIC_SENTRY_DSN` is set, so local
dev and CI run without it.
