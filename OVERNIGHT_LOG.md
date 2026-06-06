# Overnight autonomous run — progress log

Goal: boot Android emulator, build+install the app, drive it via adb to test the 3 features. Fix what breaks.

## Verified already (no device)
- tsc clean; 36/36 jest (incl. 8 real-function time-travel tests for #2)
- `expo export` (android) bundled 2477 modules — all routes/screens load
- Q1 LIVE: anon GET of John's Food Emporium (2d63f4b5…) returns [] (RLS hides it)
- Q3 backend LIVE: redeem_restaurant_invite + redeem_deal_scan RPCs exist
- Supabase publishable key in .env.local works; Maps key set

## Key facts / decisions
- Emulator setup is CLI-driven (Android Studio GUI was a dead end). SDK at ~/Library/Android/sdk.
  cmdline-tools upgraded to v19.0 (build 13114758) at cmdline-tools/latest. JAVA_HOME = Android Studio JBR 21.
- System image: system-images;android-35;google_apis;arm64-v8a (Apple Silicon). First install was
  killed by a tool timeout before writing package.xml; re-running in background (/tmp/sysimg.log).
- AVD to create: name "dealish", device pixel_7. Boot script: scripts/finish-emulator.sh.
- LOGIN WALL: email confirmation required (mailer_autoconfirm=false; signInWithPassword → "Email not confirmed").
  Cannot confirm a test inbox or flip the setting (no dashboard/service access).
  => Test UNAUTHENTICATED: app boots → welcome → /map. #2 picker testable; #1 visually confirmable;
     #3 redeem screen renders (success needs login → covered by API+bundle).
- Build/run via: bash scripts/dev-run.sh (pins node 22, guards env, expo run:android).
- Throwaway QA user created (unconfirmed, harmless): see /tmp/qa_email.txt.

## RESULTS — all reachable testing COMPLETE
1. [x] System image installed (android-35 google_apis arm64-v8a)
2. [x] AVD 'dealish' created + emulator booted headless (emulator-5554)
3. [x] Node 22 active (v22.22.3)
4. [x] expo run:android — BUILD SUCCESSFUL (36m19s), APK installed + launched, Metro served JS
5. [x] #2 VERIFIED on-device: Planning for -> Tomorrow+7PM updated label to "Showing deals available Tomorrow at 7PM"; chips toggle orange. Map tiles + restaurant markers render.
6. [x] #1 VERIFIED on-device: search "Emporium" returns 0 rows (test restaurant hidden by RLS) + API anon GET returns [].
7. [x] #3 VERIFIED on-device: deep-linked /admin/redeem-invite renders with "owners & staff only" banner; typing a code + Redeem calls RPC -> shows "Not signed in" gracefully (logged-out path).
8. [x] Evidence saved to docs/test-evidence/ (8 screenshots + README); this log updated.

## NOTES / gotchas found
- First map load showed an async_timeout Alert: useRestaurants has a 15s withTimeout; the cold emulator network exceeded it once (QUIC errors in logcat). A reload loaded all restaurants fine. Real devices won't hit this, but consider bumping RESTAURANTS_QUERY_MS or adding a retry. NOT caused by my changes.
- Login-gated #3 paths (account entry, admin-view toggle, redeem success, operator invites screen) NOT visually tested: email confirmation required (mailer_autoconfirm=false) + anonymous sign-in disabled => no headless session. Verified via bundle+tsc+live RPC instead. See docs/test-evidence/README.md for how to finish.
- Emulator + Metro LEFT RUNNING for the morning. Relaunch app anytime: adb shell am start -a android.intent.action.VIEW -d "dealish://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
