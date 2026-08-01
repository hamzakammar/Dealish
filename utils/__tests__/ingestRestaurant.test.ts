/**
 * Tests for the operator restaurant-ingestion client wrapper
 * (utils/ingestRestaurant.ts). The Supabase client is the shared manual mock
 * (__mocks__/app/lib/supabase.ts) mapped via moduleNameMapper, so no network
 * runs. We drive `supabase.rpc` per test.
 */
import { ingestRestaurantWithDeal } from '@/utils/ingestRestaurant';
import { supabase } from '@/app/lib/supabase';

const rpc = supabase.rpc as jest.Mock;

const baseInput = {
  name: 'Test Cafe',
  lat: 43.6532,
  lng: -79.3832,
  dealTitle: 'Happy Hour',
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe('ingestRestaurantWithDeal — success', () => {
  it('calls the RPC and returns the new ids', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ out_restaurant_id: 'r-1', out_deal_id: 'd-1' }],
      error: null,
    });

    const result = await ingestRestaurantWithDeal({
      ...baseInput,
      address: '1 King St',
      city: 'Toronto',
      googlePlaceId: 'place-123',
      isRecurring: false,
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-08T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true, restaurantId: 'r-1', dealId: 'd-1' });
    expect(rpc).toHaveBeenCalledWith(
      'create_ingested_restaurant_with_deal',
      expect.objectContaining({
        p_name: 'Test Cafe',
        p_lat: 43.6532,
        p_lng: -79.3832,
        p_deal_title: 'Happy Hour',
        p_google_place_id: 'place-123',
        p_is_recurring: false,
        p_start_at: '2026-01-01T00:00:00.000Z',
      })
    );
  });

  it('maps recurring deal fields and nulls the one-time date range', async () => {
    rpc.mockResolvedValueOnce({ data: [{ out_restaurant_id: 'r', out_deal_id: 'd' }], error: null });

    await ingestRestaurantWithDeal({
      ...baseInput,
      isRecurring: true,
      recurrenceDays: [1, 2, 3],
      recurrenceStartTime: '17:00:00',
      recurrenceEndTime: '21:00:00',
    });

    const args = rpc.mock.calls[0][1];
    expect(args.p_is_recurring).toBe(true);
    expect(args.p_recurrence_days).toEqual([1, 2, 3]);
    expect(args.p_recurrence_start_time).toBe('17:00:00');
    expect(args.p_start_at).toBeNull();
    expect(args.p_end_at).toBeNull();
  });

  it('defaults optional fields to null / empty tags', async () => {
    rpc.mockResolvedValueOnce({ data: [{ out_restaurant_id: 'r', out_deal_id: 'd' }], error: null });
    await ingestRestaurantWithDeal(baseInput);
    const args = rpc.mock.calls[0][1];
    expect(args.p_address).toBeNull();
    expect(args.p_hero_image_url).toBeNull();
    expect(args.p_deal_tags).toEqual([]);
    expect(args.p_is_test).toBe(false);
  });
});

describe('ingestRestaurantWithDeal — authorization & duplicates', () => {
  it('maps not_operator to a typed authorization error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'not_operator' } });
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_operator');
  });

  it('maps duplicate_place to a duplicate error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate_place' } });
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('duplicate');
  });

  it('maps duplicate_name_address to a duplicate error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate_name_address' } });
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('duplicate');
  });
});

describe('ingestRestaurantWithDeal — validation & error handling', () => {
  it('maps missing_deal_title to a validation error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'missing_deal_title' } });
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('validation');
  });

  it('treats a missing returned row as an unknown failure (rollback-safe)', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unknown');
  });

  it('catches a thrown client error', async () => {
    rpc.mockRejectedValueOnce(new Error('network down'));
    const result = await ingestRestaurantWithDeal(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unknown');
      expect(result.message).toContain('network down');
    }
  });
});
