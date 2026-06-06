-- Reverse QA_seed_invite.sql. Run after on-device testing of the redeem flow.
-- Resets the QA account back to a plain customer and removes the test invite.

update public.profiles
   set role = 'user',
       is_operator = false
 where id = '41995df0-4f14-421c-a481-5e0a62fb96d1';  -- dealishsoftware1@gmail.com

-- removes the invite and (via cascade) its redemption log row
delete from public.restaurant_invites where code = 'TESTADMIN';
