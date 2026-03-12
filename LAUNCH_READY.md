# 🚀 LAUNCH_READY.md — Dealish Launch Preparation Summary

_Generated: 2026-03-12 — Pre-launch audit complete_

---

## ✅ What Was Fixed (This Run)

### 1. Documentation Cleanup
Deleted 16 dev/brainstorm markdown files that had no place in a production repo:
- `ANDROID_BUG_FIXES.md`, `BUGFIX_NOTES.md`, `COMPREHENSIVE_TEST_REPORT.md`
- `EXPIRATION_DATES_EXPLAINED.md`, `INVENTORY_IMPLEMENTATION_SUMMARY.md`
- `INVENTORY_SYSTEM_BRAINSTORM.md`, `INVENTORY_TESTING_GUIDE.md`
- `MENU_ITEMS_RECOMMENDATIONS.md`, `RECOMMENDATION_TIMING_SYSTEM.md`
- `RELEASE_COMMANDS.md`, `TESTING_PARAMETERS.md`, `TESTING_RESULTS.md`
- `UPDATE_REFRESH_SYSTEM.md`, `V1_INVENTORY_ALERTS.md`, `V1_RECOMMENDATION_APPROACH.md`
- `chat.md`

### 2. app.json — Fixed for App Store Submission
- `ios.bundleIdentifier`: Changed from `com.anonymous.Dealish` → `ca.hamzaammar.dealish`
- `android.package`: Changed from `com.anonymous.Dealish` → `ca.hamzaammar.dealish`
- `version`: Reset to `1.0.0`
- `ios.buildNumber`: Set to `"1"`
- `android.versionCode`: Set to `1`
- Added `ios.infoPlist` privacy usage strings:
  - `NSLocationWhenInUseUsageDescription` — required for location features
  - `NSLocationAlwaysUsageDescription` — required for location features
  - `NSCameraUsageDescription` — required for QR scanner
  - `ITSAppUsesNonExemptEncryption: false` — avoids export compliance questions

### 3. TypeScript Errors Fixed
- **`app/map.tsx`** — Removed unreachable `Platform.OS === 'android'` checks inside an iOS-only render block (TS2367)
- **`components/ExternalLink.tsx`** — Changed `@ts-expect-error` → `@ts-ignore` (unused directive TS2578)
- **`components/RestaurantDetailCard.tsx`** — Fixed `scrollEnabled={sheetState !== 'peek'}` inside a block where TypeScript already narrowed `sheetState` to exclude `'peek'` (TS2367)
- **`app/reset-password.tsx`** — Fixed hooks violation: `<Redirect>` was returned before `useEffect()`, violating Rules of Hooks. Moved conditional redirect to after all hooks.

### 4. Auth Redirect URL
- Confirmed `getAuthRedirectUrl()` in `app/lib/supabase.ts` returns `'dealish://auth/callback'` ✅
- Deep link scheme `dealish://` is set in `app.json` ✅

### 5. Auth Callback Handler
- `app/auth/callback.tsx` already exists with proper session handling ✅

---

## 🔧 What Needs Manual Action Before Launch

### 🔴 CRITICAL — Must Do Before App Store Submission

#### 1. Supabase Auth Redirect URLs
In your **Supabase Dashboard → Authentication → URL Configuration**:
- Add `dealish://auth/callback` to "Redirect URLs"
- Verify Site URL is set appropriately

#### 2. Apple Developer Account Setup
- App ID with bundle ID `ca.hamzaammar.dealish` must be registered at [developer.apple.com](https://developer.apple.com)
- **Sign In with Apple** capability must be enabled for this App ID
- Provisioning profiles must be generated (EAS handles this with `eas build`)

#### 3. Google Developer Account Setup
- Google Play app must be created with package `ca.hamzaammar.dealish`
- Release track setup (internal → alpha → production)

#### 4. Google OAuth Consent Screen
In **Google Cloud Console → OAuth 2.0**:
- Verify the OAuth redirect URI includes `dealish://auth/callback`
- App must be approved/published (not in test mode) for production
- Add your iOS bundle ID and Android package to the OAuth client

#### 5. Apple Sign In via Supabase
In **Supabase Dashboard → Authentication → Providers → Apple**:
- Configure Apple OAuth with your Apple Team ID, Service ID, key ID, and private key

#### 6. EAS Environment Variables
In **EAS Dashboard (expo.dev) → Your Project → Secrets**:
- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `GOOGLE_MAPS_API_KEY_ANDROID` — if needed by your Google Maps plugin
- `GOOGLE_MAPS_API_KEY_IOS` — if needed by your Google Maps plugin

#### 7. Push Notifications
- EAS project ID is set (`c8d4d9ee-1ec9-4e2c-a60f-fa51168853fe`) ✅
- FCM (Firebase Cloud Messaging) credentials needed for Android push notifications
  - Configure in Expo Dashboard → Your Project → Credentials

---

### 🟡 IMPORTANT — Do Before or Shortly After Launch

#### 8. Privacy Policy & Terms of Service
- App Store requires a real privacy policy URL. Create one (e.g., at `dealish.io/privacy`)
- Add to App Store Connect listing

#### 9. App Store Connect Setup
- Create app in App Store Connect with bundle ID `ca.hamzaammar.dealish`
- Prepare screenshots (6.7", 6.1", iPad if supporting tablets)
- Write App Store description, keywords, support URL
- Set age rating (likely 4+)
- Set up in-app purchase if needed (Dealish is free, so probably not)

#### 10. Google Play Console Setup
- Create app with package `ca.hamzaammar.dealish`
- Complete content rating questionnaire
- Add privacy policy URL
- Prepare screenshots for phone + 7" tablet

#### 11. Analytics / Crash Reporting
- Consider adding Sentry or Expo's built-in crash reporting before launch for production monitoring

---

## 🔍 Remaining Code Observations (Low Risk)

These are not blocking bugs but worth knowing:

1. **`geocodeAddress` in `utils/geocode.ts`** — Uses Nominatim (OpenStreetMap) with a 1 req/sec rate limit. Fine for restaurant search but may throttle if used in loops.

2. **Admin dashboard `defaultAvgSale = 5.03`** — There's a hardcoded fallback average sale value in `app/admin.tsx`. This is fine for launch, but should be noted as a magic number.

3. **`useRestaurants` limit of 500** — Restaurants are fetched with `.limit(500)`. Will need pagination if the platform scales significantly.

4. **Image uploads go to `avatars` bucket** — Ensure the Supabase `avatars` storage bucket has appropriate public read access policies.

5. **All console.log calls are properly gated** — All bare `console.log` statements are inside `if (__DEV__)` checks. ✅

6. **No hardcoded IPs or credentials** — Codebase is clean of localhost URLs, test credentials, or hardcoded user IDs. ✅

---

## 📋 Quick Pre-Build Checklist

```bash
# 1. Set EAS env vars in dashboard, then:
eas build --platform ios --profile production
eas build --platform android --profile production

# 2. Submit
eas submit --platform ios
eas submit --platform android
```

Before running builds:
- [ ] EAS env vars set (Supabase URL + key)  
- [ ] Apple Team ID confirmed in EAS credentials
- [ ] FCM config added for Android push
- [ ] Supabase redirect URL added
- [ ] Google OAuth redirect URI updated
- [ ] Privacy policy URL ready

---

_This audit was performed on: 2026-03-12. The app architecture is solid and well-structured for launch._
