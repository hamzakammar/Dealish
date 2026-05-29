# Dealish — Live Supabase Database Schema

> **Authoritative.** This is the actual production schema of the Dealish Supabase
> database (project ref `hpsoqjpzebkkxdqapegl`), provided by the repo owner on
> 2026-05-29. Treat this as the source of truth for table/column shape.
>
> **Why this file exists:** the repo's `database/migrations/*.sql` files do **not**
> create the base tables (`profiles`, `restaurants`, `deals`) and several others —
> they assume the tables already exist in the hosted Supabase project. This file
> closes that gap so any agent can reason about the data model without guessing.
>
> **Coverage (updated 2026-05-29):** columns + types + nullability + **defaults**,
> PKs, FKs, **CHECK constraints (enumerations)**, **indexes**, **RLS policies**,
> **triggers**, and **functions/RPCs** (incl. Vault wrappers) — all dumped from
> `public` via `pg_catalog`. Not captured: the `auth.users` trigger that fires
> `handle_new_auth_user()` (lives in the `auth` schema), Storage bucket policies,
> and Vault secret contents.
>
> **If you change the schema, update this file in the same change.**
>
> **READ THIS FIRST → [Critical findings](#critical-findings-verified-against-live-schema--app-code)**
> at the bottom. The live schema contains a dead-code redemption system and an
> always-false security predicate. Don't build on `redemptions` / `is_merchant()`
> without reading that section.

---

## Tables (alphabetical)

### `profiles`
One row per user. `id` matches the Supabase Auth user id. `role` drives routing
(`app/index.tsx`): owners/admins → `/admin`, everyone else → map/onboarding.

| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** (= auth user id) |
| role | text | NOT NULL (`user` / `owner` / `admin`) |
| display_name | text | |
| created_at | timestamptz | NOT NULL |
| favourites | array | restaurant ids; mutated via `append_favourite` / `remove_favourite` RPCs |
| num_visits | bigint | NOT NULL |
| amount_saved | numeric | NOT NULL |
| recents | jsonb | recent activity objects (`utils/activity.ts`); **was `uuid[]` — see DEBT-016, migration `change_recents_to_jsonb.sql`** |
| location | text | |
| avatar_url | text | stored in `avatars` bucket |
| settings | jsonb | notifications/privacy/appearance (`hooks/useUserSettings.ts`) |
| push_token | text | Expo push token |
| push_token_updated_at | timestamp | |

No foreign keys.

### `restaurants`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| owner_id | uuid | NOT NULL → `profiles(id)` |
| name | text | NOT NULL |
| address | text | |
| city | text | |
| lat | double precision | NOT NULL |
| lng | double precision | NOT NULL |
| hero_image_url | text | `restaurant-images` bucket |
| is_active | boolean | NOT NULL (map query filters on this) |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| type | text | cuisine/category |
| display_image | text | |
| rating | real | NOT NULL |
| num_ratings | bigint | NOT NULL |
| partner | boolean | NOT NULL — **the real column is `partner`, not `is_partner`** |
| phone | text | |

FKs: `owner_id → profiles(id)`

### `deals`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| title | text | NOT NULL |
| description | text | |
| tags | array | NOT NULL |
| start_at | timestamptz | |
| end_at | timestamptz | |
| is_active | boolean | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| is_recurring | boolean | |
| recurrence_days | array | |
| recurrence_start_time | time | |
| recurrence_end_time | time | |
| qr_code_token | text | generated on demand (`hooks/useDealQRCode.ts`) |
| qr_code_generated_at | timestamp | |
| discount_type | text | |
| discount_value | numeric | |
| original_price | numeric | |
| is_flagged | boolean | accuracy flagging; filtered out of map/list |

FKs: `restaurant_id → restaurants(id)`

### `redemptions`
Robust redemption record with hashed token + PIN and merchant attribution.
**Note:** this is a more complete redemption model than `qr_code_scans`; both
exist in the live DB. Reconcile which one is authoritative before building on it.

| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| deal_id | uuid | NOT NULL → `deals(id)` |
| user_id | uuid | NOT NULL (the redeeming customer) |
| token_hash | text | NOT NULL |
| pin_hash | text | NOT NULL |
| status | text | NOT NULL |
| issued_at | timestamptz | NOT NULL |
| expires_at | timestamptz | |
| used_at | timestamptz | |
| used_by_merchant_id | uuid | → `profiles(id)` |
| metadata | jsonb | |

FKs: `deal_id → deals(id)`, `used_by_merchant_id → profiles(id)`

### `qr_code_scans`
Scan-event log used by admin analytics (`app/admin/analytics.tsx`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| deal_id | uuid | → `deals(id)` |
| restaurant_id | uuid | → `restaurants(id)` |
| user_id | uuid | → `profiles(id)` (the scanned customer) |
| scanned_at | timestamp | |
| created_at | timestamp | |

FKs: `deal_id → deals(id)`, `restaurant_id → restaurants(id)`, `user_id → profiles(id)`

### `deal_flags`
User thumbs up/down on deals at non-partner venues.

| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| deal_id | uuid | NOT NULL → `deals(id)` |
| user_id | uuid | NOT NULL |
| type | text | NOT NULL (e.g. up/down) |
| created_at | timestamptz | |

FKs: `deal_id → deals(id)`

### `partner_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| user_id | uuid | NOT NULL → `profiles(id)` |
| created_at | timestamp | |
| status | text | approve/reject sets `restaurants.partner` |

FKs: `restaurant_id → restaurants(id)`, `user_id → profiles(id)`

---

## Inventory subsystem

### `products`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| barcode | text | |
| name | text | NOT NULL |
| description | text | |
| category | text | |
| unit | text | NOT NULL |
| base_unit | text | |
| supplier | text | |
| external_product_id | text | |
| external_system | text | |
| image_url | text | |
| created_at | timestamp | |
| updated_at | timestamp | |
| subcategory | text | |
| item_type | text | |

FKs: `restaurant_id → restaurants(id)`

### `inventory_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| product_id | uuid | NOT NULL → `products(id)` |
| quantity | numeric | NOT NULL |
| unit | text | NOT NULL |
| unit_cost | numeric | |
| purchase_date | date | |
| expiration_date | date | drives expiry alerts/recommendations |
| received_date | timestamp | drives slow-moving alerts |
| location | text | |
| batch_number | text | |
| supplier | text | |
| status | text | |
| notes | text | |
| created_at | timestamp | |
| updated_at | timestamp | |

FKs: `product_id → products(id)`, `restaurant_id → restaurants(id)`

### `inventory_alerts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| inventory_item_id | uuid | NOT NULL → `inventory_items(id)` |
| product_id | uuid | NOT NULL → `products(id)` |
| alert_type | text | NOT NULL |
| urgency_score | integer | |
| days_until_expiration | integer | |
| days_since_received | integer | |
| message | text | NOT NULL |
| is_read | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

FKs: `inventory_item_id → inventory_items(id)`, `product_id → products(id)`, `restaurant_id → restaurants(id)`

### `inventory_sync_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| external_system | text | NOT NULL |
| sync_type | text | NOT NULL |
| status | text | NOT NULL |
| items_synced | integer | |
| items_created | integer | |
| items_updated | integer | |
| errors | jsonb | |
| synced_at | timestamp | |
| created_at | timestamp | |

FKs: `restaurant_id → restaurants(id)`

### `external_system_credentials`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| system_type | text | NOT NULL |
| api_key | text | |
| api_secret | text | |
| account_id | text | |
| access_token | text | |
| refresh_token | text | |
| token_expires_at | timestamp | |
| is_active | boolean | |
| last_sync_at | timestamp | |
| sync_schedule | text | |
| created_at | timestamp | |
| updated_at | timestamp | |

FKs: `restaurant_id → restaurants(id)`

---

## Menu + recommendations

### `menu_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| name | text | NOT NULL |
| description | text | |
| category | text | |
| price | numeric | feeds admin KPI averages |
| image_url | text | |
| is_available | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

FKs: `restaurant_id → restaurants(id)`

### `menu_item_ingredients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| menu_item_id | uuid | NOT NULL → `menu_items(id)` |
| product_id | uuid | NOT NULL → `products(id)` |
| quantity | numeric | NOT NULL |
| unit | text | NOT NULL |
| is_required | boolean | |
| created_at | timestamp | |

FKs: `menu_item_id → menu_items(id)`, `product_id → products(id)`

### `deal_recommendations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| inventory_item_id | uuid | → `inventory_items(id)` |
| product_id | uuid | NOT NULL → `products(id)` |
| recommendation_type | text | NOT NULL |
| suggested_title | text | NOT NULL |
| suggested_description | text | |
| suggested_discount_percent | numeric | |
| urgency_score | integer | |
| days_until_expiration | integer | |
| status | text | |
| deal_id | uuid | → `deals(id)` (created deal) |
| created_at | timestamp | |
| updated_at | timestamp | |
| menu_item_id | uuid | → `menu_items(id)` |

FKs: `deal_id → deals(id)`, `inventory_item_id → inventory_items(id)`, `menu_item_id → menu_items(id)`, `product_id → products(id)`, `restaurant_id → restaurants(id)`

---

## Google Sheets / OAuth integration subsystem

> These back the edge functions in `supabase/functions/` (`sheets-sync`,
> `sheets-poll`, `sheets-outbound`, `google-oauth*`). The current in-app
> `app/admin/integrations.tsx` does a simpler public-CSV import and does not
> exercise most of these tables. Treat as partially dormant.

### `api_keys`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| key_hash | text | NOT NULL |
| label | text | NOT NULL |
| last_used_at | timestamptz | |
| created_at | timestamptz | NOT NULL |

FKs: `restaurant_id → restaurants(id)`

### `sheet_integrations`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| sheet_id | text | NOT NULL |
| sheet_tab | text | NOT NULL |
| webhook_url | text | |
| detected_mapping | jsonb | |
| mapping_confirmed | boolean | NOT NULL |
| last_synced_at | timestamptz | |
| created_at | timestamptz | NOT NULL |
| sync_method | text | NOT NULL (`apps_script` / `oauth_cron`) |

FKs: `restaurant_id → restaurants(id)`

### `sheet_synced_rows`
| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| integration_id | uuid | NOT NULL → `sheet_integrations(id)` |
| row_index | integer | NOT NULL |
| deal_id | uuid | → `deals(id)` |
| row_hash | text | |
| last_synced_at | timestamptz | NOT NULL |
| sync_direction | text | NOT NULL |

FKs: `deal_id → deals(id)`, `integration_id → sheet_integrations(id)`

### `google_oauth_tokens`
Token id columns reference Vault-wrapped secrets (see `add_google_oauth_tokens.sql`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | NOT NULL, **PK** |
| user_id | uuid | NOT NULL |
| restaurant_id | uuid | NOT NULL → `restaurants(id)` |
| token_expiry | timestamptz | NOT NULL |
| scope | text | |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| access_token_id | uuid | Vault secret id |
| refresh_token_id | uuid | Vault secret id |

FKs: `restaurant_id → restaurants(id)`

---

## Relationship overview

```
profiles 1──* restaurants (owner_id)
profiles 1──* partner_requests (user_id)
profiles 1──* qr_code_scans (user_id)
profiles 1──* redemptions (used_by_merchant_id)

restaurants 1──* deals
restaurants 1──* products
restaurants 1──* inventory_items
restaurants 1──* menu_items
restaurants 1──* partner_requests
restaurants 1──* api_keys
restaurants 1──* sheet_integrations
restaurants 1──* deal_recommendations / inventory_alerts / inventory_sync_logs / external_system_credentials

deals 1──* qr_code_scans
deals 1──* redemptions
deals 1──* deal_flags
deals 1──* sheet_synced_rows
deals 0/1── deal_recommendations.deal_id

products 1──* inventory_items
products 1──* menu_item_ingredients
menu_items 1──* menu_item_ingredients
inventory_items 1──* inventory_alerts
sheet_integrations 1──* sheet_synced_rows
```

---

## Enumerated values (CHECK constraints)

These columns are plain `text`/`integer` gated by CHECK constraints (there are **no**
Postgres `enum` types). Use these exact values.

| Table.column | Allowed values / rule |
|---|---|
| `profiles.role` | `user`, `owner`, `admin` — **NOTE: `merchant` is NOT allowed** (see findings) |
| `deals.discount_type` | `percent`, `fixed`, `bogo` |
| `deals` (time window) | `start_at < end_at` when both set (`deals_time_window_chk`) |
| `deal_flags.type` | `thumbs_up`, `thumbs_down` |
| `partner_requests.status` | `pending`, `approved`, `rejected` |
| `deal_recommendations.status` | `pending`, `approved`, `rejected`, `created`, `dismissed` |
| `deal_recommendations.recommendation_type` | `flash_sale`, `clearance`, `bundle`, `custom` |
| `deal_recommendations.urgency_score` / `suggested_discount_percent` | `0..100` |
| `inventory_items.status` | `active`, `expired`, `sold`, `wasted`, `low_stock` |
| `inventory_items.quantity` / `unit_cost` | `>= 0` |
| `inventory_alerts.alert_type` | `expiring_soon`, `expiring_today`, `expired`, `slow_moving` |
| `inventory_alerts.urgency_score` | `0..100` |
| `inventory_sync_logs.external_system` | `marketman`, `restaurant365`, `oracle_simphony` |
| `inventory_sync_logs.sync_type` | `manual`, `scheduled`, `webhook` |
| `inventory_sync_logs.status` | `success`, `failed`, `partial` |
| `external_system_credentials.system_type` | `marketman`, `restaurant365`, `oracle_simphony` |
| `menu_items.price` / `menu_item_ingredients.quantity` | `>= 0` |
| `redemptions.status` | `issued`, `used`, `expired`, `revoked` |
| `restaurants.lat` / `lng` | `-90..90` / `-180..180` |

Notable **UNIQUE** constraints: `deals.qr_code_token`, `deal_flags(deal_id,user_id)`,
`partner_requests(restaurant_id,user_id)`, `products(restaurant_id,barcode)`,
`api_keys.key_hash`, `menu_item_ingredients(menu_item_id,product_id)`,
`external_system_credentials(restaurant_id,system_type)`,
`google_oauth_tokens(user_id,restaurant_id)`, `sheet_integrations(restaurant_id,sheet_id)`,
`sheet_synced_rows(integration_id,row_index)`.

Notable **defaults**: most ids `gen_random_uuid()`; `deals.is_active=true`,
`deals.is_recurring=false`, `deals.is_flagged=false`, `deals.tags='{}'`;
`restaurants.is_active=true`, `restaurants.partner=false`,
`restaurants.rating=0`, `restaurants.num_ratings=0`;
`profiles.num_visits=0`, `profiles.amount_saved=0`, `profiles.settings='{}'`;
`redemptions.status='issued'`; `*_status`/`*_type` defaults `'pending'`/`'apps_script'` etc.
**`restaurants.owner_id` defaults to a hardcoded UUID** — see findings.

---

## Foreign-key targets worth noting

Some user references point at `auth.users`, **not** `profiles`:

- `profiles.id → auth.users(id)` ON DELETE CASCADE
- `deal_flags.user_id → auth.users(id)` ON DELETE CASCADE
- `redemptions.user_id → auth.users(id)` ON DELETE CASCADE
- `google_oauth_tokens.user_id → auth.users(id)` ON DELETE CASCADE
- `restaurants.owner_id → profiles(id)` **ON DELETE RESTRICT** (can't delete a profile that owns restaurants)
- `partner_requests.user_id → profiles(id)`, `qr_code_scans.user_id → profiles(id)`, `redemptions.used_by_merchant_id → profiles(id)`

Most other FKs are `ON DELETE CASCADE`; `sheet_synced_rows.deal_id` is `ON DELETE SET NULL`.

---

## Functions / RPCs (`public`)

| Function | Lang / security | Purpose |
|---|---|---|
| `append_favourite(p_profile_id uuid, p_restaurant_id uuid)` | sql, SECURITY DEFINER | Appends restaurant id to `profiles.favourites`. Called from `RestaurantDetailCard.tsx`. |
| `remove_favourite(p_profile_id uuid, p_restaurant_id uuid)` | sql, SECURITY DEFINER | `array_remove` from `profiles.favourites`. |
| `is_deal_active_now(d deals)` | sql STABLE | `is_active AND start_at<=now() AND end_at>=now()`. Used by RLS `deals_public_read_active_now`. |
| `is_merchant()` | sql STABLE | Originally `role='merchant'` (always FALSE). **Fixed** to `role IN ('owner','admin')` — `fix_is_merchant_role.sql` (DEBT-001). |
| `redeem_deal_scan(p_deal_id, p_token, p_user_id)` | plpgsql, SECURITY DEFINER | **Added** (`add_redeem_deal_scan_rpc.sql`, DEBT-003). Merchant-device redemption: validates token/active/ownership, inserts `qr_code_scans`, credits the **customer's** visit/savings/recents. Called by `app/qr-scanner.tsx`. |
| `mint_redemption(p_deal_id uuid)` | plpgsql, SECURITY DEFINER | Issues a `redemptions` row: random token + 4-digit PIN (both sha256-hashed), 20-min expiry, **1/day per user/deal** rate limit. Requires auth, deal active, restaurant active. **Not called by app.** |
| `verify_redemption(p_token_or_pin text)` | plpgsql, SECURITY DEFINER | Merchant marks a redemption `used`. **Requires `is_merchant()` → always fails.** **Not called by app.** |
| `check_deal_accuracy()` | plpgsql trigger | On `deal_flags` change, sets `deals.is_flagged = (down>=5 AND down>up)`. |
| `set_updated_at()` / `update_updated_at_column()` | plpgsql trigger | Touch `updated_at`. |
| `handle_new_auth_user()` | plpgsql, SECURITY DEFINER | Inserts `profiles(id, role='user')` on new auth user (fired by an `auth.users` trigger not shown here). |
| `create_oauth_secret` / `read_oauth_secret` / `update_oauth_secret` | plpgsql, SECURITY DEFINER, `search_path=public,vault` | Thin wrappers over `vault.*` for Google OAuth token storage. |

---

## Triggers (`public`)

| Table | Trigger | When | Function |
|---|---|---|---|
| `deal_flags` | `deal_accuracy_check` | AFTER INSERT/UPDATE/DELETE | `check_deal_accuracy()` |
| `deals` | `deals_set_updated_at` | BEFORE UPDATE | `set_updated_at()` |
| `restaurants` | `restaurants_set_updated_at` | BEFORE UPDATE | `set_updated_at()` |
| `deal_recommendations` | `update_deal_recommendations_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `external_system_credentials` | `update_external_system_credentials_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `inventory_items` | `update_inventory_items_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |
| `products` | `update_products_updated_at` | BEFORE UPDATE | `update_updated_at_column()` |

**There are NO notification triggers in production** (none on `restaurants` except
`set_updated_at`). The repo's `database/migrations/add_notification_triggers.sql`
(which references `is_partner` + `net.http_post`) was **never applied** — see findings.

---

## RLS policies (summary)

RLS is **enabled** on every `public` table (force=off). Policies are permissive
(OR'd), so overlapping policies *widen* access. Highlights:

- **Public read (anon + authenticated):**
  - `restaurants`: `is_active = true`.
  - `deals`: **two** SELECT policies — `deals_public_read_active_now`
    (`is_deal_active_now(deals) AND restaurant active`) **and** the legacy
    `Public can view active deals` (`is_active = true`). Because they're OR'd, the
    **legacy one wins** and schedule gating is effectively bypassed (see findings).
  - `menu_items`: `is_available = true`.
- **Owner/admin management** (the working path): most tables have
  `Restaurant owners can {view,insert,update,delete} ...` policies keyed on
  `restaurants.owner_id = auth.uid()` **OR** `profiles.role IN ('admin','owner')`.
- **`*_merchant_*` policies** on `deals`/`restaurants`/`redemptions` are keyed on
  `is_merchant()` → **dead** (always false), but harmless because the owner/admin
  policies above grant the same access.
- **User-scoped:** `profiles` (`id = auth.uid()` for select/update — note: **no
  INSERT policy**; rows are created by `handle_new_auth_user`), `deal_flags`
  (own rows; admins can read all), `partner_requests` (own rows; owners/admins
  read for their restaurants), `qr_code_scans` (insert own; owners/admins read).
- **Service/owner secrets:** `google_oauth_tokens` (`user_id = auth.uid()`, plus
  `service_role` read), `api_keys`/`sheet_integrations`/`sheet_synced_rows`
  (owner-scoped via restaurant ownership).

---

## Indexes (highlights)

Every table has its PK btree + the UNIQUE indexes listed above. Performance-relevant extras:

- `deals`: `deals_active_window_idx (is_active, start_at, end_at)`, `deals_restaurant_id_idx`, `deals_tags_gin_idx` (GIN on tags), `idx_deals_qr_code_token`.
- `restaurants`: `restaurants_is_active_idx`, `restaurants_owner_id_idx`.
- `redemptions`: composite indexes on `(user_id,deal_id,issued_at)`, `(user_id,issued_at)`, `(status,expires_at)`, `(used_by_merchant_id,used_at)`.
- `qr_code_scans`: per-FK indexes + `idx_qr_scans_scanned_at`.
- `inventory_items`: partial `idx_inventory_items_expiring_soon (restaurant_id, expiration_date, status) WHERE expiration_date IS NOT NULL AND status='active'`.
- `deal_recommendations`: partial `idx_recommendations_urgency_score (urgency_score DESC) WHERE status='pending'`.
- `profiles`: `idx_profiles_settings` GIN on `settings`, partial `idx_profiles_push_token WHERE push_token IS NOT NULL`.
- Many partial indexes (`WHERE col IS NOT NULL`) on products/menu_items/credentials.

---

## Critical findings (verified against live schema + app code)

Strongest first. Items 1–3 are latent bugs / dead code, verified by grepping the
app: it never references `merchant`, `mint_redemption`, `verify_redemption`, or
`redemptions`.

1. **`is_merchant()` can never return true → the entire `redemptions` system is
   dead.** `is_merchant()` checks `role = 'merchant'`, but `profiles_role_check`
   only permits `user`/`owner`/`admin`. Therefore:
   - `verify_redemption()` always returns `Not a merchant` — merchants could never
     redeem via this RPC even if the app called it.
   - All `*_merchant_*` RLS policies are inert (harmless; legacy owner/admin
     policies cover the same access).
   - `mint_redemption()` + `redemptions` + the secure token/PIN design are unused
     by the app, which instead uses the `dealish://scan?...` token + `qr_code_scans`
     path. **Decision needed:** either (a) adopt the `redemptions` RPCs and add a
     `merchant` role (or change `is_merchant()` to accept `owner`/`admin`), or
     (b) delete the dead redemption machinery. Don't half-adopt it.

2. **Deal schedule gating is bypassed by overlapping RLS.** The intended
   time-window policy `deals_public_read_active_now` (via `is_deal_active_now`)
   coexists with the looser legacy `Public can view active deals` (`is_active=true`).
   Permissive policies are OR'd, so any `is_active=true` deal is publicly readable
   **regardless of `start_at`/`end_at`**. The app re-filters by time client-side
   (`hooks/useActiveDealsMap.ts`), so the UI looks correct, but the DB does not
   enforce it. Drop the legacy policy if server-side gating is intended.

3. **Two redemption paths, app uses the weaker one.** `qr_code_scans` (plain scan
   log, app-used) vs `redemptions` (sha256 token+PIN, 20-min expiry, 1/day rate
   limit, dormant). The secure design exists in the DB but is unreachable. The
   earlier-flagged QR scan attribution bug in `app/qr-scanner.tsx`/`utils/activity.ts`
   lives entirely in the `qr_code_scans` path.

4. **The committed notification-trigger migration was never applied.** Production
   has no triggers on `restaurants` beyond `set_updated_at`, and no `is_partner`
   column. `database/migrations/add_notification_triggers.sql` is stale/aspirational;
   new-partner push notifications are **not** firing from the DB. (Push is sent from
   app code via `utils/notifications.ts` instead.)

5. **`restaurants.owner_id` defaults to a hardcoded UUID**
   (`41995df0-4f14-421c-a481-5e0a62fb96d1`). Any insert omitting `owner_id` silently
   assigns that account. The working INSERT policy requires `auth.uid() = owner_id`,
   so for everyone else the default just produces an RLS failure rather than a
   mis-owned row — but it's a footgun and should be dropped.

6. **`favourites` / `recents` are `uuid[]` columns on `profiles`, not tables.**
   `append_favourite` / `remove_favourite` mutate `favourites`. Confirmed present
   in the live DB (definitions above); not in repo migrations.

7. **`restaurants.partner` is the real column** (app code is correct). The stale
   `is_partner` reference only exists in the unapplied notification migration
   (finding 4).

8. **Base tables remain hosted-only.** `profiles`, `restaurants`, `deals`,
   `redemptions` had no `CREATE TABLE` migration. **Resolved (DEBT-012):**
   `database/schema_base.sql` now reconstructs the base tables + hosted-only
   functions/triggers/RLS (`menu_items`/`menu_item_ingredients` already have
   migrations). Validate against a scratch project before production use.

9. **`recents` is now `jsonb` (DEBT-016).** The live column was `uuid[]` but the
   app stores activity objects, so the write path was silently failing.
   `change_recents_to_jsonb.sql` converts it; apply before `add_redeem_deal_scan_rpc.sql`.

### Remediation note (2026-05-29)

Many findings above have repo fixes that must be **applied to Supabase**:
`change_recents_to_jsonb.sql`, `fix_is_merchant_role.sql`, `add_redeem_deal_scan_rpc.sql`,
`drop_redundant_deals_select_policy.sql`, `drop_restaurants_owner_id_default.sql`,
`setup_restaurant_images_storage.sql`. See `docs/debt.md` for the status table.
