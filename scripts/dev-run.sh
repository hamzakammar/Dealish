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

# Refuse to build with an unconfigured .env (avoids a long build that can't talk to Supabase).
if [ ! -f .env ] || grep -q "<PASTE" .env; then
  echo "ERROR: .env is missing or still has <PASTE...> placeholders."
  echo "Edit /Users/hamza.ammar/Dealish/.env first (Supabase anon key + Maps key)."
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

echo "Node: $(node -v)   |   ANDROID_HOME: $ANDROID_HOME"
echo "Building + installing the dev client (first run takes several minutes)..."
npx expo run:android
