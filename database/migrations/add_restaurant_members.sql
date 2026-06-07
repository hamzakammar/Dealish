-- Multi-manager restaurants: many people can manage one restaurant.
--
-- Before this, "who manages a restaurant" was the single `restaurants.owner_id`
-- FK, so an 'owner' invite TRANSFERRED the restaurant (locked out the first
-- owner) and only the platform operator (is_operator) could mint codes. This adds
-- a membership join table so a restaurant can have many managers/staff, lets
-- managers invite their own team, and closes a pre-existing deals-RLS hole where
-- ANY owner/admin could edit ANY restaurant's deals.
--
-- Roles (unchanged values): 'owner' = manages the restaurant (dashboard),
-- 'admin' = scan-staff (QR scanner only). All managers are equal (no tiers).
-- Idempotent / additive. Apply after add_restaurant_invites.sql.

-- PREFLIGHT (run these first; they decide whether anyone gets locked out) --------
--   a) Your founder/admin account MUST be a platform operator, or you lose the
--      ability to manage restaurants you don't personally own after this:
--        select id, email, role, is_operator from public.profiles where is_operator;
--      If yours isn't there:  update public.profiles set is_operator = true
--        where id = '<your-user-id>';   -- run in the SQL editor (postgres role)
--   b) Restaurants with no owner are managed by NOBODY in the dashboard after this
--      (operators can still reach them via API). Review them:
--        select id, name from public.restaurants where owner_id is null;
--      Assign an owner where appropriate, or rely on operator access.

-- 1) membership table ----------------------------------------------------------
create table if not exists public.restaurant_members (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references public.profiles(id)    on delete cascade,
  role          text not null default 'owner' check (role in ('owner','admin')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index if not exists idx_restaurant_members_user       on public.restaurant_members(user_id);
create index if not exists idx_restaurant_members_restaurant on public.restaurant_members(restaurant_id);

-- Backfill: every current owner becomes an 'owner' member, so nothing changes for
-- existing owners and owner_id stays valid as the "primary owner" pointer.
insert into public.restaurant_members (restaurant_id, user_id, role)
  select id, owner_id, 'owner' from public.restaurants where owner_id is not null
  on conflict (restaurant_id, user_id) do nothing;

-- 2) helpers (SECURITY DEFINER so RLS policies that call them don't recurse) -----
-- Is the current user an owner-level member of (or the legacy owner_id of) a
-- restaurant? Used by invites + deals RLS to scope writes to your own restaurant.
create or replace function public.is_restaurant_manager(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ) or exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.owner_id = auth.uid()
  );
$$;

-- Platform operator (founder/staff) -> god-mode over every restaurant.
create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator);
$$;

-- Only authenticated users ever evaluate these (all dependent policies are `to
-- authenticated`); keep them off PUBLIC/anon so they can't be probed.
revoke all on function public.is_restaurant_manager(uuid) from public;
revoke all on function public.is_platform_operator()       from public;
grant execute on function public.is_restaurant_manager(uuid) to authenticated;
grant execute on function public.is_platform_operator()       to authenticated;

-- 2b) HARDEN self-escalation: the existing trigger only blocked `role` changes by
-- app users, but profiles_update_own (id = auth.uid()) lets a user write ANY of
-- their own columns -- including is_operator, which now grants platform god-mode
-- over deals/invites. Extend the guard to is_operator too. (current_user is the
-- definer inside our SECURITY DEFINER RPCs and 'postgres' in the SQL editor, so
-- the legitimate invite/admin flows are unaffected.)
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (NEW.role is distinct from OLD.role
          or NEW.is_operator is distinct from OLD.is_operator) then
    raise exception 'role/operator can only be changed via an authorized invite/admin flow';
  end if;
  return NEW;
end;
$$;
-- trigger trg_prevent_role_escalation already exists (add_restaurant_invites.sql).

-- 3) RLS on restaurant_members -------------------------------------------------
alter table public.restaurant_members enable row level security;

drop policy if exists restaurant_members_select on public.restaurant_members;
create policy restaurant_members_select on public.restaurant_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_restaurant_manager(restaurant_id)
    or public.is_platform_operator()
  );

drop policy if exists restaurant_members_insert on public.restaurant_members;
create policy restaurant_members_insert on public.restaurant_members
  for insert to authenticated
  with check (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists restaurant_members_delete on public.restaurant_members;
create policy restaurant_members_delete on public.restaurant_members
  for delete to authenticated
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

-- 4) invites RLS: operators OR a manager of THAT restaurant ---------------------
drop policy if exists invites_operator_all on public.restaurant_invites;
drop policy if exists invites_manager_all  on public.restaurant_invites;
create policy invites_manager_all on public.restaurant_invites
  for all to authenticated
  using     (public.is_platform_operator() or public.is_restaurant_manager(restaurant_id))
  with check (public.is_platform_operator() or public.is_restaurant_manager(restaurant_id));

-- 5) redeem RPC: ADD a membership (never transfer ownership) --------------------
create or replace function public.redeem_restaurant_invite(p_code text)
returns table (ok boolean, message text, granted_role text, out_restaurant_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inv      public.restaurant_invites;
  v_uid      uuid := auth.uid();
  v_new_role text;
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

  -- Atomically claim one use. The conditional UPDATE + row lock serializes
  -- concurrent redemptions, so a single-use code cannot be over-redeemed (TOCTOU).
  update public.restaurant_invites
     set use_count = use_count + 1
   where id = v_inv.id and use_count < max_uses;
  if not found then
    message := 'This code has already been used'; return next; return;
  end if;

  insert into public.restaurant_invite_redemptions (invite_id, user_id)
  values (v_inv.id, v_uid)
  on conflict (invite_id, user_id) do nothing;

  -- Add the caller as a member (or UPGRADE their role; never downgrade an existing
  -- owner to admin). Many managers per restaurant are allowed.
  insert into public.restaurant_members (restaurant_id, user_id, role, created_by)
  values (v_inv.restaurant_id, v_uid, v_inv.role, v_inv.created_by)
  on conflict (restaurant_id, user_id) do update
    set role = case when public.restaurant_members.role = 'owner' then 'owner'
                    else excluded.role end;

  -- Keep owner_id as a "primary owner" pointer, but never steal an existing one.
  if v_inv.role = 'owner' then
    update public.restaurants set owner_id = v_uid
      where id = v_inv.restaurant_id and owner_id is null;
  end if;

  -- Landing role = highest role the user now holds across all their restaurants.
  select case
           when exists (select 1 from public.restaurant_members m
                         where m.user_id = v_uid and m.role = 'owner') then 'owner'
           when exists (select 1 from public.restaurant_members m
                         where m.user_id = v_uid and m.role = 'admin') then 'admin'
           else 'user'
         end
    into v_new_role;
  update public.profiles set role = v_new_role where id = v_uid;

  ok := true;
  message := 'Success';
  granted_role := v_inv.role;
  out_restaurant_id := v_inv.restaurant_id;
  return next;
end;
$$;

grant execute on function public.redeem_restaurant_invite(text) to authenticated;

-- 6) CLOSE THE HOLE: deals writes scoped to managers of that restaurant ---------
-- Previously every deals policy had `OR (profiles.role IN ('owner','admin'))`,
-- which let ANY owner/admin edit ANY restaurant's deals. Replace with a
-- per-restaurant manager check; platform operators keep god-mode. The public
-- "view active deals" policy is untouched (customers still read live deals).
-- Scoped `to authenticated` so anonymous customers only ever hit the public
-- "view active deals" policy below (no per-row manager check on the read hot path).
drop policy if exists "Restaurant owners can view their deals"   on public.deals;
create policy "Restaurant owners can view their deals" on public.deals
  for select to authenticated
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can insert their deals" on public.deals;
create policy "Restaurant owners can insert their deals" on public.deals
  for insert to authenticated
  with check (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can update their deals" on public.deals;
create policy "Restaurant owners can update their deals" on public.deals
  for update to authenticated
  using      (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator())
  with check (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can delete their deals" on public.deals;
create policy "Restaurant owners can delete their deals" on public.deals
  for delete to authenticated
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

notify pgrst, 'reload schema';
