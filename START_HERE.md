# START HERE — run Dealish on an emulator

You do **4 things**. I (the agent) do the rest — the build and the on-screen testing — once your machine is ready.

## 1. Android Studio (one-time)
- Finish installing Android Studio.
- Open it → **SDK Manager**: install an SDK Platform (API 34) + **Platform-Tools**.
- **Device Manager → Create device** → a Pixel + API 34 image → **press ▶ to boot it**.
- Add to `~/.zshrc`, then `source ~/.zshrc`:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
  ```

## 2. Paste two secret keys
Open `.env` (already created for you, URL pre-filled) and replace:
- `<PASTE_SUPABASE_ANON_KEY>` → Supabase Dashboard → Project Settings → API → anon/public key
- `<PASTE_GOOGLE_MAPS_API_KEY>` → your Google Maps key (optional; only affects map tiles)

## 3. Run the database setup (one paste)
Supabase Dashboard → SQL Editor → paste **`database/RUN_ALL_SETUP.sql`** → before running,
replace `YOUR_EMAIL_HERE` (bottom of the file) with your login email → Run.

## 4. Tell me "ready"
I'll verify with `bash scripts/check-ready.sh`, then build + launch with
`bash scripts/dev-run.sh` and drive the app to test:
- Map → Filters → **Planning for** (time-travel deals)
- Account → **Enter admin access code** / **Switch to Admin View**
- Operator → Admin → **Admin Access Codes**

---

### Quick status check anytime
```bash
bash scripts/check-ready.sh
```
Prints `[OK]` / `[TODO]` for Node version, `.env`, Android SDK, adb, and a booted emulator.
