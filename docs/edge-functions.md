# Supabase Edge Functions (Deno)

Located in `supabase/functions/`. These run server-side logic that must not run on
the client (secrets, webhooks, OAuth token exchange, push fan-out). They are
deployed with the Supabase CLI (`supabase functions deploy <name>`).

> **Note:** `supabase/migrations/` does **not** exist in this repo despite some docs
> referencing it; SQL migrations live in `database/migrations/`. Edge functions are
> the only thing under `supabase/` besides `.temp/`.

## Functions

| Function | JWT | Purpose | Key env |
|---|---|---|---|
| `send-confirmation-email` | verify | Send welcome/confirmation email via Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| `send-push-notification` | verify | Look up a user's `push_token` and send an Expo push | `SUPABASE_SERVICE_ROLE_KEY` |
| `places` | verify | Google Places proxy (New API v1): `autocomplete` / `details` / `geocode` → `{lat,lng,address,name,rating,userRatingCount}` | `GOOGLE_MAPS_API_KEY` (Places API enabled) |
| `sheets-sync` | api-key | Apps Script endpoint: detect schema / sync / confirm mapping | `SUPABASE_SERVICE_ROLE_KEY` |
| `sheets-poll` | service | Cron/OAuth poll of Google Sheets → upsert deals | `SUPABASE_SERVICE_ROLE_KEY`, Google creds |
| `sheets-outbound` | service | DB webhook → push changes out to Apps Script | `SUPABASE_SERVICE_ROLE_KEY` |
| `google-oauth` | verify | Exchange Google OAuth code, store tokens Vault-wrapped | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `google-oauth-redirect` | `--no-verify-jwt` | HTTPS callback relay → `dealish://oauth-google-sheets?code=...` | — |

Common env (all functions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Active vs dormant

- **Active / used by the app:**
  - `send-push-notification` — invoked from `utils/notifications.ts`.
  - `send-confirmation-email` — invoked from `utils/sendConfirmationEmail.ts`
    (has a unit test in `__tests__/sendConfirmationEmail.test.ts`).
  - `places` — invoked from `utils/places.ts` (used by `app/admin/create-restaurant.tsx`
    and `app/admin/restaurant.tsx` for address autocomplete, coordinates, and
    Google rating/review counts). Deploy: `supabase secrets set GOOGLE_MAPS_API_KEY=…`
    then `supabase functions deploy places`. Replaces the previous client-side
    Nominatim autocomplete (kept only as a geocode fallback).
- **Dormant (no in-app caller found):**
  - `sheets-sync`, `sheets-poll`, `sheets-outbound`, `google-oauth`,
    `google-oauth-redirect`. These belong to the older bidirectional Sheets sync.
    The current Sheets UI (`app/admin/integrations.tsx`) bypasses them with a
    direct public-CSV import. See [`debt.md`](./debt.md) (DEBT-010).

## Data they touch

- Sheets functions: `api_keys`, `sheet_integrations`, `sheet_synced_rows`, `deals`.
- OAuth functions: `google_oauth_tokens` (+ Vault via `create/read/update_oauth_secret`).
- Push: `profiles.push_token`.
- The `sheets-poll` function filters integrations by `sync_method = 'oauth_cron'`.

## Deploying

```bash
supabase functions deploy send-push-notification
supabase functions deploy google-oauth-redirect --no-verify-jwt
# set secrets:
supabase secrets set RESEND_API_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
```

Set secrets in the Supabase project, not in source. The cron schedule for
`sheets-poll` is configured in the Supabase dashboard (an example `cron.schedule`
call is commented in `database/migrations/add_google_oauth_tokens.sql`).
