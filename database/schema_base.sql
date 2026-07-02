-- =============================================================================
-- Dealish — Base Schema (hosted-only objects)        DEBT-012
-- =============================================================================
-- The incremental files in database/migrations/ assume these objects already
-- exist; they are present in the live Supabase project but had NO migration.
-- This file captures them so a fresh project can be provisioned from the repo.
--
-- Covers ONLY the objects that no migration creates:
--   * tables:    profiles, restaurants, deals, redemptions
--   * functions: set_updated_at, is_deal_active_now, is_merchant,
--                handle_new_auth_user, append_favourite, remove_favourite,
--                mint_redemption, verify_redemption
--   * triggers:  deals/restaurants updated_at, auth.users -> profiles
--   * RLS:       policies for the four tables above
--
-- Everything else (qr_code_scans, products, inventory_*, menu_*, sheets/oauth,
-- partner_requests, deal_flags, push tokens, settings, discounts, qr columns,
-- vault wrappers, etc.) lives in database/migrations/.
--
-- Apply order for a fresh project:
--   1) this file
--   2) database/migrations/*.sql  (in filename order)
--   3) the DB-side notification triggers in add_notification_triggers.sql are
--      OPTIONAL — see that file's header.
--
-- This reflects the POST-FIX target state: recents is jsonb (DEBT-016),
-- is_merchant() recognizes owner/admin (DEBT-001), and the no-op
-- deals_public_read_active_now policy is omitted (DEBT-002).
--
-- Reconstructed from the live schema dump on 2026-05-29. Validate against a
-- scratch project before relying on it for production provisioning.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  text not null check (role in ('user', 'owner', 'admin')),
  display_name          text,
  created_at            timestamptz not null default now(),
  favourites            uuid[],
  num_visits            bigint not null default 0,
  amount_saved          numeric not null default 0,
  recents               jsonb default '[]'::jsonb,   -- DEBT-016: jsonb activity objects
  location              text,
  avatar_url            text,
  settings              jsonb default '{}'::jsonb,
  push_token            text,
  push_token_updated_at timestamp
);

-- ----------------------------------------------------------------------------
-- restaurants
-- ----------------------------------------------------------------------------
create table if not exists public.restaurants (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete restrict,
  name           text not null,
  address        text,
  city           text,
  lat            double precision not null check (lat >= -90 and lat <= 90),
  lng            double precision not null check (lng >= -180 and lng <= 180),
  hero_image_url text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  type           text,
  display_image  text,
  rating         real not null default 0,
  num_ratings    bigint not null default 0,
  partner        boolean not null default false,
  phone          text
);
create index if not exists restaurants_is_active_idx on public.restaurants (is_active);
create index if not exists restaurants_owner_id_idx  on public.restaurants (owner_id);

-- ----------------------------------------------------------------------------
-- deals
-- ----------------------------------------------------------------------------
create table if not exists public.deals (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade,
  title                 text not null,
  description           text,
  tags                  text[] not null default '{}'::text[],
  start_at              timestamptz,
  end_at                timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  is_recurring          boolean default false,
  recurrence_days       integer[],
  recurrence_start_time time,
  recurrence_end_time   time,
  qr_code_token         text unique,
  qr_code_generated_at  timestamp,
  discount_type         text check (discount_type in ('percent', 'fixed', 'bogo')),
  discount_value        numeric,
  original_price        numeric,
  is_flagged            boolean default false,
  constraint deals_time_window_chk check (start_at is null or end_at is null or start_at < end_at)
);
create index if not exists deals_restaurant_id_idx on public.deals (restaurant_id);
create index if not exists deals_active_window_idx  on public.deals (is_active, start_at, end_at);
create index if not exists deals_tags_gin_idx       on public.deals using gin (tags);
create index if not exists idx_deals_qr_code_token  on public.deals (qr_code_token);

-- ----------------------------------------------------------------------------
-- redemptions (secure token/PIN redemption — see DEBT-001/003 for status)
-- ----------------------------------------------------------------------------
create table if not exists public.redemptions (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid not null references public.deals(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  token_hash          text not null,
  pin_hash            text not null,
  status              text not null default 'issued'
                        check (status in ('issued', 'used', 'expired', 'revoked')),
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz,
  used_at             timestamptz,
  used_by_merchant_id uuid references public.profiles(id),
  metadata            jsonb
);
create index if not exists redemptions_deal_id_idx          on public.redemptions (deal_id);
create index if not exists redemptions_user_deal_issued_idx on public.redemptions (user_id, deal_id, issued_at desc);
create index if not exists redemptions_user_id_issued_at_idx on public.redemptions (user_id, issued_at desc);
create index if not exists redemptions_status_expires_idx   on public.redemptions (status, expires_at);
create index if not exists redemptions_used_by_idx          on public.redemptions (used_by_merchant_id, used_at desc);

-- =============================================================================
-- Functions
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_deal_active_now(d public.deals)
returns boolean language sql stable as $$
  select d.is_active = true
     and (d.start_at is null or d.start_at <= now())
     and (d.end_at   is null or d.end_at   >= now());
$$;

-- DEBT-001: recognizes the roles that actually exist (was role = 'merchant',
-- which the profiles_role_check constraint forbids → always false).
create or replace function public.is_merchant()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'admin')
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'user', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.append_favourite(p_profile_id uuid, p_restaurant_id uuid)
returns void language sql security definer as $$
  update public.profiles
  set favourites = coalesce(favourites, array[]::uuid[]) || array[p_restaurant_id]::uuid[]
  where id = p_profile_id;
$$;

create or replace function public.remove_favourite(p_profile_id uuid, p_restaurant_id uuid)
returns void language sql security definer as $$
  update public.profiles
  set favourites = array_remove(coalesce(favourites, array[]::uuid[]), p_restaurant_id)
  where id = p_profile_id;
$$;

create or replace function public.mint_redemption(p_deal_id uuid)
returns table(redemption_id uuid, token text, pin text, expires_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text;
  v_pin text;
  v_expires_at timestamptz;
  v_deal public.deals;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_deal from public.deals d where d.id = p_deal_id;
  if not found then raise exception 'Deal not found'; end if;
  if not public.is_deal_active_now(v_deal) then raise exception 'Deal is not active'; end if;
  if not exists (
    select 1 from public.restaurants r where r.id = v_deal.restaurant_id and r.is_active = true
  ) then raise exception 'Restaurant is not active'; end if;

  -- Rate limit: 1/day per user per deal (issued or used)
  if exists (
    select 1 from public.redemptions r
    where r.user_id = auth.uid()
      and r.deal_id = p_deal_id
      and r.issued_at >= date_trunc('day', now())
      and r.issued_at <  date_trunc('day', now()) + interval '1 day'
      and r.status in ('issued', 'used')
  ) then raise exception 'Already redeemed today'; end if;

  v_token := encode(gen_random_bytes(16), 'hex');
  v_pin := lpad(floor(random() * 10000)::int::text, 4, '0');
  v_expires_at := now() + interval '20 minutes';

  insert into public.redemptions (deal_id, user_id, token_hash, pin_hash, status, issued_at, expires_at)
  values (
    p_deal_id, auth.uid(),
    encode(digest(v_token, 'sha256'), 'hex'),
    encode(digest(v_pin, 'sha256'), 'hex'),
    'issued', now(), v_expires_at
  )
  returning id into redemption_id;

  token := v_token; pin := v_pin; expires_at := v_expires_at;
  return next;
end;
$$;

create or replace function public.verify_redemption(p_token_or_pin text)
returns table(ok boolean, message text, redemption_id uuid, deal_id uuid, user_id uuid, used_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_hash text;
  v_red public.redemptions;
  v_now timestamptz := now();
begin
  if auth.uid() is null then ok := false; message := 'Not authenticated'; return next; return; end if;
  if not public.is_merchant() then ok := false; message := 'Not a merchant'; return next; return; end if;
  if p_token_or_pin is null or length(trim(p_token_or_pin)) = 0 then
    ok := false; message := 'Missing code'; return next; return;
  end if;

  v_hash := encode(digest(p_token_or_pin, 'sha256'), 'hex');

  select r.* into v_red
  from public.redemptions r
  where r.status = 'issued'
    and (r.expires_at is null or r.expires_at >= v_now)
    and (r.token_hash = v_hash or r.pin_hash = v_hash)
  order by r.issued_at desc
  limit 1;

  if not found then ok := false; message := 'Invalid/expired/used code'; return next; return; end if;

  if not exists (
    select 1 from public.deals d
    join public.restaurants rs on rs.id = d.restaurant_id
    where d.id = v_red.deal_id and rs.owner_id = auth.uid()
  ) then ok := false; message := 'Code not valid for this merchant'; return next; return; end if;

  update public.redemptions
  set status = 'used', used_at = v_now, used_by_merchant_id = auth.uid()
  where id = v_red.id;

  ok := true; message := 'Redeemed';
  redemption_id := v_red.id; deal_id := v_red.deal_id; user_id := v_red.user_id; used_at := v_now;
  return next;
end;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a new auth user signs up.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =============================================================================
-- Row Level Security (policies for the four base tables)
-- =============================================================================

alter table public.profiles    enable row level security;
alter table public.restaurants enable row level security;
alter table public.deals       enable row level security;
alter table public.redemptions enable row level security;

-- profiles --------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- LOCKDOWN: profiles_update_own lets a user update their own row including `role`,
-- which combined with the role-based deals/analytics policies would be a privilege
-- escalation. Block role changes from the app (authenticated/anon) here in the base
-- schema so the guard exists regardless of which feature migrations are applied.
-- Service role, the SQL editor (postgres), and SECURITY DEFINER RPCs (which run as
-- the function owner) can still change roles via the invite/admin flow.
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql as $$
begin
  if NEW.role is distinct from OLD.role
     and current_user in ('authenticated', 'anon') then
    raise exception 'role can only be changed via an authorized invite/admin flow';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- restaurants -----------------------------------------------------------------
drop policy if exists restaurants_public_read_active on public.restaurants;
create policy restaurants_public_read_active on public.restaurants
  for select to anon, authenticated using (is_active = true);

drop policy if exists restaurants_merchant_insert_own on public.restaurants;
create policy restaurants_merchant_insert_own on public.restaurants
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists restaurants_merchant_update_own on public.restaurants;
create policy restaurants_merchant_update_own on public.restaurants
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists restaurants_merchant_delete_own on public.restaurants;
create policy restaurants_merchant_delete_own on public.restaurants
  for delete to authenticated using (auth.uid() = owner_id);

-- deals -----------------------------------------------------------------------
drop policy if exists deals_public_read_active on public.deals;
create policy deals_public_read_active on public.deals
  for select to anon, authenticated using (is_active = true);

drop policy if exists deals_owner_insert on public.deals;
create policy deals_owner_insert on public.deals
  for insert to authenticated with check (exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()
  ));

drop policy if exists deals_owner_update on public.deals;
create policy deals_owner_update on public.deals
  for update to authenticated using (exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()
  ));

drop policy if exists deals_owner_delete on public.deals;
create policy deals_owner_delete on public.deals
  for delete to authenticated using (exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()
  ));

-- redemptions -----------------------------------------------------------------
drop policy if exists redemptions_user_read_own on public.redemptions;
create policy redemptions_user_read_own on public.redemptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists redemptions_merchant_read_own on public.redemptions;
create policy redemptions_merchant_read_own on public.redemptions
  for select to authenticated using (
    public.is_merchant() and exists (
      select 1 from public.deals d
      join public.restaurants r on r.id = d.restaurant_id
      where d.id = redemptions.deal_id and r.owner_id = auth.uid()
    )
  );
