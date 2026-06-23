import { Deal } from "@/types/restaurant";

export const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead

/**
 * Convert "HH:MM:SS" or "HH:MM" time string to minutes from midnight.
 */
function getMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert a Date object to minutes from midnight (local time).
 */
function getDateMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Returns true if a recurring deal is active at `ref`.
 * When `lookahead` is true (live mode), also counts deals starting within 1 hour.
 * When false (planning for a chosen time), only counts deals active AT that time.
 */
export function isRecurringDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (!deal.is_recurring) return false;

  if (!deal.recurrence_days || !deal.recurrence_days.length || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    // Incomplete recurring fields — treat as always-on (fall through to one-time check)
    return true;
  }

  if (!deal.recurrence_days.includes(ref.getDay())) {
    return false;
  }

  const currentMinutes = getDateMinutes(ref);
  const startMinutes = getMinutes(deal.recurrence_start_time);
  const endMinutes = getMinutes(deal.recurrence_end_time);

  // Active at the reference time
  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return true;
  }

  // Live mode only: starts within 1 hour
  if (lookahead && currentMinutes < startMinutes) {
    return startMinutes >= currentMinutes && startMinutes - currentMinutes <= 60;
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
    // Most basic check: is the deal active?
    if (deal.is_active === false) return false;

    // Check expiration regardless of recurring status
    if (deal.end_at && new Date(deal.end_at) < ref) {
      return false; // Expired
    }

    // A recurring deal is only evaluated by recurring logic if it has any recurring fields.
    // If it's marked recurring but has NO fields, it falls through to one-time logic (always active).
    if (deal.is_recurring && (deal.recurrence_days?.length || deal.recurrence_start_time || deal.recurrence_end_time)) {
      return isRecurringDealActive(deal, ref, lookahead);
    }

    return isOneTimeDealActive(deal, ref, lookahead);
  });
}
