import { supabase } from '@/app/lib/supabase';

/**
 * Client wrapper for the operator-only `create_ingested_restaurant_with_deal`
 * RPC (see database/migrations/add_operator_restaurant_ingestion.sql). Creates a
 * restaurant + owner membership + first deal atomically, with server-side
 * operator authorization and duplicate prevention. Reuses the existing Supabase
 * client and RLS/RPC patterns — no parallel data path.
 */

export type IngestRestaurantInput = {
  // Required
  name: string;
  lat: number;
  lng: number;
  dealTitle: string;
  // Restaurant (optional)
  address?: string | null;
  city?: string | null;
  type?: string | null;
  phone?: string | null;
  heroImageUrl?: string | null;
  googlePlaceId?: string | null;
  websiteUrl?: string | null;
  /** Operator-only visibility (restaurants.is_test); false = live to everyone. */
  isTest?: boolean;
  // Deal (optional / conditional)
  dealDescription?: string | null;
  dealTags?: string[];
  isRecurring?: boolean;
  recurrenceDays?: number[] | null;
  recurrenceStartTime?: string | null; // "HH:MM:SS"
  recurrenceEndTime?: string | null; // "HH:MM:SS"
  startAt?: string | null; // ISO timestamp
  endAt?: string | null; // ISO timestamp
  discountType?: 'percent' | 'fixed' | 'bogo' | null;
  discountValue?: number | null;
  originalPrice?: number | null;
};

export type IngestErrorCode =
  | 'not_operator'
  | 'duplicate'
  | 'validation'
  | 'unknown';

export type IngestResult =
  | { ok: true; restaurantId: string; dealId: string }
  | { ok: false; code: IngestErrorCode; message: string };

/** Map a raised Postgres error message to a typed, user-facing result. */
function mapError(message: string | undefined): { code: IngestErrorCode; message: string } {
  const m = (message || '').toLowerCase();
  if (m.includes('not_operator')) {
    return { code: 'not_operator', message: 'You do not have permission to add restaurants.' };
  }
  if (m.includes('duplicate_place') || m.includes('duplicate_name_address')) {
    return {
      code: 'duplicate',
      message: 'A restaurant with this name/location (or Google place) already exists.',
    };
  }
  if (m.includes('missing_name')) return { code: 'validation', message: 'Restaurant name is required.' };
  if (m.includes('missing_location')) return { code: 'validation', message: 'A valid location (latitude & longitude) is required.' };
  if (m.includes('invalid_coordinates')) return { code: 'validation', message: 'Latitude/longitude are out of range.' };
  if (m.includes('missing_deal_title')) return { code: 'validation', message: 'Deal title is required.' };
  if (m.includes('invalid_discount_type')) return { code: 'validation', message: 'Invalid discount type.' };
  return { code: 'unknown', message: message || 'Failed to create restaurant. Please try again.' };
}

export async function ingestRestaurantWithDeal(
  input: IngestRestaurantInput
): Promise<IngestResult> {
  try {
    const { data, error } = await supabase.rpc('create_ingested_restaurant_with_deal', {
      p_name: input.name,
      p_lat: input.lat,
      p_lng: input.lng,
      p_deal_title: input.dealTitle,
      p_address: input.address ?? null,
      p_city: input.city ?? null,
      p_type: input.type ?? null,
      p_phone: input.phone ?? null,
      p_hero_image_url: input.heroImageUrl ?? null,
      p_google_place_id: input.googlePlaceId ?? null,
      p_website_url: input.websiteUrl ?? null,
      p_is_test: input.isTest ?? false,
      p_deal_description: input.dealDescription ?? null,
      p_deal_tags: input.dealTags ?? [],
      p_is_recurring: input.isRecurring ?? false,
      p_recurrence_days: input.recurrenceDays ?? null,
      p_recurrence_start_time: input.recurrenceStartTime ?? null,
      p_recurrence_end_time: input.recurrenceEndTime ?? null,
      p_start_at: input.startAt ?? null,
      p_end_at: input.endAt ?? null,
      p_discount_type: input.discountType ?? null,
      p_discount_value: input.discountValue ?? null,
      p_original_price: input.originalPrice ?? null,
    });

    if (error) {
      const mapped = mapError(error.message);
      return { ok: false, ...mapped };
    }

    // Table-returning function → array of rows.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.out_restaurant_id || !row?.out_deal_id) {
      return { ok: false, code: 'unknown', message: 'Restaurant was not created. Please try again.' };
    }
    return { ok: true, restaurantId: row.out_restaurant_id, dealId: row.out_deal_id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'unknown', message };
  }
}
