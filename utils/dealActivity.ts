import { Deal } from "@/types/restaurant";
import { format, parseISO, isValid } from "date-fns";

export const SOON_MS = 60 * 60 * 1000; // 1 hour lookahead

/**
 * Robust datetime comparison handling timezones and cross-midnight spans.
 */
function isTimeInRange(current: Date, startStr: string, endStr: string): boolean {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  
  const start = new Date(current);
  start.setHours(sh, sm, 0, 0);
  
  const end = new Date(current);
  end.setHours(eh, em, 0, 0);

  // Handle spans across midnight (e.g., 22:00 to 02:00)
  if (end < start) {
    if (current >= start) {
      end.setDate(end.getDate() + 1);
    } else {
      start.setDate(start.getDate() - 1);
    }
  }

  return current >= start && current <= end;
}

export function isRecurringDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  if (!deal.is_recurring) return false;
  
  if (!deal.recurrence_days?.length || !deal.recurrence_start_time || !deal.recurrence_end_time) {
    return true; 
  }

  // Handle day-of-week check, considering deals that started "yesterday" but end today (post-midnight)
  const currentDay = ref.getDay();
  const prevDay = (currentDay + 6) % 7;
  
  const isActiveToday = deal.recurrence_days.includes(currentDay) && 
                       isTimeInRange(ref, deal.recurrence_start_time, deal.recurrence_end_time);
                       
  // If not active in today's slot, check if we are in the tail end of yesterday's slot
  if (!isActiveToday && deal.recurrence_days.includes(prevDay)) {
     // Check if the range crosses midnight
     const [sh] = deal.recurrence_start_time.split(':').map(Number);
     const [eh] = deal.recurrence_end_time.split(':').map(Number);
     if (eh < sh) {
       return isTimeInRange(ref, deal.recurrence_start_time, deal.recurrence_end_time);
     }
  }

  if (isActiveToday) return true;

  // Lookahead logic
  if (lookahead && deal.recurrence_days.includes(currentDay)) {
    const [sh, sm] = deal.recurrence_start_time.split(':').map(Number);
    const startDate = new Date(ref);
    startDate.setHours(sh, sm, 0, 0);
    
    const diff = startDate.getTime() - ref.getTime();
    return diff > 0 && diff <= SOON_MS;
  }

  return false;
}

export function isOneTimeDealActive(deal: Deal, ref: Date, lookahead: boolean): boolean {
  const startAt = deal.start_at ? parseISO(deal.start_at) : null;
  const endAt = deal.end_at ? parseISO(deal.end_at) : null;

  if (endAt && isValid(endAt) && endAt < ref) return false;

  if (startAt && isValid(startAt)) {
    if (startAt > ref) {
      return lookahead && startAt.getTime() - ref.getTime() <= SOON_MS;
    }
  }

  return true;
}

export function filterActiveDeals(deals: Deal[], atTime: Date | null): Deal[] {
  const ref = atTime ?? new Date();
  const lookahead = atTime == null;
  
  return deals.filter((deal) => {
    if (deal.is_active === false) return false;

    if (deal.is_recurring && (deal.recurrence_days?.length || deal.recurrence_start_time || deal.recurrence_end_time)) {
      return isRecurringDealActive(deal, ref, lookahead);
    }

    return isOneTimeDealActive(deal, ref, lookahead);
  });
}
