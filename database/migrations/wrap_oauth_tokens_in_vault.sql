-- Wrap google_oauth_tokens.access_token / refresh_token in Supabase Vault.
-- Tokens move out of plaintext columns; the table now stores secret UUIDs.
-- Edge functions read/write tokens via SECURITY DEFINER RPCs that wrap vault.*
-- so the service role never holds raw vault.* grants.
--
-- Idempotent: safe to re-run. Backfills any existing plaintext rows.

BEGIN;

-- 1. Add uuid columns referencing vault.secrets (nullable during migration).
ALTER TABLE public.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS access_token_id  uuid,
  ADD COLUMN IF NOT EXISTS refresh_token_id uuid;

-- 2. RPCs (SECURITY DEFINER) that the edge functions call via supabase.rpc().
--    Service role is the only grantee — these never run from a user JWT.

CREATE OR REPLACE FUNCTION public.create_oauth_secret(p_value text, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  v_id := vault.create_secret(p_value, p_name);
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.update_oauth_secret(p_id uuid, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
BEGIN
  PERFORM vault.update_secret(p_id, p_value);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.read_oauth_secret(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
DECLARE
  v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE id = p_id;
  RETURN v;
END;
$fn$;

-- Lock down: only service_role can call these. Authenticated end-users must
-- never read/write OAuth tokens — only the cron + OAuth callback edge funcs.
REVOKE EXECUTE ON FUNCTION public.create_oauth_secret(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_oauth_secret(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_oauth_secret(uuid)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_oauth_secret(text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_oauth_secret(uuid, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.read_oauth_secret(uuid)         FROM authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_oauth_secret(text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.update_oauth_secret(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.read_oauth_secret(uuid)         TO service_role;

-- 3. Backfill: any existing plaintext rows → Vault. Safe no-op when 0 rows.
DO $backfill$
DECLARE
  r RECORD;
  v_access_id  uuid;
  v_refresh_id uuid;
BEGIN
  FOR r IN
    SELECT id, user_id, restaurant_id, access_token, refresh_token
    FROM public.google_oauth_tokens
    WHERE (access_token IS NOT NULL AND access_token_id IS NULL)
       OR (refresh_token IS NOT NULL AND refresh_token_id IS NULL)
  LOOP
    IF r.access_token IS NOT NULL AND r.access_token != '' THEN
      v_access_id := vault.create_secret(
        r.access_token,
        'oauth_access_' || r.user_id::text || '_' || r.restaurant_id::text
      );
    ELSE
      v_access_id := NULL;
    END IF;

    IF r.refresh_token IS NOT NULL AND r.refresh_token != '' THEN
      v_refresh_id := vault.create_secret(
        r.refresh_token,
        'oauth_refresh_' || r.user_id::text || '_' || r.restaurant_id::text
      );
    ELSE
      v_refresh_id := NULL;
    END IF;

    UPDATE public.google_oauth_tokens
    SET access_token_id  = v_access_id,
        refresh_token_id = v_refresh_id
    WHERE id = r.id;
  END LOOP;
END;
$backfill$;

-- 4. Drop plaintext columns now that backfill is done.
ALTER TABLE public.google_oauth_tokens
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

COMMIT;
