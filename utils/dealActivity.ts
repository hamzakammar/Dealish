import { Deal } from "@/types/restaurant";

export const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead
const DEFAULT_TZ = 'America/Toronto';

/**
 * Gets local components (day, hours, minutes) for a given date in a specific timezone.
 */
function getLocalComponents(date: Date, tz: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value;

  // Intl weekday numeric: Sunday is 1 or something else depending on locale? 
  // Standardizing: Date.getDay() returns 0=Sun, 6=Sat. 
  // We use the day name and map it to be safe.
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  
  return {
    day: dayMap[weekdayName],
    hour: parseInt(getPart('hour') || '0', 10),
    minute: parseInt(getPart('minute') || '0', 10),
  };
}

/**
 * Converts "HH:MM:SS" or "HH:MM" to minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function isRecurringDealActive(deal: Deal, ref: Date, lookahead: boolean, tz: string = DEFAULT_TZ): boolean {
  if (!deal.is_recurring) return false;
  if (!deal.recurrence_days?.length) return true;

  const { day, hour, minute } = getLocalComponents(ref, tz);
  const currentMinutes = hour * 60 + minute;
  const yesterday = (day + 6) % 7;

  // If no time constraints, just check day of week
  if (!deal.recurrence_start_time || !deal.recurrence_end_time) {
    return deal.recurrence_days.includes(day);
  }

  const startMins = timeToMinutes(deal.recurrence_start_time);
  const endMins = timeToMinutes(deal.recurrence_end_time);
  const spansMidnight = endMins < startMins;

  // 1. Check if deal started TODAY and is active
  let activeToday = false;
  if (spansMidnight) {
    // Started today, ends tomorrow: current must be after start
    activeToday = (currentMinutes >= startMins);
  } else {
    // Normal span: current between start and end
    activeToday = (currentMinutes >= startMins && currentMinutes <= endMins);
  }

  if (activeToday && deal.recurrence_days.includes(day)) return true;

  // 2. Check if deal started YESTERDAY and is still active (cross-midnight)
  if (spansMidnight && currentMinutes <= endMins) {
    if (deal.recurrence_days.includes(yesterday)) return true;
  }

  // 3. Lookahead logic (for "Starting Soon" badges)
  if (lookahead) {
    const diff = startMins - currentMinutes;
    if (deal.recurrence_days.includes(day) && diff > 0 && diff <= 60) {
      return true;
    }
  }

  return false;
}

export function isOneTimeDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  const startAt = deal.start_at ? new Date(deal.start_at) : null;
  const endAt = deal.end_at ? new Date(deal.end_at) : null;

  if (endAt && !isNaN(endAt.getTime()) && endAt < ref) return false;

  if (startAt && !isNaN(startAt.getTime())) {
    if (startAt > ref) {
      return lookahead && startAt.getTime() - ref.getTime() <= SOON_MS;
    }
  }

  return true;
}

export function filterActiveDeals(deals: Deal[], atTime: Date | null, tz: string = DEFAULT_TZ): Deal[] {
  const ref = atTime ?? new Date();
  const lookahead = atTime == null;
  
  return deals.filter((deal) => {
    if (deal.is_active === false) return false;

    if (deal.is_recurring && (deal.recurrence_days?.length || deal.recurrence_start_time || deal.recurrence_end_time)) {
      return isRecurringDealActive(deal, ref, lookahead, tz);
    }

    return isOneTimeDealActive(deal, ref, lookahead);
  });
}
