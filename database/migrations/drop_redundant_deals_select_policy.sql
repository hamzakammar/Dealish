-- DEBT-002: `deals` had two permissive public SELECT policies:
--   - deals_public_read_active_now : is_deal_active_now(deals) AND restaurant active
--   - "Public can view active deals" : is_active = true
-- Permissive policies are OR'd, so the looser is_active=true policy always won and
-- the time-window policy did nothing.
--
-- RESOLUTION (non-breaking): drop the no-op time-window policy and KEEP is_active.
-- We intentionally do NOT enforce schedule gating at the DB layer because the app
-- fetches upcoming deals (e.g. "starting within 1 hour") and filters by time on the
-- client (hooks/useActiveDealsMap.ts). Enforcing is_deal_active_now in RLS would
-- hide those upcoming deals and break that feature.
--
-- Net effect: identical public visibility (is_active = true), minus the misleading
-- dead policy.

DROP POLICY IF EXISTS deals_public_read_active_now ON public.deals;
