#!/usr/bin/env bash
# Readiness check for running Dealish on an Android emulator.
# Run: bash scripts/check-ready.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ok=0; todo=0
pass(){ echo "  [OK]   $1"; ok=$((ok+1)); }
fail(){ echo "  [TODO] $1"; todo=$((todo+1)); }

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
EMU="${ANDROID_HOME:-$HOME/Library/Android/sdk}/emulator/emulator"

echo "Dealish readiness:"

# Node version (Expo 54 wants 20 or 22 LTS)
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" = "20" ] || [ "$NODE_MAJOR" = "22" ]; then
  pass "Node $(node -v) (LTS)"
else
  fail "Node $(node -v 2>/dev/null) — switch to LTS: nvm install 22 && nvm use 22"
fi

# .env present + filled (no placeholders)
if [ -f .env ] && ! grep -q "<PASTE" .env; then
  pass ".env present and filled"
elif [ -f .env ]; then
  fail ".env still has <PASTE...> placeholders — paste your Supabase anon key + Maps key"
else
  fail ".env missing"
fi

# Android SDK
if [ -d "${ANDROID_HOME:-$HOME/Library/Android/sdk}" ]; then
  pass "Android SDK at ${ANDROID_HOME:-$HOME/Library/Android/sdk}"
else
  fail "Android SDK not found — finish Android Studio install + SDK Manager"
fi

# adb
if [ -x "$ADB" ]; then
  pass "adb present"
else
  fail "adb not found (expected $ADB)"
fi

# A booted emulator?
if [ -x "$ADB" ] && "$ADB" devices 2>/dev/null | grep -qE "emulator-[0-9]+\s+device"; then
  pass "emulator is BOOTED ($("$ADB" devices | grep -E 'emulator-[0-9]+' | head -1 | awk '{print $1}'))"
else
  AVDS="$([ -x "$EMU" ] && "$EMU" -list-avds 2>/dev/null | head -3 | tr '\n' ',' || true)"
  fail "no booted emulator — create/boot one in Android Studio (Device Manager). AVDs: ${AVDS:-none}"
fi

echo
if [ "$todo" -eq 0 ]; then
  echo "ALL CLEAR ($ok ok). Run:  bash scripts/dev-run.sh"
else
  echo "$ok ok, $todo to do. Fix the [TODO] items above, then re-run this check."
fi
