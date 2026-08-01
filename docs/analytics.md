# Product Analytics (PostHog)

Dealish sends product events to **PostHog**. The integration lives in
[`utils/analytics.ts`](../utils/analytics.ts) — a thin, crash-safe wrapper around
`posthog-react-native`. Events are instrumented explicitly at each call-site
(no autocapture), so the funnel below is exact and free of rerender noise.

## Configuration

Config is read **only from env** — the API key is never hardcoded (mirrors the
`EXPO_PUBLIC_SENTRY_DSN` pattern; a PostHog *project* key is a public,
write-only client key and is safe in an `EXPO_PUBLIC_` var).

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | yes (to enable) | — | PostHog project API key. When unset, **all analytics is a silent no-op** (dev/tests/static-export safe). |
| `EXPO_PUBLIC_POSTHOG_HOST` | no | `https://us.i.posthog.com` | Use `https://eu.i.posthog.com` for EU projects, or a self-hosted host. |

Set these in `.env.local` (dev) and the EAS build environment (prod). No key →
no events; the app behaves identically otherwise.

## Identity & PII

- Users are **identified by their Supabase `user.id`** only, via `identify()` in
  the auth provider on login (`SIGNED_IN` / initial session).
- **Logout resets identity** (`reset()`), so the next user is never merged with
  the previous one.
- **No PII is sent** — no email, phone, or name. The only traits attached are
  non-identifying: an `authenticated` boolean and `user_role` (both registered
  as super-properties and included on every event).

## Events

Every event automatically carries the super-properties `authenticated` (bool)
and, when known, `user_role`. Screen views are tracked separately (see below).

| Event | Fires when | Key properties |
| --- | --- | --- |
| `app_opened` | Once per app launch (root layout mount). | — |
| `first_app_open` | Once per install — first launch only (AsyncStorage flag). **Install/activation proxy** (see below). | — |
| `onboarding_started` | Onboarding screen mounts. | — |
| `onboarding_completed` | Onboarding finished or skipped. | `method`: `completed` \| `skipped` |
| `login_viewed` | Auth screen mounts. | — |
| `login_completed` | Sign-in/sign-up succeeds. | `method`: `email` \| `oauth`; `type`: `signin` \| `signup` (email only) |
| `login_skipped` | User continues into the app as a guest from the welcome carousel. | `source`: `welcome_skip` \| `welcome_get_started` |
| `home_viewed` | Map/home screen mounts. | — |
| `restaurant_list_viewed` | View toggle switches to the list. | `result_count` |
| `restaurant_opened` | Restaurant **detail card opens** (once per open — not on raw marker/list taps, so accidental clicks don't distort the metric). | `restaurant_id`, `restaurant_name`, `city`, `source_screen`, `authenticated` |
| `deal_viewed` | The opened restaurant's deals have loaded and at least one is shown (once per opened restaurant). | `restaurant_id`, `restaurant_name`, `city`, `deal_id` (headline deal when applicable), `deal_count`, `source_screen`, `authenticated` |
| `deal_redeemed` | A merchant successfully scans/redeems a customer's QR. | `restaurant_id`, `deal_title`, `saved_amount`, `redeemed_by_user_id` |
| `search_performed` | Debounced (600 ms) after the query settles — never per keystroke. | `query_length`, `result_count` |
| `filter_applied` | Filters are changed or cleared. | `active_count`, `max_distance`, `min_rating`, `types`, `partner_only`, `has_deals_only` |
| `location_permission_requested` | Just before the OS location prompt. | — |
| `location_permission_granted` | OS returns granted. | — |
| `location_permission_denied` | OS returns anything but granted. | `status` |

### `source_screen` values
`map`, `list`, `search`, `deep_link` (e.g. from the Liked view), `account`.

### Screen tracking
A single deduped listener in the root layout (`usePathname`) sends a PostHog
`$screen` for each distinct route. Deduping on the pathname prevents the
duplicate events that rerenders / navigation focus loops would otherwise cause.

## Downloads vs. actual usage (limitation)

**True App Store / Play Store download counts cannot be read from inside the
app** — those live only in App Store Connect and the Play Console. We therefore
use **`first_app_open` as the install/activation proxy**: it fires exactly once
per install (guarded by an AsyncStorage flag; a reinstall clears storage and
re-activates). This is an *activation* count, not a *download* count — a
download that is never opened is invisible to it, and it slightly undercounts
vs. store downloads. For true download numbers, read the store dashboards (or
wire their reporting APIs server-side) and reconcile against `first_app_open`.

Note on `deal_redeemed`: it is emitted from the **merchant's** scanning device
(redemption is a server-side scan), so the credited customer is recorded as the
`redeemed_by_user_id` **property** rather than as the acting PostHog identity.
For customer-attributed redemption funnels, break down/join on that property (or
ingest redemptions server-side).

## Initial funnels & dashboards to create in PostHog

1. **Activation funnel** — `first_app_open` → `onboarding_started` →
   `onboarding_completed` → (`login_completed` OR `login_skipped`) → `home_viewed`.
   Measures how first-time users get to the map.
2. **Discovery → redemption funnel** — `home_viewed` → `restaurant_opened` →
   `deal_viewed` → `deal_redeemed`. The core value funnel. (Redemption is
   merchant-side; attribute via `redeemed_by_user_id` when analyzing per user.)
3. **Restaurant opens leaderboard** — trends/insight on `restaurant_opened`,
   broken down by `restaurant_name` (or `restaurant_id`), showing **total count**
   and **unique users** (DAU-style). Add `city` as a secondary breakdown.
4. **Authenticated vs. unauthenticated usage** — any event trended and broken
   down by the `authenticated` super-property (e.g. `restaurant_opened`,
   `deal_viewed`); compare engagement of guests vs. signed-in users.
5. **Retention by first app open** — PostHog Retention insight with the start
   event = `first_app_open` and the returning event = `app_opened` (or
   `home_viewed`), showing day-N / week-N retention cohorts.

Supporting insights worth adding: `search_performed` volume + `result_count`
distribution; `filter_applied` by `active_count`; location permission
grant-rate (`location_permission_granted` / `location_permission_requested`);
`login_completed` broken down by `method`.
