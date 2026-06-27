# Dealish Database Schema Documentation

**Last Updated:** 2026-06-23  
**Database:** Supabase (PostgreSQL)  
**Project:** Dealish - Restaurant Deals & Inventory Management Platform

---

## Table of Contents
1. [Core Tables](#core-tables)
2. [Inventory Management](#inventory-management)
3. [Deal Management](#deal-management)
4. [User & Authentication](#user--authentication)
5. [Restaurant Management](#restaurant-management)
6. [Integration Tables](#integration-tables)
7. [Analytics & Tracking](#analytics--tracking)
8. [Indexes & Performance](#indexes--performance)
9. [Row Level Security (RLS)](#row-level-security-rls)

---

## Core Tables

### `profiles`
User profile information extending Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | References auth.users(id) |
| `email` | TEXT | | User email |
| `role` | TEXT | DEFAULT 'user' | 'user', 'admin', 'owner' |
| `is_operator` | BOOLEAN | DEFAULT false | Platform operator (founder/staff) with god-mode |
| `first_name` | TEXT | | |
| `last_name` | TEXT | | |
| `phone` | TEXT | | |
| `num_visits` | INTEGER | DEFAULT 0 | Total redemptions |
| `amount_saved` | NUMERIC | DEFAULT 0 | Total savings ($) |
| `recents` | JSONB | DEFAULT '[]' | Recent activity log |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Key Features:**
- `is_operator`: Platform operators can manage any restaurant
- `recents`: Stores recent activity as JSONB array
- Trigger prevents self-escalation of `role` and `is_operator`

---

### `restaurants`
Restaurant/merchant locations and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `owner_id` | UUID | REFERENCES profiles(id) | Primary owner (legacy) |
| `name` | TEXT | NOT NULL | Restaurant name |
| `description` | TEXT | | |
| `address` | TEXT | | Full address |
| `lat` | NUMERIC | | Latitude |
| `lng` | NUMERIC | | Longitude |
| `phone` | TEXT | | Contact phone |
| `email` | TEXT | | Contact email |
| `website_url` | TEXT | | Restaurant website |
| `google_place_id` | TEXT | | Google Places ID |
| `type` | TEXT | | 'restaurant', 'cafe', 'bar', etc. |
| `partner` | BOOLEAN | DEFAULT false | Official partner status |
| `is_active` | BOOLEAN | DEFAULT true | Active on platform |
| `hero_image_url` | TEXT | | Header/banner image |
| `display_image` | TEXT | | Thumbnail/card image |
| `rating` | NUMERIC | | Average rating |
| `num_ratings` | INTEGER | DEFAULT 0 | Total ratings count |
| `deals_last_crawled_at` | TIMESTAMPTZ | | Last scrape timestamp |
| `deals_scrape_opt_out` | BOOLEAN | DEFAULT false | Opt-out of auto-scraping |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Key Features:**
- `owner_id`: Legacy "primary owner" pointer (use `restaurant_members` for multi-manager)
- `deals_scrape_opt_out`: One-click opt-out for deal scraping agent
- `google_place_id`: Used for Google Places API photo refresh

---

### `restaurant_members`
Multi-manager membership join table (replaces single `owner_id` pattern).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `user_id` | UUID | REFERENCES profiles(id) ON DELETE CASCADE | |
| `role` | TEXT | CHECK IN ('owner','admin') | 'owner' = manager, 'admin' = scan staff |
| `created_by` | UUID | REFERENCES profiles(id) | Who added this member |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `UNIQUE(restaurant_id, user_id)`
- `idx_restaurant_members_user`
- `idx_restaurant_members_restaurant`

**Key Features:**
- Allows many managers per restaurant
- Backfilled from `restaurants.owner_id` during migration
- Use `is_restaurant_manager(restaurant_id)` helper function for RLS

---

## Deal Management

### `deals`
Customer-facing deals and promotions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `title` | TEXT | NOT NULL | Deal title |
| `description` | TEXT | | Detailed description |
| `deal_category` | TEXT | | 'happy_hour', 'daily_special', 'bogo', 'student_discount', 'other' |
| `discount_type` | TEXT | CHECK IN ('percent','fixed','bogo') | |
| `discount_value` | NUMERIC | | Percentage or dollar amount |
| `original_price` | NUMERIC | | Original price (for savings calc) |
| `is_active` | BOOLEAN | DEFAULT true | Live on platform |
| `is_flagged` | BOOLEAN | DEFAULT false | Flagged for review |
| `is_recurring` | BOOLEAN | DEFAULT true | Repeating weekly |
| `recurrence_days` | INTEGER[] | | Days: 0=Sun, 6=Sat |
| `recurrence_start_time` | TIME | | Daily start time |
| `recurrence_end_time` | TIME | | Daily end time |
| `start_at` | TIMESTAMPTZ | | One-time start (if not recurring) |
| `end_at` | TIMESTAMPTZ | | One-time end (if not recurring) |
| `tags` | TEXT[] | DEFAULT '{}' | Searchable tags |
| `qr_code_token` | TEXT | | QR redemption token |
| `source` | TEXT | | 'manual', 'sheets', 'scraped', etc. |
| `source_url` | TEXT | | URL where deal was found (for scraped) |
| `confidence` | NUMERIC | | LLM confidence (0-1) |
| `last_verified_at` | TIMESTAMPTZ | | Last verification timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_deals_source_scraped` on `source` WHERE source = 'scraped'

**Key Features:**
- `source`: Tracks provenance ('scraped' for auto-detected deals)
- `qr_code_token`: Used for in-person redemption scanning
- Time logic: `is_deal_active_now(deal)` helper validates recurring/one-time schedules

---

### `scraped_deal_candidates`
Review queue for auto-scraped deals (Phase 0 deal-scraping agent).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `title` | TEXT | NOT NULL | Candidate title |
| `description` | TEXT | | |
| `deal_category` | TEXT | | |
| `discount_type` | TEXT | CHECK IN ('percent','fixed','bogo') | |
| `discount_value` | NUMERIC | | |
| `is_recurring` | BOOLEAN | DEFAULT true | |
| `recurrence_days` | INTEGER[] | | |
| `recurrence_start_time` | TIME | | |
| `recurrence_end_time` | TIME | | |
| `start_at` | TIMESTAMPTZ | | |
| `end_at` | TIMESTAMPTZ | | |
| `tags` | TEXT[] | DEFAULT '{}' | |
| `source_url` | TEXT | | URL where scraped |
| `evidence_quote` | TEXT | | Exact text extracted (audit trail) |
| `confidence` | NUMERIC | | LLM confidence (0-1) |
| `content_hash` | TEXT | | Hash of source content |
| `dedupe_hash` | TEXT | NOT NULL | Stable hash for deduplication |
| `status` | TEXT | CHECK IN ('pending','published','rejected','stale','superseded') | |
| `reviewed_by` | UUID | REFERENCES profiles(id) | |
| `reviewed_at` | TIMESTAMPTZ | | |
| `published_deal_id` | UUID | REFERENCES deals(id) ON DELETE SET NULL | |
| `first_seen_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `last_seen_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `UNIQUE(restaurant_id, dedupe_hash)`
- `idx_scraped_candidates_status`
- `idx_scraped_candidates_restaurant`

**Key Features:**
- Weekly job scrapes restaurant websites, extracts deals with LLM
- Operators review pending candidates before publishing to `deals`
- `dedupe_hash`: Prevents duplicate candidates
- `stale`: Marked if not re-detected in subsequent crawls

---

### `deal_flags`
User-submitted reports for inaccurate deals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `deal_id` | UUID | REFERENCES deals(id) ON DELETE CASCADE | |
| `user_id` | UUID | REFERENCES profiles(id) | |
| `reason` | TEXT | | 'incorrect_price', 'expired', 'wrong_hours', etc. |
| `details` | TEXT | | User description |
| `status` | TEXT | DEFAULT 'pending' CHECK IN ('pending','resolved','dismissed') | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Inventory Management

### `products`
Product catalog (ingredients, menu items, supplies).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `barcode` | TEXT | | UPC/EAN barcode |
| `name` | TEXT | NOT NULL | Product name |
| `description` | TEXT | | |
| `category` | TEXT | | 'produce', 'dairy', 'meat', 'beverages', 'dry_goods' |
| `unit` | TEXT | DEFAULT 'each' | 'lbs', 'oz', 'each', 'case', 'gallon', 'liter' |
| `base_unit` | TEXT | | Base unit for conversions |
| `supplier` | TEXT | | Supplier name |
| `external_product_id` | TEXT | | ID from MarketMan/Restaurant365 |
| `external_system` | TEXT | | 'marketman', 'restaurant365', 'oracle_simphony', null |
| `image_url` | TEXT | | Product image |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `UNIQUE(restaurant_id, barcode)`
- `idx_products_restaurant_id`
- `idx_products_barcode`
- `idx_products_category`
- `idx_products_external`

---

### `inventory_items`
Current inventory stock entries.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `product_id` | UUID | REFERENCES products(id) ON DELETE CASCADE | |
| `quantity` | NUMERIC | CHECK >= 0 | Current quantity |
| `unit` | TEXT | NOT NULL | Unit of measure |
| `unit_cost` | NUMERIC | CHECK >= 0 | Cost per unit |
| `purchase_date` | DATE | | |
| `expiration_date` | DATE | | |
| `received_date` | TIMESTAMPTZ | DEFAULT NOW() | |
| `location` | TEXT | | 'freezer', 'refrigerator', 'pantry', 'dry_storage', 'counter' |
| `batch_number` | TEXT | | Lot/batch ID |
| `supplier` | TEXT | | |
| `status` | TEXT | CHECK IN ('active','expired','sold','wasted','low_stock') | |
| `notes` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_inventory_items_restaurant_id`
- `idx_inventory_items_product_id`
- `idx_inventory_items_status`
- `idx_inventory_items_expiration_date`
- `idx_inventory_items_expiring_soon` (composite: `restaurant_id, expiration_date, status`)

---

### `deal_recommendations`
AI-generated deal suggestions based on inventory (e.g., expiring items).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `inventory_item_id` | UUID | REFERENCES inventory_items(id) ON DELETE CASCADE | |
| `product_id` | UUID | REFERENCES products(id) ON DELETE CASCADE | |
| `recommendation_type` | TEXT | CHECK IN ('flash_sale','clearance','bundle','custom') | |
| `suggested_title` | TEXT | NOT NULL | Proposed deal title |
| `suggested_description` | TEXT | | |
| `suggested_discount_percent` | NUMERIC | CHECK 0-100 | |
| `urgency_score` | INTEGER | CHECK 0-100 | 1-100 based on expiration |
| `days_until_expiration` | INTEGER | | |
| `status` | TEXT | CHECK IN ('pending','approved','rejected','created','dismissed') | |
| `deal_id` | UUID | REFERENCES deals(id) | If converted to deal |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_recommendations_restaurant_id`
- `idx_recommendations_status`
- `idx_recommendations_urgency_score` (DESC, WHERE status = 'pending')
- `idx_recommendations_product_id`
- `idx_recommendations_inventory_item_id`

---

### `inventory_alerts`
Alerts for low stock, expiring items, etc.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `inventory_item_id` | UUID | REFERENCES inventory_items(id) ON DELETE CASCADE | |
| `product_id` | UUID | REFERENCES products(id) ON DELETE CASCADE | |
| `alert_type` | TEXT | CHECK IN ('low_stock','expiring_soon','expired','other') | |
| `message` | TEXT | NOT NULL | Alert description |
| `threshold_value` | NUMERIC | | Threshold that triggered alert |
| `is_read` | BOOLEAN | DEFAULT false | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `inventory_sync_logs`
Sync logs for external inventory system integrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `external_system` | TEXT | CHECK IN ('marketman','restaurant365','oracle_simphony') | |
| `sync_type` | TEXT | CHECK IN ('manual','scheduled','webhook') | |
| `status` | TEXT | CHECK IN ('success','failed','partial') | |
| `items_synced` | INTEGER | DEFAULT 0 | |
| `items_created` | INTEGER | DEFAULT 0 | |
| `items_updated` | INTEGER | DEFAULT 0 | |
| `errors` | JSONB | | Error details |
| `synced_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `idx_sync_logs_restaurant_id`
- `idx_sync_logs_external_system`
- `idx_sync_logs_synced_at`
- `idx_sync_logs_status`

---

### `external_system_credentials`
OAuth/API credentials for external inventory systems.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `system_type` | TEXT | CHECK IN ('marketman','restaurant365','oracle_simphony') | |
| `api_key` | TEXT | | Encrypted at app level |
| `api_secret` | TEXT | | Encrypted at app level |
| `account_id` | TEXT | | |
| `access_token` | TEXT | | For OAuth |
| `refresh_token` | TEXT | | |
| `token_expires_at` | TIMESTAMPTZ | | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `last_sync_at` | TIMESTAMPTZ | | |
| `sync_schedule` | TEXT | | 'daily', 'hourly', 'manual', 'realtime' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:**
- `UNIQUE(restaurant_id, system_type)`
- `idx_credentials_restaurant_id`
- `idx_credentials_system_type`
- `idx_credentials_is_active`

---

## Integration Tables

### `square_oauth_tokens`
Square POS integration OAuth tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `access_token` | TEXT | NOT NULL | Encrypted |
| `refresh_token` | TEXT | | Encrypted |
| `expires_at` | TIMESTAMPTZ | | Token expiration |
| `merchant_id` | TEXT | | Square merchant ID |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `square_catalog_items`
Synced menu items from Square.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `square_item_id` | TEXT | NOT NULL | Square catalog item ID |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | | |
| `price` | NUMERIC | | |
| `category` | TEXT | | |
| `image_url` | TEXT | | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `synced_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `square_orders`
Orders synced from Square POS.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `square_order_id` | TEXT | NOT NULL | Square order ID |
| `total_amount` | NUMERIC | | |
| `status` | TEXT | | |
| `order_date` | TIMESTAMPTZ | | |
| `synced_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `google_oauth_tokens`
Google OAuth tokens (for Sheets integration, Places API).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `access_token` | TEXT | NOT NULL | Stored in Supabase Vault |
| `refresh_token` | TEXT | | Stored in Supabase Vault |
| `expires_at` | TIMESTAMPTZ | | |
| `scope` | TEXT | | OAuth scopes |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `sheet_integrations`
Google Sheets sync configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `sheet_id` | TEXT | NOT NULL | Google Sheet ID |
| `sheet_name` | TEXT | | Sheet tab name |
| `sync_enabled` | BOOLEAN | DEFAULT true | |
| `last_sync_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `sheet_synced_rows`
Tracking synced rows from Google Sheets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `sheet_integration_id` | UUID | REFERENCES sheet_integrations(id) ON DELETE CASCADE | |
| `row_number` | INTEGER | | |
| `deal_id` | UUID | REFERENCES deals(id) ON DELETE SET NULL | |
| `synced_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `sheet_sync_errors`
Error log for failed sheet syncs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `sheet_integration_id` | UUID | REFERENCES sheet_integrations(id) ON DELETE CASCADE | |
| `error_message` | TEXT | | |
| `row_number` | INTEGER | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Restaurant Management

### `restaurant_invites`
Invite codes for adding managers/staff to restaurants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `code` | TEXT | UNIQUE NOT NULL | Invite code |
| `role` | TEXT | CHECK IN ('owner','admin') | 'owner' = manager, 'admin' = scanner |
| `max_uses` | INTEGER | DEFAULT 1 | Max redemptions |
| `use_count` | INTEGER | DEFAULT 0 | Current redemptions |
| `expires_at` | TIMESTAMPTZ | | Optional expiration |
| `created_by` | UUID | REFERENCES profiles(id) | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Key Features:**
- Managers can invite their own team (not just operators)
- `redeem_restaurant_invite(code)` RPC atomically claims and adds membership
- Never transfers ownership, only adds members

---

### `restaurant_invite_redemptions`
Log of invite code redemptions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `invite_id` | UUID | REFERENCES restaurant_invites(id) ON DELETE CASCADE | |
| `user_id` | UUID | REFERENCES profiles(id) ON DELETE CASCADE | |
| `redeemed_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `partner_requests`
Restaurant partnership applications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `user_id` | UUID | REFERENCES profiles(id) | Requesting user |
| `status` | TEXT | CHECK IN ('pending','approved','rejected') | |
| `message` | TEXT | | Request message |
| `reviewed_by` | UUID | REFERENCES profiles(id) | |
| `reviewed_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `menu_items`
Restaurant menu items (for display, not inventory).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | | |
| `price` | NUMERIC | | |
| `category` | TEXT | | 'appetizer', 'entree', 'dessert', etc. |
| `image_url` | TEXT | | |
| `is_available` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `menu_item_ingredients`
Links menu items to inventory products.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `menu_item_id` | UUID | REFERENCES menu_items(id) ON DELETE CASCADE | |
| `product_id` | UUID | REFERENCES products(id) ON DELETE CASCADE | |
| `quantity` | NUMERIC | | Quantity per serving |
| `unit` | TEXT | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Analytics & Tracking

### `qr_code_scans`
QR code redemption logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `deal_id` | UUID | REFERENCES deals(id) ON DELETE CASCADE | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `user_id` | UUID | REFERENCES profiles(id) | Customer who redeemed |
| `scanned_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Key Features:**
- Populated by `redeem_deal_scan(deal_id, token, user_id)` RPC
- Updates customer's `profiles.num_visits` and `profiles.amount_saved`

---

### `user_push_tokens`
Push notification tokens (Phase 3).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `user_id` | UUID | REFERENCES profiles(id) ON DELETE CASCADE | |
| `token` | TEXT | UNIQUE NOT NULL | Expo push token |
| `platform` | TEXT | | 'ios', 'android' |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

### `api_keys`
API keys for external integrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | |
| `restaurant_id` | UUID | REFERENCES restaurants(id) ON DELETE CASCADE | |
| `key_hash` | TEXT | UNIQUE NOT NULL | Hashed API key |
| `name` | TEXT | | Key label |
| `permissions` | TEXT[] | | Scopes |
| `last_used_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Indexes & Performance

### Key Indexes
- **Deals:** `idx_deals_source_scraped` (for scraped deal queries)
- **Inventory Items:** `idx_inventory_items_expiring_soon` (composite: restaurant_id, expiration_date, status)
- **Products:** `idx_products_external` (for external system syncs)
- **Recommendations:** `idx_recommendations_urgency_score` (DESC, WHERE status = 'pending')
- **Sync Logs:** `idx_sync_logs_synced_at`, `idx_sync_logs_status`

### Performance Considerations
See `database-query-analysis.md` for detailed query optimization recommendations.

**Known Issues:**
- `useRestaurantDeals` and `useActiveDealsMap` poll every 60s → should use Realtime subscriptions
- `useInventory` and `useInventoryAlerts` have no limits → needs pagination
- `grab-deals.js` processes restaurants sequentially → should parallelize with concurrency limit

---

## Row Level Security (RLS)

All tables have RLS enabled. Key patterns:

### Restaurant Scoping
Most tables use the helper functions:
- `is_restaurant_manager(restaurant_id)`: True if user is an 'owner' member OR legacy owner_id
- `is_platform_operator()`: True if user has `profiles.is_operator = true`

**Example Policy:**
```sql
CREATE POLICY "Managers can view products"
  ON products FOR SELECT
  USING (is_restaurant_manager(restaurant_id) OR is_platform_operator());
```

### Public Read Policies
- `restaurants`: Public can SELECT (for customer map)
- `deals`: Public can SELECT WHERE `is_active = true` (for customer app)

### Security Features
- Trigger `prevent_role_self_escalation()` blocks users from changing their own `role` or `is_operator`
- OAuth tokens stored in Supabase Vault (referenced in `google_oauth_tokens` via vault IDs)
- Invite redemption uses `SECURITY DEFINER` RPC with atomic `use_count` increment

---

## Helper Functions

### `is_restaurant_manager(restaurant_id UUID) RETURNS BOOLEAN`
Checks if current user is a manager/owner of a restaurant.
- Security: `SECURITY DEFINER`, `STABLE`
- Returns: True if user is in `restaurant_members` as 'owner' OR is legacy `owner_id`

### `is_platform_operator() RETURNS BOOLEAN`
Checks if current user is a platform operator (founder/staff).
- Security: `SECURITY DEFINER`, `STABLE`
- Returns: True if `profiles.is_operator = true`

### `is_deal_active_now(deal) RETURNS BOOLEAN`
Validates if a deal is currently active (checks time windows, recurrence).
- Used in `redeem_deal_scan()` RPC

### `redeem_deal_scan(deal_id, token, user_id) RETURNS TABLE`
Redeems a QR code and records the scan.
- Security: `SECURITY DEFINER`
- Validates: deal exists, user is manager, QR token matches, deal is active
- Updates: `profiles.num_visits`, `profiles.amount_saved`, `profiles.recents`
- Inserts: `qr_code_scans` row

### `redeem_restaurant_invite(code) RETURNS TABLE`
Redeems an invite code and adds user as restaurant member.
- Security: `SECURITY DEFINER`
- Atomic: Uses `UPDATE ... WHERE use_count < max_uses` to prevent over-redemption
- Never downgrades: Existing 'owner' members won't be downgraded to 'admin'

### `set_updated_at() RETURNS TRIGGER`
Trigger function to auto-update `updated_at` column.
- Used on: products, inventory_items, external_system_credentials, deal_recommendations, etc.

---

## Migration History

Migrations are stored in `/database/migrations/`:
- **35 migration files** total
- Key migrations:
  - `add_inventory_system.sql`: Core inventory tables
  - `add_deal_scraping_agent.sql`: Scraped deal candidates & review queue
  - `add_restaurant_members.sql`: Multi-manager membership system
  - `merchant_membership_migration.sql`: RLS updates for membership model
  - `add_square_integration.sql`: Square POS sync tables
  - `add_sheets_integration.sql`: Google Sheets sync
  - `wrap_oauth_tokens_in_vault.sql`: Secure token storage

---

## Common Queries

### Get Active Deals for a Restaurant
```sql
SELECT * FROM deals
WHERE restaurant_id = '<uuid>'
  AND is_active = true
  AND is_flagged = false
ORDER BY created_at DESC;
```

### Get Expiring Inventory Items
```sql
SELECT i.*, p.name, p.category
FROM inventory_items i
JOIN products p ON i.product_id = p.id
WHERE i.restaurant_id = '<uuid>'
  AND i.status = 'active'
  AND i.expiration_date IS NOT NULL
  AND i.expiration_date <= NOW() + INTERVAL '7 days'
ORDER BY i.expiration_date ASC;
```

### Get Pending Deal Recommendations
```sql
SELECT * FROM deal_recommendations
WHERE restaurant_id = '<uuid>'
  AND status = 'pending'
ORDER BY urgency_score DESC, days_until_expiration ASC;
```

### Get Scraped Deal Candidates for Review
```sql
SELECT c.*, r.name AS restaurant_name
FROM scraped_deal_candidates c
JOIN restaurants r ON c.restaurant_id = r.id
WHERE c.status = 'pending'
ORDER BY c.confidence DESC, c.first_seen_at DESC;
```

---

## Notes

- **Multi-Manager Support:** Use `restaurant_members` table instead of `restaurants.owner_id` for new code
- **OAuth Tokens:** Sensitive tokens should be stored in Supabase Vault, not plaintext columns
- **Deal Time Logic:** Use `is_deal_active_now()` helper for accurate recurring/one-time validation
- **Scraping Agent:** Runs weekly via cron, uses `deals_scrape_opt_out` flag to respect opt-outs
- **Photo Refresh:** Google Places photos refreshed weekly via GitHub Actions workflow

---

**For detailed query optimization recommendations, see:** `database-query-analysis.md`
