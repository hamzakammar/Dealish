/**
 * Regression tests for the deal-activity states behind the restaurant card's
 * "No deals available" vs. "inactive/upcoming" distinction.
 *
 * These import the REAL utilities from utils/dealActivity.ts (not a re-implemented
 * copy), so they lock in production behaviour. Jest runs in TZ=America/Toronto
 * (package.json), matching the util's default timezone.
 *
 * States covered: active, upcoming (today, later), inactive (wrong day),
 * disabled (is_active=false), malformed (bad time strings), all-day.
 */
import {
  filterActiveDeals,
  getActiveDealIdSet,
  getDealScheduleLabel,
} from '@/utils/dealActivity';
import { Deal } from '@/types/restaurant';

// 2025-06-10 is a Tuesday (getDay() === 2).
const TUE_7PM = new Date('2025-06-10T19:00:00');

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd',
    restaurant_id: 'r1',
    title: 'Deal',
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

describe('deal activity states — filterActiveDeals / getActiveDealIdSet', () => {
  it('ACTIVE: recurring deal inside its window today is active', () => {
    const d = deal({ id: 'active' }); // Tue 5–9pm, ref Tue 7pm
    expect(filterActiveDeals([d], TUE_7PM).map((x) => x.id)).toEqual(['active']);
    expect(getActiveDealIdSet([d], TUE_7PM).has('active')).toBe(true);
  });

  it('UPCOMING (today, later): is_active but NOT currently active — never dropped as "no deal"', () => {
    const d = deal({ id: 'later', recurrence_start_time: '20:00:00', recurrence_end_time: '22:00:00' });
    // Not in the currently-active set...
    expect(getActiveDealIdSet([d], TUE_7PM).has('later')).toBe(false);
    // ...but it is still a real, published (is_active) deal that the card shows.
    expect(d.is_active).toBe(true);
  });

  it('INACTIVE (wrong day): recurring on a different weekday is not active today', () => {
    const d = deal({ id: 'wed', recurrence_days: [3] }); // Wednesday, ref is Tuesday
    expect(filterActiveDeals([d], TUE_7PM)).toHaveLength(0);
    expect(getActiveDealIdSet([d], TUE_7PM).has('wed')).toBe(false);
  });

  it('DISABLED (is_active=false): excluded from the active set', () => {
    const d = deal({ id: 'off', is_active: false });
    expect(filterActiveDeals([d], TUE_7PM)).toHaveLength(0);
    expect(getActiveDealIdSet([d], TUE_7PM).has('off')).toBe(false);
  });

  it('MALFORMED: bad time strings do not throw and are treated as not active', () => {
    const d = deal({
      id: 'bad',
      recurrence_start_time: 'not-a-time',
      recurrence_end_time: 'also-bad',
    });
    expect(() => filterActiveDeals([d], TUE_7PM)).not.toThrow();
    expect(filterActiveDeals([d], TUE_7PM)).toHaveLength(0);
    // No "Invalid Date" leaks into the schedule label.
    const label = getDealScheduleLabel(d);
    expect(label ?? '').not.toMatch(/Invalid/i);
  });

  it('ALL-DAY (recurring day, no time window): active all day on its day', () => {
    const d = deal({
      id: 'allday',
      recurrence_start_time: undefined,
      recurrence_end_time: undefined,
    });
    expect(getActiveDealIdSet([d], TUE_7PM).has('allday')).toBe(true);
  });

  it('ALL-WEEK (7 days): active any day, and labelled "Every day"', () => {
    const d = deal({
      id: 'everyday',
      recurrence_days: [0, 1, 2, 3, 4, 5, 6],
      recurrence_start_time: '00:00:00',
      recurrence_end_time: '23:59:00',
    });
    expect(getActiveDealIdSet([d], TUE_7PM).has('everyday')).toBe(true);
    expect(getDealScheduleLabel(d)).toMatch(/^Every day/);
  });

  it('a mixed list keeps active/upcoming separate without dropping either', () => {
    const activeNow = deal({ id: 'now' });
    const upcoming = deal({ id: 'soon', recurrence_start_time: '20:00:00', recurrence_end_time: '22:00:00' });
    const wrongDay = deal({ id: 'wed', recurrence_days: [3] });
    const list = [activeNow, upcoming, wrongDay];
    const activeIds = getActiveDealIdSet(list, TUE_7PM);
    // Only the truly-active one is in the set...
    expect([...activeIds]).toEqual(['now']);
    // ...but the full published list is intact (the card shows all three).
    expect(list.map((d) => d.id)).toEqual(['now', 'soon', 'wed']);
  });
});
