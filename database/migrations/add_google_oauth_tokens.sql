-- Store Google OAuth tokens per restaurant owner
-- Tokens are encrypted at rest via Supabase Vault (or stored as-is if Vault not enabled)
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only the owner can read/write their own tokens
CREATE POLICY "owner_manage_google_tokens" ON google_oauth_tokens
  FOR ALL USING (user_id = auth.uid());

-- Service role can read all (needed by edge function cron)
CREATE POLICY "service_role_read_google_tokens" ON google_oauth_tokens
  FOR SELECT USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_restaurant ON google_oauth_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_user ON google_oauth_tokens(user_id);

-- Add source column to sheet_integrations to distinguish OAuth vs Apps Script integrations
ALTER TABLE sheet_integrations ADD COLUMN IF NOT EXISTS sync_method TEXT NOT NULL DEFAULT 'apps_script';
-- 'oauth_cron' = Google OAuth + polling, 'apps_script' = manual Apps Script setup

-- Enable pg_cron extension (run as superuser if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule polling every 5 minutes via Supabase cron
-- This calls the sheets-poll edge function
-- Note: set this up in Supabase dashboard → Database → Extensions → pg_cron
-- Then run:
-- SELECT cron.schedule(
--   'sheets-poll',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://hpsoqjpzebkkxdqapegl.supabase.co/functions/v1/sheets-poll',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
