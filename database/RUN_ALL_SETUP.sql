-- =====================================================================
-- Dealish — RUN-ALL SETUP (paste this whole file into Supabase -> SQL Editor -> Run)
-- =====================================================================
-- This is the ONLY SQL you need. It bundles, in the correct order:
--   1) APPLY_core_fixes.sql                  (bug D + analytics + DEBT items)
--   2) add_test_restaurant_visibility.sql    (Q1: hide test restaurant)
--   3) add_restaurant_invites.sql            (Q3: invite codes + role lockdown)
--   4) make YOU an operator                  (EDIT ONE LINE at the very bottom)
--
-- EDIT ONE THING: scroll to the bottom and replace YOUR_EMAIL_HERE with the
-- email you log into the app with. Everything else is ready. Safe to re-run.
-- =====================================================================


-- ############ 1/3  CORE FIXES ############
-- =====================================================================
-- Dealish — CORE FIXES, apply in one shot (Supabase -> SQL Editor -> Run)
-- =====================================================================
-- Unlocks: Bug D (QR scan attribution) + analytics + DEBT-001/002/005/009/016.
-- Does NOT cover Bugs A/B/C (those need: deploy `places` edge fn + set
-- GOOGLE_MAPS_API_KEY secret + rebuild the app).
--
-- Safe to run: every statement is idempotent or a safe one-time conversion,
-- so re-running this file is harmless. Runs as one transaction — if anything
-- fails, nothing is applied.
--
-- AFTER running: create the restaurant-images Storage policies in the
-- Dashboard (Storage > restaurant-images > Policies) — see step 6 notes.
-- =====================================================================

BEGIN;

-- 1) DEBT-016: profiles.recents uuid[] -> jsonb (activity tracking was silently
--    failing; the redeem RPC below appends jsonb to it). No-op if already jsonb.
ALTER TABLE public.profiles ALTER COLUMN recents DROP DEFAULT;
ALTER TABLE public.profiles
  ALTER COLUMN recents TYPE jsonb
  USING (CASE WHEN recents IS NULL THEN '[]'::jsonb ELSE to_jsonb(recents) END);
ALTER TABLE public.profiles ALTER COLUMN recents SET DEFAULT '[]'::jsonb;
UPDATE public.profiles SET recents = '[]'::jsonb WHERE recents IS NULL;

-- 2) DEBT-001: is_merchant() checked a non-existent role ('merchant') so it was
--    always false. Recognize the roles that actually exist.
CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'admin')
  );
$function$;

-- 3) DEBT-003: server-side redemption RPC. The scanner runs on the OWNER device
--    but must write a scan for the CUSTOMER (RLS blocked that). SECURITY DEFINER
--    validates token/active/ownership, records the scan, and credits the customer.
CREATE OR REPLACE FUNCTION public.redeem_deal_scan(
  p_deal_id uuid,
  p_token   text,
  p_user_id uuid
)
RETURNS TABLE (
  ok              boolean,
  message         text,
  saved_amount    numeric,
  deal_title      text,
  out_restaurant_id   uuid,
  restaurant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal       public.deals;
  v_restaurant public.restaurants;
  v_savings    numeric := 0;
  v_is_admin   boolean := false;
BEGIN
  ok := false;
  saved_amount := 0;

  IF auth.uid() IS NULL THEN
    message := 'Not authenticated'; RETURN NEXT; RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT public.is_merchant() THEN
    message := 'Not authorized to redeem'; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_deal FROM public.deals d WHERE d.id = p_deal_id;
  IF NOT FOUND THEN
    message := 'Deal not found'; RETURN NEXT; RETURN;
  END IF;

  IF v_deal.qr_code_token IS NULL OR v_deal.qr_code_token <> p_token THEN
    message := 'Invalid or expired QR code'; RETURN NEXT; RETURN;
  END IF;

  IF NOT public.is_deal_active_now(v_deal) THEN
    message := 'Deal is not active right now'; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants r WHERE r.id = v_deal.restaurant_id;
  IF NOT FOUND OR v_restaurant.is_active = false THEN
    message := 'Restaurant is not active'; RETURN NEXT; RETURN;
  END IF;

  -- Owners may only redeem for their own restaurants; admins may redeem anywhere.
  IF NOT v_is_admin AND v_restaurant.owner_id <> auth.uid() THEN
    message := 'This deal is not for your restaurant'; RETURN NEXT; RETURN;
  END IF;

  -- Savings calc mirrors utils/activity.ts calculateSavings().
  v_savings := CASE
    WHEN v_deal.discount_type = 'percent'
         AND v_deal.discount_value IS NOT NULL
         AND v_deal.original_price IS NOT NULL
      THEN round(v_deal.original_price * v_deal.discount_value / 100.0, 2)
    WHEN v_deal.discount_type = 'fixed' THEN COALESCE(v_deal.discount_value, 0)
    WHEN v_deal.discount_type = 'bogo'  THEN COALESCE(v_deal.original_price, 0)
    ELSE 0
  END;

  -- Record the scan (definer bypasses the customer-only INSERT policy).
  INSERT INTO public.qr_code_scans (deal_id, restaurant_id, user_id, scanned_at)
  VALUES (p_deal_id, v_deal.restaurant_id, p_user_id, now());

  -- Attribute the redemption to the CUSTOMER, not the scanning merchant.
  UPDATE public.profiles
  SET num_visits   = COALESCE(num_visits, 0) + 1,
      amount_saved = COALESCE(amount_saved, 0) + v_savings,
      recents      = COALESCE(recents, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'restaurant_id',    v_deal.restaurant_id,
          'activity_type',    'redemption',
          'deal_id',          p_deal_id,
          'deal_description', v_deal.title,
          'amount_saved',     v_savings,
          'created_at',       now()
        )
      )
  WHERE id = p_user_id;

  ok               := true;
  message          := 'Redeemed';
  saved_amount     := v_savings;
  deal_title       := v_deal.title;
  out_restaurant_id := v_deal.restaurant_id;
  restaurant_name  := v_restaurant.name;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_deal_scan(uuid, text, uuid) TO authenticated;

-- 4) DEBT-002: drop the dead duplicate public SELECT policy on deals (keeps the
--    is_active=true policy, which is what actually governed visibility).
DROP POLICY IF EXISTS deals_public_read_active_now ON public.deals;

-- 5) DEBT-005: remove the hardcoded owner_id default (a specific user id) so an
--    insert omitting owner_id can never silently assign that account.
ALTER TABLE public.restaurants ALTER COLUMN owner_id DROP DEFAULT;

-- 6) DEBT-009: ensure the restaurant-images Storage bucket exists.
--    NOTE: Storage RLS policies are NOT created here — add them in the Dashboard
--    (Storage > restaurant-images > Policies): public SELECT; owner/admin
--    INSERT/UPDATE/DELETE with bucket_id='restaurant-images'
--    AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN ('owner','admin')).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('restaurant-images', 'restaurant-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

COMMIT;

-- =====================================================================
-- VERIFY (read-only — should all return the "good" value)
-- =====================================================================
-- recents is now jsonb:
SELECT data_type AS recents_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles' AND column_name='recents';

-- redeem_deal_scan exists:
SELECT proname AS function_exists
  FROM pg_proc WHERE proname = 'redeem_deal_scan';

-- dead deals policy is gone (expect 0 rows):
SELECT policyname
  FROM pg_policies
 WHERE schemaname='public' AND tablename='deals'
   AND policyname='deals_public_read_active_now';

-- owner_id default removed (expect NULL):
SELECT column_default AS owner_id_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='restaurants' AND column_name='owner_id';

-- bucket exists:
SELECT id AS bucket FROM storage.buckets WHERE id='restaurant-images';

-- ############ 2/3  TEST-RESTAURANT VISIBILITY (Q1) ############
-- Q1: make specific "test" restaurants visible ONLY to operators (you).
--
-- A RESTRICTIVE policy is AND-ed with the existing permissive read policy, so it
-- can only ever hide rows, never widen access. Anonymous users (auth.uid() IS NULL)
-- never match the operator branch, so they never see test restaurants.
--
-- Additive/idempotent. Safe to run alongside the other migrations.

alter table public.profiles
  add column if not exists is_operator boolean not null default false;

alter table public.restaurants
  add column if not exists is_test boolean not null default false;

drop policy if exists restaurants_hide_test on public.restaurants;
create policy restaurants_hide_test on public.restaurants
  as restrictive
  for select
  to public
  using (
    is_test = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_operator
    )
  );

-- Mark John's Food Emporium as a test restaurant (kept active so it still renders
-- for operators; the restrictive policy hides it from everyone else).
update public.restaurants
   set is_test = true, is_active = true
 where id = '2d63f4b5-f38a-4dff-b4e1-45a421754f63';

-- =====================================================================
-- REQUIRED: make YOURSELF an operator so you (and only you) can see it.
-- Fill in your email and run this once:
--
--   update public.profiles set is_operator = true
--    where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
-- =====================================================================

-- ############ 3/3  INVITE CODES + ROLE LOCKDOWN (Q3) ############
-- Q3: invite-code admin onboarding (option C) + role self-escalation lockdown.
--
-- New restaurant owners/staff create a normal account, then redeem a code an
-- operator gave them. The code is scoped to a specific restaurant + role, is
-- single-use by default, and can expire. No password sharing; revocable; audited.

-- 1) LOCKDOWN: stop users from promoting themselves. The existing
--    profiles_update_own policy lets a user update their own row, including `role`.
--    This trigger blocks role changes made from the app (authenticated/anon),
--    while allowing the service role, the SQL editor (postgres), and our
--    SECURITY DEFINER RPCs (which run as the function owner).
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
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

-- 2) invites + redemption log
create table if not exists public.restaurant_invites (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role          text not null check (role in ('owner', 'admin')),
  created_by    uuid references public.profiles(id),
  note          text,
  max_uses      int  not null default 1,
  use_count     int  not null default 0,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_restaurant_invites_code on public.restaurant_invites(lower(code));

create table if not exists public.restaurant_invite_redemptions (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.restaurant_invites(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_id, user_id)
);

-- 3) RLS: only operators touch invites directly; normal users redeem via the RPC.
alter table public.restaurant_invites           enable row level security;
alter table public.restaurant_invite_redemptions enable row level security;

drop policy if exists invites_operator_all on public.restaurant_invites;
create policy invites_operator_all on public.restaurant_invites
  for all to authenticated
  using     (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator));

drop policy if exists invite_redemptions_operator_read on public.restaurant_invite_redemptions;
create policy invite_redemptions_operator_read on public.restaurant_invite_redemptions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator));

-- 4) redeem RPC. SECURITY DEFINER: validates the code, sets the caller's role,
--    and (for owner invites) assigns the restaurant's owner_id to the caller.
create or replace function public.redeem_restaurant_invite(p_code text)
returns table (ok boolean, message text, granted_role text, out_restaurant_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv public.restaurant_invites;
  v_uid uuid := auth.uid();
begin
  ok := false;

  if v_uid is null then
    message := 'Not signed in'; return next; return;
  end if;

  select * into v_inv from public.restaurant_invites i
   where lower(i.code) = lower(trim(p_code))
   limit 1;

  if not found then
    message := 'Invalid code'; return next; return;
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    message := 'This code has expired'; return next; return;
  end if;
  if v_inv.use_count >= v_inv.max_uses then
    message := 'This code has already been used'; return next; return;
  end if;

  insert into public.restaurant_invite_redemptions (invite_id, user_id)
  values (v_inv.id, v_uid)
  on conflict (invite_id, user_id) do nothing;

  update public.profiles set role = v_inv.role where id = v_uid;

  if v_inv.role = 'owner' then
    update public.restaurants set owner_id = v_uid where id = v_inv.restaurant_id;
  end if;

  update public.restaurant_invites set use_count = use_count + 1 where id = v_inv.id;

  ok := true;
  message := 'Success';
  granted_role := v_inv.role;
  out_restaurant_id := v_inv.restaurant_id;
  return next;
end;
$$;

grant execute on function public.redeem_restaurant_invite(text) to authenticated;

-- =====================================================================
-- 4/4  REQUIRED: make YOURSELF an operator (so you can see the test
-- restaurant + the Admin Access Codes screen). Replace the email, then run.
-- =====================================================================
update public.profiles set is_operator = true
 where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- Verify it worked (expect is_operator = true for your row):
select email, p.is_operator
  from public.profiles p
  join auth.users u on u.id = p.id
 where u.email = 'YOUR_EMAIL_HERE';
