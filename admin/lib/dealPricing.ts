// Admin-local mirror of the app's deal-pricing rules. The React Native app owns
// utils/dealPricing.ts, but that module transitively imports the RN Supabase
// client, so it can't be imported into this separate Next.js app. This file
// keeps the SAME semantics (fixed_price vs amount_off) in one place for the
// admin, with zero runtime imports.

export type PricingType = "fixed_price" | "amount_off";
export type DiscountType = "percent" | "fixed" | "bogo";

export const PRICING_TYPES: { key: PricingType; label: string }[] = [
  { key: "amount_off", label: "Amount off" },
  { key: "fixed_price", label: "Fixed price" },
];

export function resolvePricingType(pricingType: string | null | undefined): PricingType {
  return pricingType === "fixed_price" ? "fixed_price" : "amount_off";
}

// Normalize legacy/admin discount vocab ("percentage") to the DB value ("percent").
export function normalizeDiscountType(value: string | null | undefined): DiscountType | null {
  if (value === "percentage" || value === "percent") return "percent";
  if (value === "fixed") return "fixed";
  if (value === "bogo") return "bogo";
  return null;
}

function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `$${str}`;
}

export type PricingFormInput = {
  pricingType: PricingType;
  price?: string | number | null;
  discountType?: string | null;
  discountValue?: string | number | null;
  originalPrice?: string | number | null;
};

export type PricingPayload = {
  pricing_type: PricingType;
  price: number | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  original_price: number | null;
};

// Build the pricing columns for a deal insert/update. Incompatible fields are
// explicit null so switching type on an EDIT clears stale DB values, and a
// fixed_price deal can never carry discount data (keeps savings math at 0).
export function buildDealPricingFields(input: PricingFormInput): PricingPayload {
  if (input.pricingType === "fixed_price") {
    return {
      pricing_type: "fixed_price",
      price: toNumberOrNull(input.price),
      discount_type: null,
      discount_value: null,
      original_price: null,
    };
  }
  const discountType = normalizeDiscountType(input.discountType);
  return {
    pricing_type: "amount_off",
    price: null,
    discount_type: discountType,
    discount_value: discountType === "bogo" ? null : toNumberOrNull(input.discountValue),
    original_price: toNumberOrNull(input.originalPrice),
  };
}

// Returns an error message, or null when valid. Validates only the fields
// relevant to the chosen pricing type.
export function validateDealPricing(input: PricingFormInput): string | null {
  if (input.pricingType === "fixed_price") {
    const price = toNumberOrNull(input.price);
    if (price === null || price <= 0) return "Enter a price greater than 0.";
    return null;
  }
  const discountType = normalizeDiscountType(input.discountType);
  if (!discountType) return "Choose a discount type.";
  if (discountType === "percent") {
    const pct = toNumberOrNull(input.discountValue);
    if (pct === null || pct <= 0 || pct > 100) return "Discount percentage must be between 1 and 100.";
  }
  if (discountType === "fixed") {
    const amt = toNumberOrNull(input.discountValue);
    if (amt === null || amt <= 0) return "Discount amount must be greater than 0.";
  }
  return null;
}

// The label shown in the admin deal list (lowercase "off" to match existing style).
export function formatDealPriceLabel(deal: {
  pricing_type?: string | null;
  price?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
}): string | null {
  if (resolvePricingType(deal.pricing_type) === "fixed_price") {
    if (deal.price == null || Number.isNaN(Number(deal.price)) || Number(deal.price) < 0) return null;
    return formatPrice(Number(deal.price));
  }
  const dt = normalizeDiscountType(deal.discount_type);
  if (dt === "percent") return deal.discount_value ? `${deal.discount_value}% off` : null;
  if (dt === "fixed") return deal.discount_value ? `$${deal.discount_value} off` : null;
  if (dt === "bogo") return "BOGO";
  return null;
}
