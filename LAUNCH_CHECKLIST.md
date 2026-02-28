# Launch Readiness Checklist

## ✅ Completed Cleanup

### Debug/Test Files Removed
- ✅ `components/MarkerDebugInfo.tsx` - Debug component removed
- ✅ `TESTING_ANDROID_MARKERS.md` - Testing guide removed

### Code Cleanup
- ✅ Removed placeholder comment from `RecentActivityCard.tsx`
- ✅ Removed debug `console.log` from `app/admin.tsx` (restaurant selection)
- ✅ Wrapped all debug `console.log` statements in `__DEV__` checks:
  - `app/auth.tsx` - OAuth callback logging
  - `app/providers/auth.tsx` - Auth state logging
  - `hooks/useInventoryAlerts.ts` - Alert fetching logs
  - `hooks/useInventory.ts` - Inventory fetching logs
  - `hooks/usePushNotifications.ts` - Notification logging

### Configuration Cleanup
- ✅ Fixed duplicate `NSBonjourServices` entries in `app.json`

## 📝 Notes on Remaining "Placeholders"

### Intentional Fallbacks (Keep These)
- `app/lib/supabase.ts` - Placeholder URLs are fallbacks for missing env vars (intentional)
- `app/account.tsx` - Placeholder image URL is fallback for missing logos (intentional)
- Input field placeholders (e.g., "Enter your name") - These are UI placeholders (intentional)

### Documentation Files (Keep These)
- Various `.md` files are documentation and should remain

## 🚀 Pre-Launch Verification

### Environment Variables
- [ ] Verify `EXPO_PUBLIC_SUPABASE_URL` is set in EAS build config
- [ ] Verify `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set in EAS build config
- [ ] Verify `EXPO_PUBLIC_ORS_API_KEY` is set (if using directions)
- [ ] Verify `EXPO_PUBLIC_AUTH_REDIRECT_URL` is set

### App Configuration
- [ ] Update `app.json` bundle identifiers if needed:
  - iOS: `com.anonymous.Dealish` → Your actual bundle ID
  - Android: `com.anonymous.Dealish` → Your actual package name
- [ ] Verify app version in `app.json` (currently `1.0.1`)
- [ ] Verify app name and slug

### Testing
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Verify all features work in production build
- [ ] Test push notifications (if enabled)
- [ ] Verify OAuth flows work correctly

### Production Build
- [ ] Run `eas build --platform ios --profile production`
- [ ] Run `eas build --platform android --profile production`
- [ ] Test production builds before submitting

## 🔍 Final Checks

Run these commands to verify no debug code remains:

```bash
# Check for console.log (should only find __DEV__ wrapped ones)
grep -r "console.log" --include="*.ts" --include="*.tsx" app/ components/ hooks/ | grep -v "__DEV__"

# Check for TODO/FIXME comments
grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" app/ components/ hooks/

# Verify no test files in production code
find app/ components/ hooks/ -name "*test*" -o -name "*debug*"
```

## 📦 Ready for Launch

The app has been cleaned of debug code and placeholders. All console.log statements are wrapped in `__DEV__` checks, so they won't appear in production builds.
