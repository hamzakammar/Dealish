-- ============================================================================
-- Explicit deal pricing types: fixed_price vs amount_off
-- ----------------------------------------------------------------------------
-- Adds a first-class distinction between the two ways a deal expresses value:
--
--   * amount_off  — the existing behavior. A discount off a regular price:
--                   "20% OFF", "$5 OFF", or BOGO. Uses discount_type /
--                   discount_value / original_price and the existing savings
--                   math. This is the DEFAULT, so every pre-existing row is
--                   classified as amount_off — no production data is rewritten.
--
--   * fixed_price — a flat special price: "Today this item is $10". Stores the
--                   price in `price` and displays just "$10". It has NO savings
--                   and does NOT require a regular price.
--
-- Backward compatibility: existing rows backfill to amount_off via the column
-- default, preserving their exact current semantics.
--
-- How fixed-price deals are guaranteed to NEVER be counted as money saved
-- (the audit requirement) — WITHOUT rewriting the redemption RPC:
--   Every savings calculation, both the SQL redemption RPCs
--   (redeem_redemption_token / redeem_deal_scan: `case when discount_type = …
--   else 0 end`) and the client mirror (utils/activity.ts calculateSavings:
--   `if (!discount_type) return 0`), keys off discount_type. The
--   `deals_fixed_price_no_discount` constraint below forces a fixed_price deal
--   to have discount_type IS NULL, so every one of those CASE/branch paths
--   falls through to 0 for fixed-price deals. No RPC changes required.
-- ============================================================================

alter table public.deals
  add column if not exists pricing_type text not null default 'amount_off'
    check (pricing_type in ('fixed_price', 'amount_off'));

alter table public.deals
  add column if not exists price numeric;

comment on column public.deals.pricing_type is
  'How the deal expresses value: amount_off (discount off a regular price — uses discount_type/discount_value/original_price) or fixed_price (a flat special price stored in `price`, shown as "$X", no savings).';
comment on column public.deals.price is
  'The flat special price for a fixed_price deal (e.g. 10.00 => "$10"). NULL for amount_off deals.';

-- A fixed_price deal must carry a price. All existing rows are amount_off, so
-- they satisfy this trivially — safe to add as a validated constraint.
alter table public.deals
  drop constraint if exists deals_fixed_price_requires_price;
alter table public.deals
  add constraint deals_fixed_price_requires_price
    check (pricing_type <> 'fixed_price' or price is not null);

-- A fixed_price deal must NOT carry discount fields. This is the invariant that
-- makes the existing savings math yield 0 for fixed-price deals everywhere.
alter table public.deals
  drop constraint if exists deals_fixed_price_no_discount;
alter table public.deals
  add constraint deals_fixed_price_no_discount
    check (
      pricing_type <> 'fixed_price'
      or (discount_type is null and discount_value is null and original_price is null)
    );
