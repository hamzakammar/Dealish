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
