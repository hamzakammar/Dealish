-- DEBT-003: The merchant QR-scan flow could not work under RLS.
--
-- The scanner runs on the OWNER/ADMIN device, but it tried to:
--   1. INSERT into qr_code_scans with user_id = the CUSTOMER  → blocked by the
--      "Users can insert their own scans" policy (CHECK auth.uid() = user_id), and
--   2. UPDATE the CUSTOMER's profiles row (recents/stats)     → blocked by
--      profiles_update_own (id = auth.uid()).
-- Both writes silently failed, so scans recorded nothing and customer savings/
-- recent-activity never updated.
--
-- This SECURITY DEFINER RPC performs the redemption server-side: it validates the
-- token, deal-active, restaurant-active, and merchant ownership, then records the
-- scan and attributes visit/savings/recent-activity to the CUSTOMER. The merchant
-- device calls it via supabase.rpc('redeem_deal_scan', ...).
--
-- Requires: change_recents_to_jsonb.sql applied first (recents must be jsonb).

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
