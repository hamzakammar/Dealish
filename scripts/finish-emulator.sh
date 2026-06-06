#!/usr/bin/env bash
# Run this ONCE the API-35 system image finishes downloading.
# It creates the 'dealish' AVD and boots it, then tells you to run dev-run.sh.
set -uo pipefail
SDK="$HOME/Library/Android/sdk"
export ANDROID_HOME="$SDK"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
SM="$SDK/cmdline-tools/latest/bin/sdkmanager"
AVDM="$SDK/cmdline-tools/latest/bin/avdmanager"
EMU="$SDK/emulator/emulator"
ADB="$SDK/platform-tools/adb"
IMG="$SDK/system-images/android-35/google_apis/arm64-v8a/package.xml"

if [ ! -f "$IMG" ]; then
  echo "System image not done yet (no package.xml). Check progress:"
  echo "  tail -1 /tmp/sysimg.log"
  echo "If the download died, restart it:"
  echo "  yes | \"$SM\" 'system-images;android-35;google_apis;arm64-v8a'"
  exit 1
fi

echo "Creating AVD 'dealish'..."
echo "no" | "$AVDM" create avd -n dealish \
  -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7 --force

echo "Booting emulator (a window will open)..."
nohup "$EMU" -avd dealish -gpu auto -no-snapshot -no-boot-anim >/tmp/emulator.log 2>&1 &
"$ADB" wait-for-device
echo "Waiting for full boot..."
until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 3; done
echo "Emulator booted. Next:  bash scripts/dev-run.sh"
