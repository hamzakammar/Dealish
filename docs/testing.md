# Testing

## Stack

- **Runner:** Jest via `jest-expo` preset.
- **RN testing:** `@testing-library/react-native`, `@testing-library/jest-native`,
  `react-test-renderer`.
- **Scripts:** `npm test`, `npm run test:watch`, `npm run test:coverage`.

## Test files

| Test | Subject |
|---|---|
| `components/__tests__/DealCard.test.tsx` | Deal card: thumbs hidden for partner venues, shown for non-partner |
| `components/__tests__/listView.test.tsx` | List view rendering |
| `components/__tests__/StyledText-test.js` | Snapshot of `StyledText` (Expo starter test) |
| `__tests__/dealFiltering.test.ts` | Deal active/recurring filtering logic |
| `__tests__/sendConfirmationEmail.test.ts` | `utils/sendConfirmationEmail.ts` (network failure handled gracefully) |

Mocks: `__mocks__/app/lib/supabase.ts` provides a chainable Supabase client mock.

## Current state (2026-05-29) — not green

Verified by running `npm test -- --runInBand`:

- **Assertions pass:** Jest reports all suites/tests passing.
- **Process still exits non-zero (code 1):** after environment teardown, React test
  renderer throws `TypeError: window.dispatchEvent is not a function`. CI would fail
  on this even though assertions pass. (DEBT-007)
- **Noise:**
  - `components/listView.tsx` logs mock-chain errors because the Supabase mock lacks
    `.neq()`.
  - `StyledText-test.js` triggers an `act(...)` warning and generates a snapshot under
    `components/__tests__/__snapshots__/` (delete if you don't intend to commit it).

## Type checking

`npx tsc --noEmit` currently fails with 1 error:

```
components/listView.tsx(75,13): error TS2322:
Property 'onLoadError' does not exist on type ImageProps.
```

`expo-image`'s `Image` uses `onError`, not `onLoadError`. (DEBT-006)

## Recommended next steps

1. Fix the `expo-image` prop in `components/listView.tsx` so `tsc` passes.
2. Add `.neq()` (and any other missing methods) to the Supabase mock so list tests
   stop logging errors.
3. Fix the teardown crash (likely needs a `window`/RN environment shim or removing
   the legacy `StyledText-test.js`) so `npm test` exits 0.
4. Add a `typecheck` script and wire both into CI (DEBT-014/DEBT-015).
