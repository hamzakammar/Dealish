# Dealish Bug Fix Notes

_Applied 2026-03-12_

## Bug 1: Email Confirmation → Black Screen (HIGH PRIORITY)

**File:** `app/lib/supabase.ts`

**Root cause:** `getAuthRedirectUrl()` used `Linking.createURL(AUTH_REDIRECT_PATH)` which generates
`exp://172.20.10.2:8081/--/auth/callback` (the local Expo dev server IP). Email confirmation links
are sent at sign-up time and stored by Supabase — they can be clicked days later when the dev
server is not running or on a different IP.

**Fix:** Replaced `Linking.createURL()` with a hardcoded `'dealish://auth/callback'` string. This
uses the app's registered URL scheme (`expo.scheme = "dealish"` in `app.json`) which works
consistently in both dev and production builds.

Also removed the now-unused `import * as Linking from 'expo-linking'`.

**Supabase Dashboard action required:** Add `dealish://auth/callback` to
Dashboard → Authentication → URL Configuration → Redirect URLs
(see `LAUNCH_CHECKLIST.md`).

---

## Bug 2: New Email Users Skip Onboarding (HIGH PRIORITY)

**File:** `app/index.tsx`

**Root cause:** The routing logic only checked `AsyncStorage.getItem('hasCompletedOnboarding')` to
decide whether to show onboarding. If the flag was already `'true'` from a previous install or test
device, a freshly email-confirmed user would be sent directly to `/map` with no profile set up.

**Fix:** Updated routing logic to also check `profile?.display_name`. If the profile has no
display_name (indicating a brand-new user who hasn't completed onboarding), route to `/onboarding`
regardless of the AsyncStorage flag:

```ts
const needsOnboarding = !hasCompletedOnboarding || !profile?.display_name;
```

`onboarding.tsx` already sets `AsyncStorage.setItem('hasCompletedOnboarding', 'true')` and updates
the `display_name` in the `profiles` table on completion — no changes needed there.

---

## Bug 3: Location Defaults to Waterloo Instead of User's Location

**Files:** `app/map.tsx`, `hooks/useUserLocation.ts`

**Root cause:** `fallbackRegion` in `map.tsx` was hardcoded to Waterloo, ON
(43.46946, -80.55348). This was used as the initial map region if GPS was unavailable.

**Fix:**
- Updated `fallbackRegion` in `map.tsx` to Toronto (43.6532, -79.3832) with a wider delta
  (0.05) so the city is visible at a reasonable zoom level.
- Updated `useUserLocation.ts` to set a Toronto region when location permission is denied,
  instead of leaving `region` as null.

The location permission request was already happening on mount in `useUserLocation.ts` — no change
needed there.

---

## Bug 4: Map Marker Icons Cut Out / Invisible Restaurants

**File:** `components/RestaurantMarker.tsx`

**Two issues fixed:**

1. **Deal marker visual glitch (cut-out icons):** The active-deal `<Marker>` had
   `tracksViewChanges={true}`, which causes React Native Maps to continuously re-capture the
   marker's bitmap, leading to blank/cut-out frames during re-renders.
   **Fix:** Changed to `tracksViewChanges={false}` for the active-deal marker branch.

2. **Invisible restaurant markers:** Some restaurants with null/undefined `lat` or `lng` would
   cause the `<Marker>` to render at an invalid coordinate and be invisible/off-screen.
   **Fix:** Added a guard at the top of `RestaurantMarker` — if `restaurant.lat` or
   `restaurant.lng` is falsy, the component returns `null` instead of rendering a broken marker.

---

## Bug 5: Bottom Sheet Delay When Tapping a Marker

**File:** `components/RestaurantDetailCard.tsx`

**Root cause:** The card entrance used `Animated.timing` with a 600ms duration (same as the
close animation). The state-transition duration was 800ms, making all drag-to-expand gestures feel
sluggish. Additionally, the `ScrollView` had `scrollEnabled={sheetState === 'full'}`, preventing
any scrolling in the default 'half' state.

**Fixes:**
- Changed card entrance from `Animated.timing` (600ms) to `Animated.spring` with the existing
  spring constants (`tension: 65, friction: 11`) for a snappier, more natural feel.
- Reduced `STATE_TRANSITION_DURATION_MS` from 800ms → 300ms so drag-state transitions feel
  immediate.
- Changed `scrollEnabled` from `sheetState === 'full'` to `sheetState !== 'peek'`, so the content
  is scrollable in both 'half' and 'full' states from the moment the card appears.

---

## Bug 6: Google OAuth Shows Raw Supabase URL

**File:** `LAUNCH_CHECKLIST.md`

**Root cause:** Configuration issue — the Google OAuth consent screen shows the redirect domain
(`hpsoqjpzebkkxdqapegl.supabase.co`) instead of "Dealish" because the OAuth app name hasn't been
configured in Google Cloud Console.

**Fix (no code change possible):** Added checklist items to `LAUNCH_CHECKLIST.md`:
- Set App name to "Dealish" in Google Cloud Console → OAuth consent screen
- Upload Dealish logo to the consent screen
- This makes Google show "Dealish" during sign-in instead of the raw Supabase URL
