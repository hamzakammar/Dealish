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

/**
 * ─── Presentation helpers ──────────────────────────────────────────────────
 * These format a deal's schedule for display and derive which deals are
 * *currently* active (for the full-card green treatment / primary-deal
 * headline). They reuse `filterActiveDeals` so the activity logic stays in one
 * place — they do NOT re-implement it.
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Formats "HH:MM:SS" / "HH:MM" into a display time like "3:00 PM". */
export function formatClockTime(timeString?: string | null): string | null {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes || 0, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Formats an ISO date string into a display time like "3:00 PM". */
export function formatDateTime(dateString?: string | null): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Formats a set of day numbers (0=Sun..6=Sat) into "Mon–Fri" / "Mon, Wed". */
export function formatDayNames(dayNumbers: number[]): string {
  const sortedDays = [...dayNumbers].sort((a, b) => a - b);
  const names = sortedDays.map((day) => DAY_NAMES[day]);

  if (names.length <= 2) {
    return names.join(', ');
  }

  const isConsecutive = sortedDays.every(
    (day, index) => index === 0 || day === sortedDays[index - 1] + 1
  );

  if (isConsecutive && names.length > 2) {
    return `${names[0]}–${names[names.length - 1]}`;
  }

  return names.join(', ');
}

/** Returns a deal's time window, e.g. "3:00 PM – 6:00 PM" / "Starts 3:00 PM". */
export function getDealTimeWindow(deal: Deal): string | null {
  if (deal.is_recurring && deal.recurrence_start_time && deal.recurrence_end_time) {
    const start = formatClockTime(deal.recurrence_start_time);
    const end = formatClockTime(deal.recurrence_end_time);
    if (start && end) return `${start} – ${end}`;
    return null;
  }

  if (deal.start_at || deal.end_at) {
    const start = formatDateTime(deal.start_at);
    const end = formatDateTime(deal.end_at);
    if (start && end) return `${start} – ${end}`;
    if (start) return `Starts ${start}`;
    if (end) return `Until ${end}`;
  }

  return null;
}

/** Returns a deal's recurring-days label, e.g. "Mon–Fri". */
export function getDealDaysLabel(deal: Deal): string | null {
  if (deal.is_recurring && deal.recurrence_days && deal.recurrence_days.length > 0) {
    return formatDayNames(deal.recurrence_days);
  }
  return null;
}

/**
 * Combined schedule label, e.g. "Mon–Fri · 3:00 PM – 6:00 PM".
 * Returns null when the deal has no schedule information to show.
 */
export function getDealScheduleLabel(deal: Deal): string | null {
  const daysLabel = getDealDaysLabel(deal);
  const timeWindow = getDealTimeWindow(deal);
  if (daysLabel && timeWindow) return `${daysLabel} · ${timeWindow}`;
  return timeWindow ?? daysLabel;
}

/**
 * Set of deal ids that are active *right now* (or at `atTime` when planning).
 * Uses `filterActiveDeals` with a concrete reference time so there is no
 * "starting soon" lookahead — only genuinely active deals get the green
 * treatment; upcoming deals stay muted.
 */
export function getActiveDealIdSet(deals: Deal[], atTime: Date | null = null): Set<string> {
  const ref = atTime ?? new Date();
  return new Set(filterActiveDeals(deals, ref).map((d) => d.id));
}

/**
 * Picks the "primary" deal to headline on the restaurant card: the first
 * currently-active deal (preserving input order), falling back to the first
 * deal when none are active.
 */
export function getPrimaryDeal(deals: Deal[], atTime: Date | null = null): Deal | null {
  if (!deals || deals.length === 0) return null;
  const activeIds = getActiveDealIdSet(deals, atTime);
  const active = deals.find((d) => activeIds.has(d.id));
  return active ?? deals[0];
}

/**
 * Finds the next upcoming deal that will become active today.
 * Returns the deal along with its formatted start time, or null if none found.
 */
export function getNextUpcomingDeal(
  deals: Deal[],
  restaurantNames: Map<string, string>,
  tz: string = DEFAULT_TZ
): { deal: Deal; restaurantName: string; startTimeFormatted: string } | null {
  const now = new Date();
  const { day, hour, minute } = getLocalComponents(now, tz);
  const currentMinutes = hour * 60 + minute;

  let earliest: { deal: Deal; startMins: number } | null = null;

  for (const deal of deals) {
    if (deal.is_active === false) continue;
    if (!deal.is_recurring) continue;
    if (!deal.recurrence_days?.includes(day)) continue;
    if (!deal.recurrence_start_time) continue;

    const startMins = timeToMinutes(deal.recurrence_start_time);
    // Only consider deals that haven't started yet
    if (startMins <= currentMinutes) continue;

    if (!earliest || startMins < earliest.startMins) {
      earliest = { deal, startMins };
    }
  }

  if (!earliest) return null;

  // Format the start time nicely (e.g., "3:00 PM")
  const startHour = Math.floor(earliest.startMins / 60);
  const startMinute = earliest.startMins % 60;
  const period = startHour >= 12 ? 'PM' : 'AM';
  const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
  const displayMinute = startMinute.toString().padStart(2, '0');
  const startTimeFormatted = `${displayHour}:${displayMinute} ${period}`;

  const restaurantName = restaurantNames.get(earliest.deal.restaurant_id) || 'Unknown';

  return {
    deal: earliest.deal,
    restaurantName,
    startTimeFormatted,
  };
}
