-- SECURITY: replace the static/replayable QR-token redemption with a single-use,
-- expiring, customer-bound token flow.
--
-- Problem (old flow): the customer QR encoded deals.qr_code_token (minted once,
-- never rotates, never expires) PLUS the customer's user_id in plaintext.
-- redeem_deal_scan(p_deal_id, p_token, p_user_id) trusted p_user_id verbatim, so
-- the QR was replayable and the credited customer was spoofable.
--
-- New flow: the customer calls mint_redemption(deal_id) which issues a fresh
-- random token (+PIN) bound server-side to auth.uid(), stored only as a hash,
-- with a 20-minute expiry. The QR encodes ONLY that token. The merchant scans it
-- and calls redeem_redemption_token(token); the server derives the customer from
-- the redemption row (never from client input), marks the token used (single-use),
-- and credits that customer's visit/savings/recent-activity.
--
-- Idempotency: redeem matches only status='issued' and flips it to 'used', so a
-- replay of the same token finds nothing on the second attempt.
--
-- Requires: pgcrypto (gen_random_bytes/digest), the redemptions table, is_merchant(),
-- is_deal_active_now(), and profiles.recents as jsonb (APPLY_core_fixes.sql).
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) mint_redemption: re-issue-safe. Voids any prior UNUSED issued token for
--    this (user, deal) so re-opening the QR modal rotates the token instead of
--    erroring, and blocks only when the user has already USED a redemption today.
-- ---------------------------------------------------------------------------
create or replace function public.mint_redemption(p_deal_id uuid)
returns table(redemption_id uuid, token text, pin text, expires_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text;
  v_pin   text;
  v_expires_at timestamptz;
  v_deal public.deals;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_deal from public.deals d where d.id = p_deal_id;
  if not found then raise exception 'Deal not found'; end if;
  if not public.is_deal_active_now(v_deal) then raise exception 'Deal is not active'; end if;
  if not exists (
    select 1 from public.restaurants r where r.id = v_deal.restaurant_id and r.is_active = true
  ) then raise exception 'Restaurant is not active'; end if;

  -- One successful redemption per user per deal per day.
  if exists (
    select 1 from public.redemptions r
    where r.user_id = auth.uid()
      and r.deal_id = p_deal_id
      and r.status  = 'used'
      and r.used_at >= date_trunc('day', now())
      and r.used_at <  date_trunc('day', now()) + interval '1 day'
  ) then raise exception 'Already redeemed today'; end if;

  -- Rotate: expire any still-issued (unused) tokens for this pair so only the
  -- freshly minted QR is valid.
  update public.redemptions
    set status = 'expired'
    where user_id = auth.uid() and deal_id = p_deal_id and status = 'issued';

  v_token := encode(gen_random_bytes(16), 'hex');
  v_pin   := lpad(floor(random() * 10000)::int::text, 4, '0');
  v_expires_at := now() + interval '20 minutes';

  insert into public.redemptions (deal_id, user_id, token_hash, pin_hash, status, issued_at, expires_at)
  values (
    p_deal_id, auth.uid(),
    encode(digest(v_token, 'sha256'), 'hex'),
    encode(digest(v_pin, 'sha256'), 'hex'),
    'issued', now(), v_expires_at
  )
  returning id into redemption_id;

  token := v_token; pin := v_pin; expires_at := v_expires_at;
  return next;
end;
$$;

grant execute on function public.mint_redemption(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) redeem_redemption_token: merchant-side redeem. Accepts the token OR the PIN
--    (same hash column semantics as verify_redemption), derives the customer from
--    the bound row, marks it used, and credits that customer's stats.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_redemption_token(p_token text)
returns table (
  ok                boolean,
  message           text,
  saved_amount      numeric,
  deal_title        text,
  out_restaurant_id uuid,
  restaurant_name   text,
  out_user_id       uuid
)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_hash       text;
  v_red        public.redemptions;
  v_deal       public.deals;
  v_restaurant public.restaurants;
  v_is_admin   boolean := false;
  v_savings    numeric := 0;
  v_now        timestamptz := now();
begin
  ok := false;
  saved_amount := 0;

  if auth.uid() is null then message := 'Not authenticated'; return next; return; end if;
  if not public.is_merchant() then message := 'Not authorized to redeem'; return next; return; end if;
  if p_token is null or length(trim(p_token)) = 0 then
    message := 'Missing code'; return next; return;
  end if;

  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  -- Single-use: only 'issued', unexpired rows are eligible. A replay of the same
  -- token after redemption finds nothing (status is now 'used').
  select r.* into v_red
  from public.redemptions r
  where r.status = 'issued'
    and (r.expires_at is null or r.expires_at >= v_now)
    and (r.token_hash = v_hash or r.pin_hash = v_hash)
  order by r.issued_at desc
  limit 1;

  if not found then message := 'Invalid, expired, or already-used code'; return next; return; end if;

  select * into v_deal from public.deals d where d.id = v_red.deal_id;
  if not found then message := 'Deal not found'; return next; return; end if;

  if not public.is_deal_active_now(v_deal) then
    message := 'Deal is not active right now'; return next; return;
  end if;

  select * into v_restaurant from public.restaurants r where r.id = v_deal.restaurant_id;
  if not found or v_restaurant.is_active = false then
    message := 'Restaurant is not active'; return next; return;
  end if;

  -- Owners may only redeem for their own restaurants; admins may redeem anywhere.
  if not v_is_admin and v_restaurant.owner_id <> auth.uid() then
    message := 'This deal is not for your restaurant'; return next; return;
  end if;

  -- Mark used FIRST (guards against concurrent double-redeem of the same token).
  update public.redemptions
    set status = 'used', used_at = v_now, used_by_merchant_id = auth.uid()
    where id = v_red.id and status = 'issued';
  if not found then message := 'Code was just redeemed'; return next; return; end if;

  -- Savings calc mirrors utils/activity.ts calculateSavings().
  v_savings := case
    when v_deal.discount_type = 'percent'
         and v_deal.discount_value is not null
         and v_deal.original_price is not null
      then round(v_deal.original_price * v_deal.discount_value / 100.0, 2)
    when v_deal.discount_type = 'fixed' then coalesce(v_deal.discount_value, 0)
    when v_deal.discount_type = 'bogo'  then coalesce(v_deal.original_price, 0)
    else 0
  end;

  -- Analytics row (customer derived from the bound redemption, not from client input).
  insert into public.qr_code_scans (deal_id, restaurant_id, user_id, scanned_at)
  values (v_red.deal_id, v_deal.restaurant_id, v_red.user_id, v_now);

  -- Attribute the redemption to the CUSTOMER.
  update public.profiles
  set num_visits   = coalesce(num_visits, 0) + 1,
      amount_saved = coalesce(amount_saved, 0) + v_savings,
      recents      = coalesce(recents, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'restaurant_id',    v_deal.restaurant_id,
          'activity_type',    'redemption',
          'deal_id',          v_red.deal_id,
          'deal_description', v_deal.title,
          'amount_saved',     v_savings,
          'created_at',       v_now
        )
      )
  where id = v_red.user_id;

  ok               := true;
  message          := 'Redeemed';
  saved_amount     := v_savings;
  deal_title       := v_deal.title;
  out_restaurant_id := v_deal.restaurant_id;
  restaurant_name  := v_restaurant.name;
  out_user_id      := v_red.user_id;
  return next;
end;
$$;

grant execute on function public.redeem_redemption_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Neutralize the insecure legacy RPC so it can't be called even if an older
--    setup script re-creates it. The app no longer references it.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_deal_scan(p_deal_id uuid, p_token text, p_user_id uuid)
returns table (
  ok boolean, message text, saved_amount numeric, deal_title text,
  out_restaurant_id uuid, restaurant_name text
)
language plpgsql security definer set search_path to 'public' as $$
begin
  ok := false;
  message := 'redeem_deal_scan is deprecated; use mint_redemption + redeem_redemption_token';
  saved_amount := 0;
  return next;
end;
$$;
