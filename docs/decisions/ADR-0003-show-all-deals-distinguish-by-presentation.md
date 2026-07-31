# ADR-0003: Show all deals; distinguish active ones by presentation

> **Status:** accepted
> **Date:** 2026-06-06
> **Author(s):** PM revision requirements ticket

---

## Context

Discovery surfaces filtered deals by *schedule* at the data layer via
`filterActiveDeals` (in `useRestaurantDeals` for the restaurant card, and in
`useActiveDealsMap`/`listView` for the map/list). A restaurant whose deals were
recurring-but-not-active-right-now (e.g. "Taco Tuesday" viewed on a Monday) would
render "No deals available", making the venue look empty and the app look sparse.

The PM revision ticket contained an internal conflict: item #1 implied hiding
inactive deals, while item 3.3 said all deals should be visible with active ones
distinguished by presentation. **Item 3.3 was declared authoritative.**

---

## Decision

The restaurant card shows **every published deal** (`is_active = true`, not
flagged) with no schedule-based filtering at the data layer. Currently-active
deals are distinguished through **presentation** — a full-card green treatment
and an "Active now" status — while inactive/upcoming deals stay neutral/muted.
The existing `filterActiveDeals` activity logic is *reused* (not rewritten) to
derive which deals are active for display.

---

## Options Considered

### Option A: Keep filtering inactive deals out at the data layer
- **Pros:** No UI change; least code.
- **Cons:** Directly violates item 3.3; keeps the "empty restaurant" bug.

### Option B: Show all deals, distinguish active ones by presentation *(chosen)*
- **Pros:** Satisfies 3.3; users see the full offer set and the schedule of
  upcoming deals; reuses the existing activity logic.
- **Cons:** Expired one-time deals can appear (muted, "Expired" badge) unless the
  owner disables them; slightly more content per card.

### Option C: Rewrite the activity/timezone logic to a new model
- **Pros:** Could unify map/list/card semantics.
- **Cons:** Explicitly out of scope; high regression risk in timezone handling.

---

## Rationale

Option B honours the authoritative requirement and fixes the real UX problem
(sparse-looking venues) with the least risk: the map pins and "deals active
nearby" counts keep their existing `filterActiveDeals` semantics (including the
1-hour "starting soon" lookahead), while the card derives a stricter
"active right now" set (no lookahead) purely for presentation.

---

## Consequences

- **Positive:** Restaurants no longer look empty; upcoming deals and their
  schedules are visible; a single source of truth (`utils/dealActivity.ts`) now
  owns both activity detection and schedule formatting.
- **Negative / trade-offs:** Expired one-time deals with `is_active = true` will
  render (muted). This is a data-hygiene concern for owners, not a display bug.
- **Debt introduced:** The in-app ORS route-preview path is now unused by the UI
  (see `docs/debt.md` DEBT-017).

---

## References

- Related ADRs: —
- Related code: `hooks/useRestaurantDeals.ts`, `components/RestaurantDetailCard.tsx`,
  `components/DealCard.tsx`, `utils/dealActivity.ts`
- Tests: `__tests__/dealPresentation.test.ts`
