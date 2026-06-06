import { Deal } from "@/types/restaurant";

export const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead

/**
 * Returns true if a recurring deal is active at `ref`.
 * When `lookahead` is true (live mode), also counts deals starting within 1 hour.
 * When false (planning for a chosen time), only counts deals active AT that time.
 */
export function isRecurringDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (!deal.is_recurring || !deal.recurrence_days || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    return false;
  }

  if (!deal.recurrence_days.includes(ref.getDay())) {
    return false;
  }

  const currentTime = ref.toTimeString().slice(0, 8); // "HH:MM:SS"

  // Active at the reference time
  if (currentTime >= deal.recurrence_start_time && currentTime <= deal.recurrence_end_time) {
    return true;
  }

  // Live mode only: starts within 1 hour
  if (lookahead && currentTime < deal.recurrence_start_time) {
    const [sh, sm] = deal.recurrence_start_time.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const refMinutes = ref.getHours() * 60 + ref.getMinutes();
    return startMinutes - refMinutes <= 60;
  }

  return false;
}

/**
 * Returns true if a one-time deal is active at `ref` (live mode also allows
 * deals starting within 1 hour).
 */
export function isOneTimeDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (deal.end_at && new Date(deal.end_at) < ref) {
    return false;
  }

  if (deal.start_at) {
    const startAt = new Date(deal.start_at);
    if (startAt > ref) {
      // Not started yet — live mode shows if starting within 1 hour
      return lookahead && startAt.getTime() - ref.getTime() <= SOON_MS;
    }
  }

  return true;
}

/**
 * Filters deals to those active at `atTime`. When `atTime` is null we use "now"
 * with a 1-hour lookahead (the default live behaviour); when a time is provided
 * (planning ahead) we match deals active AT that exact time.
 */
export function filterActiveDeals(deals: Deal[], atTime: Date | null): Deal[] {
  const ref = atTime ?? new Date();
  const lookahead = atTime == null;
  return deals.filter((deal) => {
    if (deal.end_at && new Date(deal.end_at) < ref) {
      return false; // Expired
    }

    if (deal.is_recurring && deal.recurrence_days && deal.recurrence_start_time && deal.recurrence_end_time) {
      return isRecurringDealActive(deal, ref, lookahead);
    }

    return isOneTimeDealActive(deal, ref, lookahead);
  });
}
