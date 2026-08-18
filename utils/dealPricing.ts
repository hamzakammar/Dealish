import { Deal } from "@/types/restaurant";
import { calculateSavings } from "@/utils/activity";

/**
 * Explicit deal pricing types. See database/migrations/add_deal_pricing_types.sql.
 * - 'amount_off'  — discount off a regular price ("20% OFF" / "$5 OFF" / BOGO).
 *                   Uses discount_type/discount_value/original_price + savings math.
 * - 'fixed_price' — a flat special price ("$10"). No savings, no regular price.
 */
export type PricingType = 'fixed_price' | 'amount_off';

export const PRICING_TYPES: PricingType[] = ['amount_off', 'fixed_price'];

export type DiscountType = 'percent' | 'fixed' | 'bogo';

/** Fields the shared formatter/validator reads — a subset of Deal. */
type DealPricingFields = Pick<
  Deal,
  'pricing_type' | 'price' | 'discount_type' | 'discount_value' | 'original_price' | 'savings_amount'
>;

/**
 * Resolve a deal's pricing type, defaulting legacy rows (written before this
 * column existed, or objects that never set it) to 'amount_off' — which is
 * exactly how the migration backfills them.
 */
export function resolvePricingType(deal: Pick<Deal, 'pricing_type'>): PricingType {
  return deal.pricing_type === 'fixed_price' ? 'fixed_price' : 'amount_off';
}

export function isFixedPrice(deal: Pick<Deal, 'pricing_type'>): boolean {
  return resolvePricingType(deal) === 'fixed_price';
}

/** Format a number as a price with no trailing ".00" (10 => "$10", 10.5 => "$10.50"). */
export function formatPrice(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `$${str}`;
}

/**
 * The single source of truth for a deal's headline pricing label — the chip
 * shown on every consumer card. Returns null when there is nothing to show.
 *
 * - fixed_price: "$10" (never "off", never savings)
 * - amount_off:  "20% OFF" / "$5 OFF" / "BOGO"
 */
export function formatDealPriceLabel(deal: DealPricingFields): string | null {
  if (resolvePricingType(deal) === 'fixed_price') {
    if (deal.price == null || Number.isNaN(Number(deal.price)) || Number(deal.price) < 0) return null;
    return formatPrice(Number(deal.price));
  }

  // amount_off
  switch (deal.discount_type) {
    case 'percent':
      return deal.discount_value ? `${deal.discount_value}% OFF` : null;
    case 'fixed':
      return deal.discount_value ? `$${deal.discount_value} OFF` : null;
    case 'bogo':
      return 'BOGO';
    default:
      return null;
  }
}

/**
 * Dollar savings for a deal. ALWAYS 0 for fixed-price deals — they express a
 * price, not a discount, and (per product) never count as money saved. For
 * amount_off deals it prefers a server-provided savings_amount, else the
 * existing client calculation.
 */
export function getDealSavings(deal: DealPricingFields): number {
  if (resolvePricingType(deal) === 'fixed_price') return 0;
  return deal.savings_amount ?? calculateSavings(deal);
}

/** Whether a "Save $X" line should render for this deal. */
export function shouldShowSavings(deal: DealPricingFields): boolean {
  return getDealSavings(deal) > 0;
}

// ---------------------------------------------------------------------------
// Form helpers — shared by the Next.js admin and the RN in-app deal form so
// both build identical, type-correct payloads and validate the same way.
// ---------------------------------------------------------------------------

/** Raw string/number inputs a deal form collects for pricing. */
export type PricingFormInput = {
  pricingType: PricingType;
  /** fixed_price: the flat price. */
  price?: string | number | null;
  /** amount_off: discount kind. */
  discountType?: DiscountType | null;
  /** amount_off: percentage (percent) or dollars off (fixed). */
  discountValue?: string | number | null;
  /** amount_off: optional regular price used to compute savings. */
  originalPrice?: string | number | null;
};

/** DB pricing columns a deal form writes. Incompatible fields are explicit null
 *  (not undefined) so that switching type on EDIT clears stale DB values. */
export type PricingPayload = {
  pricing_type: PricingType;
  price: number | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  original_price: number | null;
};

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the pricing columns for a deal insert/update from form input. Only the
 * fields relevant to the chosen type are populated; everything on the other
 * side is set to null so a fixed_price deal can never carry stale discount data
 * (and vice-versa). Used identically for create and edit.
 */
export function buildDealPricingFields(input: PricingFormInput): PricingPayload {
  if (input.pricingType === 'fixed_price') {
    return {
      pricing_type: 'fixed_price',
      price: toNumberOrNull(input.price),
      discount_type: null,
      discount_value: null,
      original_price: null,
    };
  }
  return {
    pricing_type: 'amount_off',
    price: null,
    discount_type: (input.discountType ?? null) as DiscountType | null,
    discount_value: input.discountType === 'bogo' ? null : toNumberOrNull(input.discountValue),
    original_price: toNumberOrNull(input.originalPrice),
  };
}

/**
 * Validate pricing form input for the selected type. Returns an error message,
 * or null when valid. Only validates fields relevant to the chosen type.
 */
export function validateDealPricing(input: PricingFormInput): string | null {
  if (input.pricingType === 'fixed_price') {
    const price = toNumberOrNull(input.price);
    if (price === null || price <= 0) return 'Enter a price greater than 0.';
    return null;
  }

  // amount_off
  if (!input.discountType) return 'Choose a discount type.';
  if (input.discountType === 'percent') {
    const pct = toNumberOrNull(input.discountValue);
    if (pct === null || pct <= 0 || pct > 100) return 'Discount percentage must be between 1 and 100.';
  }
  if (input.discountType === 'fixed') {
    const amt = toNumberOrNull(input.discountValue);
    if (amt === null || amt <= 0) return 'Discount amount must be greater than 0.';
  }
  // bogo needs no value. original_price is optional; validate only if present.
  const original = input.originalPrice;
  if (original !== undefined && original !== null && original !== '') {
    const price = toNumberOrNull(original);
    if (price === null || price <= 0) return 'Original price must be greater than 0.';
  }
  return null;
}
