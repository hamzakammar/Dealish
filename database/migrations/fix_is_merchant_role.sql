-- DEBT-001: is_merchant() checks role = 'merchant', but profiles_role_check only
-- permits 'user' | 'owner' | 'admin'. So is_merchant() was ALWAYS false, which:
--   - made verify_redemption()/mint_redemption() unusable, and
--   - left every *_merchant_* RLS policy inert (harmless: legacy owner/admin
--     policies grant the same access).
--
-- Redefine it to recognize the roles that actually exist. This activates the
-- dormant merchant RLS policies, but they are scoped to owner_id = auth.uid(),
-- i.e. a subset of access the existing owner/admin policies already grant — so
-- this does not widen access. It simply makes the predicate correct.

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
