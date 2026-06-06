-- TEMPORARY QA seed so the redeem-invite SUCCESS path can be tested on-device.
-- Scoped to the existing test restaurant (John's Food Emporium, already is_test)
-- and uses an 'admin' invite so NO restaurant ownership is transferred.
-- Run in the Supabase SQL editor. Reverse with QA_cleanup_invite.sql afterwards.

-- 1) let the QA account see the operator-only "Admin Access Codes" screen
update public.profiles
   set is_operator = true
 where id = '41995df0-4f14-421c-a481-5e0a62fb96d1';  -- dealishsoftware1@gmail.com

-- 2) a valid, single-use, 1-day admin invite (code: TESTADMIN)
insert into public.restaurant_invites (code, restaurant_id, role, note, max_uses, expires_at)
values ('TESTADMIN',
        '2d63f4b5-f38a-4dff-b4e1-45a421754f63',   -- existing test restaurant
        'admin',
        'temp QA invite for on-device testing',
        1,
        now() + interval '1 day')
on conflict (code)
  do update set use_count = 0,
                max_uses = excluded.max_uses,
                expires_at = excluded.expires_at;
