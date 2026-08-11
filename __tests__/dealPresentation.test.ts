/**
 * Tests for the deal *presentation* helpers introduced for the PM revision
 * ticket (show all deals, distinguish active ones through presentation).
 *
 * These import the REAL helpers from utils/dealActivity.ts so the tests track
 * production behaviour. They reuse the shared `filterActiveDeals` activity logic
 * rather than re-implementing it.
 *
 * The Jest env runs in TZ='America/Toronto' (see package.json), matching the
 * default timezone used by the activity logic.
 */

import {
  getActiveDealIdSet,
  getDealScheduleLabel,
  getPrimaryDeal,
  filterActiveDeals,
} from '@/utils/dealActivity';
import { Deal } from '@/types/restaurant';

// 2025-06-10 is a Tuesday (getDay() === 2).
function recurring(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'rec-1',
    restaurant_id: 'r1',
    title: 'Taco Tuesday',
    is_active: true,
    is_recurring: true,
    recurrence_days: [2], // Tuesday
    recurrence_start_time: '17:00:00',
    recurrence_end_time: '21:00:00',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Deal;
}

const TUE_DINNER = new Date('2025-06-10T19:00:00'); // Tue 7pm — inside window
const TUE_LATE_AFTERNOON = new Date('2025-06-10T16:30:00'); // Tue 4:30pm — 30m before

describe('getDealScheduleLabel', () => {
  it('formats a single-day recurring window', () => {
    const deal = recurring({ recurrence_days: [2] });
    expect(getDealScheduleLabel(deal)).toBe('Tue · 5:00 PM – 9:00 PM');
  });

  it('collapses consecutive days into a range', () => {
    const deal = recurring({
      recurrence_days: [1, 2, 3, 4, 5],
      recurrence_start_time: '15:00:00',
      recurrence_end_time: '18:00:00',
    });
    expect(getDealScheduleLabel(deal)).toBe('Mon–Fri · 3:00 PM – 6:00 PM');
  });

  it('labels an all-week recurring deal as "Every day" (not a weekday range)', () => {
    const deal = recurring({
      recurrence_days: [0, 1, 2, 3, 4, 5, 6],
      recurrence_start_time: '11:00:00',
      recurrence_end_time: '23:00:00',
    });
    expect(getDealScheduleLabel(deal)).toBe('Every day · 11:00 AM – 11:00 PM');
  });

  it('shows days only when there is no time window', () => {
    const deal = recurring({
      recurrence_days: [0, 6],
      recurrence_start_time: undefined,
      recurrence_end_time: undefined,
    });
    expect(getDealScheduleLabel(deal)).toBe('Sun, Sat');
  });

  it('returns null when a deal has no schedule information', () => {
    const deal: Deal = {
      id: 'plain',
      restaurant_id: 'r1',
      title: 'Always on',
      is_active: true,
      is_recurring: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    expect(getDealScheduleLabel(deal)).toBeNull();
  });
});

describe('getActiveDealIdSet — only currently-active deals (no lookahead)', () => {
  it('includes a deal active at the reference time', () => {
    const deal = recurring();
    const set = getActiveDealIdSet([deal], TUE_DINNER);
    expect(set.has('rec-1')).toBe(true);
  });

  it('excludes a deal that only starts soon (no 1h lookahead in presentation)', () => {
    const deal = recurring(); // starts 5pm; ref is 4:30pm
    const set = getActiveDealIdSet([deal], TUE_LATE_AFTERNOON);
    expect(set.has('rec-1')).toBe(false);
  });

  it('returns only the active subset from a mixed list', () => {
    const active = recurring({ id: 'active' });
    const upcoming = recurring({ id: 'upcoming', recurrence_days: [3] }); // Wednesday
    const set = getActiveDealIdSet([active, upcoming], TUE_DINNER);
    expect(set.has('active')).toBe(true);
    expect(set.has('upcoming')).toBe(false);
    expect(set.size).toBe(1);
  });
});

describe('show-all-deals invariant', () => {
  it('presentation marks a subset active but never drops deals from the list', () => {
    const deals = [
      recurring({ id: 'a', recurrence_days: [2] }), // active Tue
      recurring({ id: 'b', recurrence_days: [3] }), // Wed — inactive Tue
      recurring({ id: 'c', recurrence_days: [4] }), // Thu — inactive Tue
    ];
    const activeIds = getActiveDealIdSet(deals, TUE_DINNER);

    // The active set is a strict subset...
    expect(activeIds.size).toBeLessThan(deals.length);
    // ...but the full list of available deals is untouched (nothing filtered).
    expect(deals.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    // Every id in the set exists in the full list.
    for (const id of activeIds) {
      expect(deals.some((d) => d.id === id)).toBe(true);
    }
  });
});

describe('getPrimaryDeal', () => {
  it('prefers the first currently-active deal', () => {
    const inactive = recurring({ id: 'inactive', recurrence_days: [3] });
    const active = recurring({ id: 'active', recurrence_days: [2] });
    const primary = getPrimaryDeal([inactive, active], TUE_DINNER);
    expect(primary?.id).toBe('active');
  });

  it('falls back to the first deal when none are active', () => {
    const first = recurring({ id: 'first', recurrence_days: [3] });
    const second = recurring({ id: 'second', recurrence_days: [4] });
    const primary = getPrimaryDeal([first, second], TUE_DINNER);
    expect(primary?.id).toBe('first');
  });

  it('returns null for an empty list', () => {
    expect(getPrimaryDeal([], TUE_DINNER)).toBeNull();
  });
});

describe('getActiveDealIdSet reuses filterActiveDeals', () => {
  it('matches filterActiveDeals output at the same reference time', () => {
    const deals = [
      recurring({ id: 'a', recurrence_days: [2] }),
      recurring({ id: 'b', recurrence_days: [3] }),
    ];
    const set = getActiveDealIdSet(deals, TUE_DINNER);
    const filtered = filterActiveDeals(deals, TUE_DINNER).map((d) => d.id);
    expect([...set].sort()).toEqual(filtered.sort());
  });
});
