import { Deal } from '@/types/restaurant';
import {
  buildDealPricingFields,
  formatDealPriceLabel,
  getDealSavings,
  resolvePricingType,
  shouldShowSavings,
  validateDealPricing,
} from '@/utils/dealPricing';

// Minimal Deal factory — only pricing fields matter here.
function deal(partial: Partial<Deal>): Deal {
  return {
    id: 'd1',
    restaurant_id: 'r1',
    title: 'Test deal',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...partial,
  };
}

describe('formatDealPriceLabel — fixed_price', () => {
  it('shows just the price, no "off" / no savings language', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price', price: 10 }))).toBe('$10');
  });
  it('keeps cents when non-integer', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price', price: 10.5 }))).toBe('$10.50');
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price', price: 9.99 }))).toBe('$9.99');
  });
  it('ignores any stale discount fields entirely', () => {
    // A fixed_price deal must never render a discount even if stale data lingers.
    const label = formatDealPriceLabel(
      deal({ pricing_type: 'fixed_price', price: 12, discount_type: 'percent', discount_value: 50 }),
    );
    expect(label).toBe('$12');
  });
  it('returns null for missing/negative/NaN price', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price' }))).toBeNull();
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price', price: -1 }))).toBeNull();
    expect(formatDealPriceLabel(deal({ pricing_type: 'fixed_price', price: NaN }))).toBeNull();
  });
});

describe('formatDealPriceLabel — amount_off', () => {
  it('formats percent', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'amount_off', discount_type: 'percent', discount_value: 20 }))).toBe('20% OFF');
  });
  it('formats fixed dollars off', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'amount_off', discount_type: 'fixed', discount_value: 5 }))).toBe('$5 OFF');
  });
  it('formats bogo', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'amount_off', discount_type: 'bogo' }))).toBe('BOGO');
  });
  it('returns null when a value is required but missing', () => {
    expect(formatDealPriceLabel(deal({ pricing_type: 'amount_off', discount_type: 'percent' }))).toBeNull();
    expect(formatDealPriceLabel(deal({ pricing_type: 'amount_off', discount_type: 'fixed' }))).toBeNull();
  });
});

describe('legacy deal compatibility', () => {
  it('treats a deal with no pricing_type as amount_off', () => {
    expect(resolvePricingType(deal({}))).toBe('amount_off');
    // Legacy percent deal still formats as a discount.
    expect(formatDealPriceLabel(deal({ discount_type: 'percent', discount_value: 15 }))).toBe('15% OFF');
  });
  it('never treats a legacy discount deal as fixed_price', () => {
    const d = deal({ discount_type: 'fixed', discount_value: 8, original_price: 20 });
    expect(resolvePricingType(d)).toBe('amount_off');
    expect(getDealSavings(d)).toBe(8);
  });
});

describe('getDealSavings — fixed-price never counts as money saved', () => {
  it('is 0 for fixed_price even if a stale original_price/discount exists', () => {
    expect(getDealSavings(deal({ pricing_type: 'fixed_price', price: 10 }))).toBe(0);
    expect(
      getDealSavings(deal({ pricing_type: 'fixed_price', price: 10, discount_type: 'percent', discount_value: 50, original_price: 40 })),
    ).toBe(0);
    expect(shouldShowSavings(deal({ pricing_type: 'fixed_price', price: 10 }))).toBe(false);
  });
});

describe('getDealSavings — amount_off preserves existing behavior', () => {
  it('percent uses original_price', () => {
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'percent', discount_value: 20, original_price: 15 }))).toBe(3);
  });
  it('percent with no original_price cannot compute savings -> 0', () => {
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'percent', discount_value: 20 }))).toBe(0);
  });
  it('fixed dollars off = discount_value', () => {
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'fixed', discount_value: 5 }))).toBe(5);
  });
  it('bogo = original_price', () => {
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'bogo', original_price: 12 }))).toBe(12);
  });
  it('prefers a server-provided savings_amount', () => {
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'percent', discount_value: 20, original_price: 15, savings_amount: 4.25 }))).toBe(4.25);
  });
});

describe('null / malformed pricing data', () => {
  it('never throws and shows nothing', () => {
    const empty = deal({});
    expect(formatDealPriceLabel(empty)).toBeNull();
    expect(getDealSavings(empty)).toBe(0);
    expect(shouldShowSavings(empty)).toBe(false);
  });
  it('malformed discount_value does not produce a savings figure', () => {
    // discount_value present but original_price absent for percent => 0
    expect(getDealSavings(deal({ pricing_type: 'amount_off', discount_type: 'percent', discount_value: 999 }))).toBe(0);
  });
});

describe('buildDealPricingFields — create/edit payloads & type switching', () => {
  it('fixed_price payload sets price and NULLs every discount field', () => {
    expect(buildDealPricingFields({ pricingType: 'fixed_price', price: '10' })).toEqual({
      pricing_type: 'fixed_price',
      price: 10,
      discount_type: null,
      discount_value: null,
      original_price: null,
    });
  });

  it('switching amount_off -> fixed_price clears stale discount inputs (explicit null, not undefined)', () => {
    // Simulates an edit where the old discount values are still in form state.
    const payload = buildDealPricingFields({
      pricingType: 'fixed_price',
      price: '15',
      discountType: 'percent',
      discountValue: '20',
      originalPrice: '30',
    });
    expect(payload.discount_type).toBeNull();
    expect(payload.discount_value).toBeNull();
    expect(payload.original_price).toBeNull();
    // explicit null so a Supabase UPDATE actually overwrites stale DB columns
    expect(Object.prototype.hasOwnProperty.call(payload, 'discount_type')).toBe(true);
    expect(payload.price).toBe(15);
  });

  it('amount_off payload sets discount fields and NULLs price', () => {
    expect(buildDealPricingFields({ pricingType: 'amount_off', discountType: 'percent', discountValue: '20', originalPrice: '15' })).toEqual({
      pricing_type: 'amount_off',
      price: null,
      discount_type: 'percent',
      discount_value: 20,
      original_price: 15,
    });
  });

  it('switching fixed_price -> amount_off clears the stale price', () => {
    const payload = buildDealPricingFields({ pricingType: 'amount_off', price: '10', discountType: 'fixed', discountValue: '5' });
    expect(payload.price).toBeNull();
    expect(payload.discount_type).toBe('fixed');
    expect(payload.discount_value).toBe(5);
  });

  it('bogo carries no discount_value', () => {
    const payload = buildDealPricingFields({ pricingType: 'amount_off', discountType: 'bogo', discountValue: '99', originalPrice: '12' });
    expect(payload.discount_value).toBeNull();
    expect(payload.original_price).toBe(12);
  });
});

describe('validateDealPricing', () => {
  it('fixed_price requires a positive price', () => {
    expect(validateDealPricing({ pricingType: 'fixed_price', price: '10' })).toBeNull();
    expect(validateDealPricing({ pricingType: 'fixed_price', price: '' })).toBeTruthy();
    expect(validateDealPricing({ pricingType: 'fixed_price', price: '0' })).toBeTruthy();
    expect(validateDealPricing({ pricingType: 'fixed_price', price: '-3' })).toBeTruthy();
  });
  it('amount_off requires a discount type', () => {
    expect(validateDealPricing({ pricingType: 'amount_off' })).toBeTruthy();
  });
  it('percent must be 1..100', () => {
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'percent', discountValue: '20' })).toBeNull();
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'percent', discountValue: '0' })).toBeTruthy();
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'percent', discountValue: '150' })).toBeTruthy();
  });
  it('fixed off must be > 0', () => {
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'fixed', discountValue: '5' })).toBeNull();
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'fixed', discountValue: '0' })).toBeTruthy();
  });
  it('bogo needs no value', () => {
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'bogo' })).toBeNull();
  });
  it('rejects a malformed original_price when provided', () => {
    expect(validateDealPricing({ pricingType: 'amount_off', discountType: 'bogo', originalPrice: '-2' })).toBeTruthy();
  });
});
