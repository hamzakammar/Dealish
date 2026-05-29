-- DEBT-005: restaurants.owner_id had a hardcoded default of a specific user id
-- (DEFAULT '41995df0-4f14-421c-a481-5e0a62fb96d1'::uuid). Any insert omitting
-- owner_id silently assigned that account. Require owner_id to be set explicitly.
--
-- The app always sets owner_id = auth.uid() on create, so dropping the default has
-- no effect on normal inserts; it only removes the footgun.

ALTER TABLE public.restaurants
  ALTER COLUMN owner_id DROP DEFAULT;
