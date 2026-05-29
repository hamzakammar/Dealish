-- DEBT-016: profiles.recents is declared uuid[] in the live DB, but the app
-- (utils/activity.ts, app/account.tsx) reads/writes activity OBJECTS:
--   { restaurant_id, activity_type, deal_id, deal_description, amount_saved, created_at }
-- Writing objects into a uuid[] column silently fails, so visit/savings/recent-
-- activity tracking is broken app-wide. Change the column to jsonb to match usage.
--
-- Existing uuid[] data (if any) is converted to a JSON array of id strings, which
-- the app harmlessly ignores (activity_type is undefined → filtered out).
--
-- Apply BEFORE add_redeem_deal_scan_rpc.sql (the RPC appends jsonb to recents).

ALTER TABLE public.profiles
  ALTER COLUMN recents DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN recents TYPE jsonb
  USING (
    CASE
      WHEN recents IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(recents)
    END
  );

ALTER TABLE public.profiles
  ALTER COLUMN recents SET DEFAULT '[]'::jsonb;

-- Backfill nulls so the app never sees NULL recents.
UPDATE public.profiles SET recents = '[]'::jsonb WHERE recents IS NULL;
