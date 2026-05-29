# Configuration, Environment & Build

## Environment variables

`EXPO_PUBLIC_*` vars are embedded in the client bundle (public, not secret). They
live in `.env.local` (gitignored) and are read via `process.env.EXPO_PUBLIC_*`.
Edge-function secrets are set in the Supabase project, never in source.

### Client (app)

| Var | Required | Used by | Notes |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | `app/lib/supabase.ts` | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | `app/lib/supabase.ts` | Anon key (RLS-gated) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | yes (maps) | `plugins/withGoogleMaps.js` | Native map rendering |
| `EXPO_PUBLIC_ORS_API_KEY` | optional | `hooks/useDirections.ts` | Directions self-disable if unset |
| `EXPO_PUBLIC_SENTRY_DSN` | optional | `app/_layout.tsx` | Sentry off if unset |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | see note | referenced in `LAUNCH_CHECKLIST.md` | Code hardcodes `dealish://auth/callback`; this var may be stale (DEBT-011) |

### Edge functions (Supabase secrets)

| Var | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all functions |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `send-confirmation-email` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `google-oauth`, `sheets-poll` |

## App identity & build (`app.json`)

| Field | Value |
|---|---|
| `expo.version` | `1.5` |
| `expo.ios.bundleIdentifier` | `com.anonymous.Dealish` |
| `expo.android.package` | `com.anonymous.Dealish` |
| `expo.android.versionCode` | `40` |
| `expo.scheme` | `dealish` |
| `expo.extra.eas.projectId` | `c8d4d9ee-1ec9-4e2c-a60f-fa51168853fe` |
| `expo.runtimeVersion` | `{ policy: "appVersion" }` |

**Identifier mismatches (DEBT-008):**
- `package.json` version is `1.0.3` while `app.json` is `1.5`.
- `LAUNCH_READY.md` claims bundle IDs were changed to `ca.hamzaammar.dealish`, but
  `app.json` still has `com.anonymous.Dealish`.
- `apple-app-site-association` declares appID `8DWMM7XN54.ca.hamzaammar.dealish` —
  inconsistent with the `com.anonymous.Dealish` bundle ID. This affects universal
  links, Apple Sign-In, and App Store submission. Reconcile before release.

## EAS (`eas.json`)

Build/submit profiles for EAS. The Expo project is identified by
`extra.eas.projectId`. `runtimeVersion` follows `appVersion`, so OTA update
compatibility is tied to `app.json`'s `version`.

## Config plugins (`plugins/`)

- `withGoogleMaps.js` — injects the Google Maps API key into native iOS/Android config.
- `withEntitlementsModification.js` — adjusts iOS entitlements (e.g. associated domains).

## TypeScript (`tsconfig.json`)

- `strict` mode, path alias `@/*` → repo root.
- Excludes `supabase/functions` (Deno, separate runtime).
- There is **no `typecheck` npm script** — run `npx tsc --noEmit` directly. It
  currently reports 1 error (DEBT-006).

## Scripts (`package.json`)

| Script | Command |
|---|---|
| `start` | `expo start` |
| `ios` / `android` | `expo run:ios` / `expo run:android` |
| `web` | `expo start --web` |
| `test` / `test:watch` / `test:coverage` | `jest` variants |

There is no CI configuration in the repo (no `.github/workflows`) — DEBT-014.

## Local setup

```bash
npm install            # or: npm ci
# create .env.local with the EXPO_PUBLIC_* vars above
npx expo start         # dev server
npm test               # unit tests (see testing.md for current state)
npx tsc --noEmit       # type check
```
