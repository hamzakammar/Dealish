-- ============================================================================
-- Operator restaurant ingestion RPC
-- ----------------------------------------------------------------------------
-- Adds a single SECURITY DEFINER function that lets a *platform operator*
-- (profiles.is_operator = true — the same internal/test-account gate used for
-- the hidden "Review Auto-Detected Deals" / Square features) create a restaurant
-- and its first deal in ONE atomic transaction, from the private ingestion form
-- (app/admin/ingest-restaurant.tsx). No CLI or Supabase dashboard needed.
--
-- Why an RPC instead of two client-side .insert() calls (as create-restaurant
-- does today):
--   1. ATOMICITY — restaurant + owner-membership + deal succeed or fail together
--      (a function body is a single transaction). Two separate client inserts can
--      leave an orphan restaurant with no deal if the second call fails.
--   2. SERVER-SIDE AUTHORIZATION — the restaurants INSERT RLS policy only checks
--      `owner_id = auth.uid()`, i.e. ANY authenticated user can create a
--      restaurant they own. That is not "operator-only". This function enforces
--      is_platform_operator() server-side, so the private form cannot be driven
--      by a normal user even if they call the RPC directly. (The UI also gates on
--      profile.is_operator, but defence-in-depth is required.)
--   3. DUPLICATE PREVENTION at the data layer — dedupes on Google place_id, or a
--      normalized name + (address OR coordinate proximity), before inserting.
--
-- Depends on columns added by earlier migrations (guarded defensively below):
--   restaurants.google_place_id, restaurants.website_url  (add_deal_scraping_agent.sql)
--   restaurants.is_test                                   (add_test_restaurant_visibility.sql)
--   profiles.is_operator + is_platform_operator()         (merchant_membership_migration.sql)
--   restaurant_members                                    (add_restaurant_members.sql)
--
-- The created restaurant is a non-partner (partner = false) restaurant with an
-- optional website_url, so it is automatically eligible for the existing deal
-- scraping/ingestion agent (which crawls non-partner restaurants that have a
-- website and have not opted out). Its deal is written with source = 'manual'.
-- ============================================================================

-- Defensive: ensure the columns this function relies on exist even if applied
-- out of order. These are no-ops when the referenced migrations already ran.
alter table public.restaurants
  add column if not exists google_place_id text,
  add column if not exists website_url     text,
  add column if not exists is_test         boolean not null default false;

create or replace function public.create_ingested_restaurant_with_deal(
  p_name                  text,
  p_lat                   double precision,
  p_lng                   double precision,
  p_deal_title            text,
  p_address               text        default null,
  p_city                  text        default null,
  p_type                  text        default null,
  p_phone                 text        default null,
  p_hero_image_url        text        default null,
  p_google_place_id       text        default null,
  p_website_url           text        default null,
  p_is_test               boolean     default false,
  p_deal_description      text        default null,
  p_deal_tags             text[]      default '{}'::text[],
  p_is_recurring          boolean     default false,
  p_recurrence_days       integer[]   default null,
  p_recurrence_start_time time        default null,
  p_recurrence_end_time   time        default null,
  p_start_at              timestamptz default null,
  p_end_at                timestamptz default null,
  p_discount_type         text        default null,
  p_discount_value        numeric     default null,
  p_original_price        numeric     default null
)
returns table (out_restaurant_id uuid, out_deal_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_deal_id       uuid;
  v_place_id      text := nullif(btrim(coalesce(p_google_place_id, '')), '');
begin
  -- 1) Server-side authorization: operators only.
  if not public.is_platform_operator() then
    raise exception 'not_operator' using errcode = '42501';
  end if;

  -- 2) Required-field validation (mirrors the UI, enforced server-side).
  if p_name is null or btrim(p_name) = '' then
    raise exception 'missing_name' using errcode = '23514';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'missing_location' using errcode = '23514';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coordinates' using errcode = '23514';
  end if;
  if p_deal_title is null or btrim(p_deal_title) = '' then
    raise exception 'missing_deal_title' using errcode = '23514';
  end if;
  if p_discount_type is not null
     and p_discount_type not in ('percent', 'fixed', 'bogo') then
    raise exception 'invalid_discount_type' using errcode = '23514';
  end if;

  -- 3) Duplicate prevention.
  -- 3a) Same Google place id => same physical place.
  if v_place_id is not null and exists (
    select 1 from public.restaurants r where r.google_place_id = v_place_id
  ) then
    raise exception 'duplicate_place' using errcode = '23505';
  end if;
  -- 3b) Same normalized name AND (same normalized address OR within ~100m).
  if exists (
    select 1
    from public.restaurants r
    where lower(btrim(r.name)) = lower(btrim(p_name))
      and (
        (p_address is not null
          and lower(btrim(coalesce(r.address, ''))) = lower(btrim(p_address)))
        or (abs(r.lat - p_lat) < 0.001 and abs(r.lng - p_lng) < 0.001)
      )
  ) then
    raise exception 'duplicate_name_address' using errcode = '23505';
  end if;

  -- 4) Insert the restaurant (owner = the operator, so it also satisfies the
  --    owner_id = auth.uid() INSERT policy; non-partner so the agent can enrich).
  insert into public.restaurants (
    owner_id, name, address, city, lat, lng, type, phone,
    hero_image_url, google_place_id, website_url, is_test, partner, is_active
  ) values (
    auth.uid(),
    btrim(p_name),
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    p_lat,
    p_lng,
    nullif(btrim(coalesce(p_type, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_hero_image_url, '')), ''),
    v_place_id,
    nullif(btrim(coalesce(p_website_url, '')), ''),
    coalesce(p_is_test, false),
    false,
    true
  )
  returning id into v_restaurant_id;

  -- 5) Register the operator as the owner-member (membership-based RLS).
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_restaurant_id, auth.uid(), 'owner')
  on conflict do nothing;

  -- 6) Insert the first deal (source = 'manual' — an ordinary, verified deal).
  insert into public.deals (
    restaurant_id, title, description, tags, is_active, is_recurring,
    recurrence_days, recurrence_start_time, recurrence_end_time,
    start_at, end_at, discount_type, discount_value, original_price, source
  ) values (
    v_restaurant_id,
    btrim(p_deal_title),
    nullif(btrim(coalesce(p_deal_description, '')), ''),
    coalesce(p_deal_tags, '{}'::text[]),
    true,
    coalesce(p_is_recurring, false),
    case when coalesce(p_is_recurring, false) then p_recurrence_days       else null end,
    case when coalesce(p_is_recurring, false) then p_recurrence_start_time else null end,
    case when coalesce(p_is_recurring, false) then p_recurrence_end_time   else null end,
    case when coalesce(p_is_recurring, false) then null else p_start_at end,
    case when coalesce(p_is_recurring, false) then null else p_end_at   end,
    p_discount_type,
    p_discount_value,
    p_original_price,
    'manual'
  )
  returning id into v_deal_id;

  out_restaurant_id := v_restaurant_id;
  out_deal_id       := v_deal_id;
  return next;
end;
$$;

-- Only authenticated users may call it; the body itself enforces operator-only.
revoke all on function public.create_ingested_restaurant_with_deal(
  text, double precision, double precision, text, text, text, text, text, text,
  text, text, boolean, text, text[], boolean, integer[], time, time,
  timestamptz, timestamptz, text, numeric, numeric
) from public;

grant execute on function public.create_ingested_restaurant_with_deal(
  text, double precision, double precision, text, text, text, text, text, text,
  text, text, boolean, text, text[], boolean, integer[], time, time,
  timestamptz, timestamptz, text, numeric, numeric
) to authenticated;

-- ----------------------------------------------------------------------------
-- Storage note (photo upload):
--   The private form uploads the restaurant photo through the existing storage
--   helper (utils/uploadImage.ts -> bucket 'restaurant-images'). storage.objects
--   RLS is dashboard-managed in this project (see setup_restaurant_images_storage.sql),
--   and the suggested upload policy only allows profiles.role IN ('owner','admin').
--   An operator account may have role = 'user'. If Daniel's account is not already
--   owner/admin, add an operator clause to the bucket's INSERT policy in the
--   Supabase dashboard, e.g.:
--
--     bucket_id = 'restaurant-images' AND (
--       EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
--               AND (p.role IN ('owner','admin') OR p.is_operator))
--     )
-- ----------------------------------------------------------------------------
