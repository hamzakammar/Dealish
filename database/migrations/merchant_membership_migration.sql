-- ============================================================================
-- Phase 2: Merchant Membership Migration
-- Updates RLS and RPCs to use restaurant_members instead of owner_id
-- ============================================================================

-- 1) RE-SECURE RESTAURANTS ----------------------------------------------------
-- Allow managers to view and update their restaurants.
drop policy if exists "Restaurant owners and admins can view scans" on public.qr_code_scans;
create policy "Restaurant owners and admins can view scans"
  on public.qr_code_scans
  for select
  using (
    public.is_restaurant_manager(restaurant_id)
    or public.is_platform_operator()
  );

drop policy if exists "Enable all for owners" on public.restaurants;
create policy "Managers can select their restaurants"
  on public.restaurants
  for select
  to authenticated
  using (
    public.is_restaurant_manager(id)
    or public.is_platform_operator()
  );

create policy "Managers can update their restaurants"
  on public.restaurants
  for update
  to authenticated
  using (
    public.is_restaurant_manager(id)
    or public.is_platform_operator()
  )
  with check (
    public.is_restaurant_manager(id)
    or public.is_platform_operator()
  );

-- 2) RE-SECURE INVENTORY ------------------------------------------------------
-- Scoped to restaurant managers.
drop policy if exists "Restaurant owners can view their products" on public.products;
create policy "Restaurant owners can view their products"
  on public.products
  for select
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can insert their products" on public.products;
create policy "Restaurant owners can insert their products"
  on public.products
  for insert
  with check (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can update their products" on public.products;
create policy "Restaurant owners can update their products"
  on public.products
  for update
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can delete their products" on public.products;
create policy "Restaurant owners can delete their products"
  on public.products
  for delete
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

-- Similar for inventory_items
drop policy if exists "Restaurant owners can view their inventory items" on public.inventory_items;
create policy "Restaurant owners can view their inventory items"
  on public.inventory_items
  for select
  using (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

drop policy if exists "Restaurant owners can insert their inventory items" on public.inventory_items;
create policy "Restaurant owners can insert their inventory items"
  on public.inventory_items
  for insert
  with check (public.is_restaurant_manager(restaurant_id) or public.is_platform_operator());

-- 3) UPDATE RPC: redeem_deal_scan ---------------------------------------------
-- Use is_restaurant_manager to authorize redemption.
create or replace function public.redeem_deal_scan(
  p_deal_id uuid,
  p_token   text,
  p_user_id uuid
)
returns table (
  ok              boolean,
  message         text,
  saved_amount    numeric,
  deal_title      text,
  out_restaurant_id   uuid,
  restaurant_name text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_deal       public.deals;
  v_restaurant public.restaurants;
  v_savings    numeric := 0;
begin
  ok := false;
  saved_amount := 0;

  if auth.uid() is null then
    message := 'Not authenticated'; return next; return;
  end if;

  select * into v_deal from public.deals d where d.id = p_deal_id;
  if not found then
    message := 'Deal not found'; return next; return;
  end if;

  if not (public.is_restaurant_manager(v_deal.restaurant_id) or public.is_platform_operator()) then
    message := 'Not authorized to redeem for this restaurant'; return next; return;
  end if;

  if v_deal.qr_code_token is null or v_deal.qr_code_token <> p_token then
    message := 'Invalid or expired QR code'; return next; return;
  end if;

  if not public.is_deal_active_now(v_deal) then
    message := 'Deal is not active right now'; return next; return;
  end if;

  select * into v_restaurant from public.restaurants r where r.id = v_deal.restaurant_id;
  if not found or v_restaurant.is_active = false then
    message := 'Restaurant is not active'; return next; return;
  end if;

  -- Savings calc mirrors utils/activity.ts calculateSavings().
  v_savings := case
    when v_deal.discount_type = 'percent'
         AND v_deal.discount_value IS NOT NULL
         AND v_deal.original_price IS NOT NULL
      then round(v_deal.original_price * v_deal.discount_value / 100.0, 2)
    when v_deal.discount_type = 'fixed' then coalesce(v_deal.discount_value, 0)
    when v_deal.discount_type = 'bogo'  then coalesce(v_deal.original_price, 0)
    else 0
  end;

  -- Record the scan.
  insert into public.qr_code_scans (deal_id, restaurant_id, user_id, scanned_at)
  values (p_deal_id, v_deal.restaurant_id, p_user_id, now());

  -- Attribute the redemption to the CUSTOMER.
  update public.profiles
  set num_visits   = coalesce(num_visits, 0) + 1,
      amount_saved = coalesce(amount_saved, 0) + v_savings,
      recents      = coalesce(recents, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'restaurant_id',    v_deal.restaurant_id,
          'activity_type',    'redemption',
          'deal_id',          p_deal_id,
          'deal_description', v_deal.title,
          'amount_saved',     v_savings,
          'created_at',       now()
        )
      )
  where id = p_user_id;

  ok               := true;
  message          := 'Redeemed';
  saved_amount     := v_savings;
  deal_title       := v_deal.title;
  out_restaurant_id := v_deal.restaurant_id;
  restaurant_name  := v_restaurant.name;
  return next;
end;
$function$;

grant execute on function public.redeem_deal_scan(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
