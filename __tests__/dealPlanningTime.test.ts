/**
 * Tests for the "Planning for" time-travel deal filter (Q2).
 *
 * Unlike dealFiltering.test.ts (which mirrors the logic), this imports the REAL
 * filterActiveDeals from utils/dealActivity.ts — the same function the map hook
 * uses — so the test cannot drift from production behaviour.
 */

import { filterActiveDeals } from '@/utils/dealActivity';
import { Deal } from '@/types/restaurant';

// 2025-06-10 is a Tuesday (getDay() === 2).
function recurringTueDinner(overrides: Partial<Deal> = {}): Deal {
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

function oneTime(start: string, end: string): Deal {
  return {
    id: 'ot-1',
    restaurant_id: 'r1',
    title: 'Flash sale',
    is_active: true,
    is_recurring: false,
    start_at: start,
    end_at: end,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  } as Deal;
}

describe('filterActiveDeals — planning for a chosen time (no lookahead)', () => {
  const deal = recurringTueDinner();

  it('includes a recurring deal when planning INSIDE its window', () => {
    const at = new Date('2025-06-10T19:00:00'); // Tue 7pm
    expect(filterActiveDeals([deal], at)).toHaveLength(1);
  });

  it('excludes it when planning BEFORE the window (no 1h lookahead in planning mode)', () => {
    const at = new Date('2025-06-10T16:30:00'); // Tue 4:30pm, 30 min before
    expect(filterActiveDeals([deal], at)).toHaveLength(0);
  });

  it('excludes it when planning AFTER the window', () => {
    const at = new Date('2025-06-10T21:30:00'); // Tue 9:30pm
    expect(filterActiveDeals([deal], at)).toHaveLength(0);
  });

  it('excludes it on the WRONG day even at the right time', () => {
    const at = new Date('2025-06-11T19:00:00'); // Wednesday 7pm
    expect(filterActiveDeals([deal], at)).toHaveLength(0);
  });

  it('respects window bounds for one-time deals', () => {
    const d = oneTime('2025-06-10T18:00:00', '2025-06-10T20:00:00');
    expect(filterActiveDeals([d], new Date('2025-06-10T19:00:00'))).toHaveLength(1); // inside
    expect(filterActiveDeals([d], new Date('2025-06-10T17:00:00'))).toHaveLength(0); // before
    expect(filterActiveDeals([d], new Date('2025-06-10T21:00:00'))).toHaveLength(0); // after
  });
});

describe('filterActiveDeals — live mode (atTime null) keeps the 1h lookahead', () => {
  const deal = recurringTueDinner();

  afterEach(() => jest.useRealTimers());

  it('includes a deal starting within 1 hour of now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-10T16:30:00')); // 30 min before open
    expect(filterActiveDeals([deal], null)).toHaveLength(1);
  });

  it('excludes a deal starting MORE than 1 hour from now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-10T15:30:00')); // 90 min before open
    expect(filterActiveDeals([deal], null)).toHaveLength(0);
  });

  it('includes a deal active right now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-06-10T19:00:00'));
    expect(filterActiveDeals([deal], null)).toHaveLength(1);
  });
});
