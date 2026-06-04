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
