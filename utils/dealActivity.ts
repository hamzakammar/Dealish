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

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = days[ref.getDay()];
  if (!deal.recurrence_days.includes(currentDay)) {
    return false;
  }

  const currentMinutes = getDateMinutes(ref);
  const startMinutes = getMinutes(deal.recurrence_start_time);
  const endMinutes = getMinutes(deal.recurrence_end_time);

  // Check if active at the reference time
  let isActive = false;
  if (startMinutes <= endMinutes) {
    // Normal case: deal starts and ends on the same day
    isActive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight case: deal spans across midnight (e.g., 22:00 to 02:00)
    isActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  if (isActive) return true;

  // Live mode only: starts within 1 hour
  if (lookahead && currentMinutes < startMinutes) {
    return startMinutes >= currentMinutes && startMinutes - currentMinutes <= 60;
  }

  return false;
}
