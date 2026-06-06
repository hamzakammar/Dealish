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
