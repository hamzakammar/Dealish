#!/usr/bin/env bash
# One command to build + install + launch Dealish on a booted Android emulator.
# Run: bash scripts/dev-run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Prefer Node 22 LTS if nvm is available (Expo 54 dislikes very new Node).
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm install 22
fi

# Resolve the Supabase key from .env then .env.local (.env.local wins, like Expo).
envval(){ local var="$1" v="" f line; for f in .env .env.local; do [ -f "$f" ] || continue; line="$(grep -E "^${var}=" "$f" | tail -1)"; [ -n "$line" ] && v="${line#*=}"; done; printf '%s' "$v"; }
ANON="$(envval EXPO_PUBLIC_SUPABASE_ANON_KEY)"
if [ -z "$ANON" ] || printf '%s' "$ANON" | grep -q "<PASTE"; then
  echo "ERROR: Supabase key missing/placeholder in .env(.local). Paste the Publishable/anon key first."
  exit 1
fi
if printf '%s' "$ANON" | grep -q "^sb_secret_"; then
  echo "ERROR: that's the SECRET key (sb_secret_). It would ship to every device and bypass RLS."
  echo "Use the Publishable key (sb_publishable_...) or legacy anon key (eyJ...) instead, then rotate the secret."
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

echo "Node: $(node -v)   |   ANDROID_HOME: $ANDROID_HOME"
echo "Building + installing the dev client (first run takes several minutes)..."
npx expo run:android
