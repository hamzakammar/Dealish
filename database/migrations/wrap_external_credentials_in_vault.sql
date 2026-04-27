-- Wrap external_system_credentials.api_key / api_secret / access_token /
-- refresh_token in Supabase Vault. The table now stores secret UUIDs only.
-- Mirrors wrap_oauth_tokens_in_vault.sql.
--
-- Idempotent: safe to re-run. Backfills any existing plaintext rows.

BEGIN;

ALTER TABLE public.external_system_credentials
  ADD COLUMN IF NOT EXISTS api_key_id       uuid,
  ADD COLUMN IF NOT EXISTS api_secret_id    uuid,
  ADD COLUMN IF NOT EXISTS access_token_id  uuid,
  ADD COLUMN IF NOT EXISTS refresh_token_id uuid;

CREATE OR REPLACE FUNCTION public.create_external_secret(p_value text, p_name text)
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

CREATE OR REPLACE FUNCTION public.update_external_secret(p_id uuid, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
BEGIN
  PERFORM vault.update_secret(p_id, p_value);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.read_external_secret(p_id uuid)
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

REVOKE EXECUTE ON FUNCTION public.create_external_secret(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_external_secret(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_external_secret(uuid)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_external_secret(text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_external_secret(uuid, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.read_external_secret(uuid)         FROM authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.create_external_secret(text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.update_external_secret(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.read_external_secret(uuid)         TO service_role;

DO $backfill$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, restaurant_id, system_type, api_key, api_secret, access_token, refresh_token
    FROM public.external_system_credentials
    WHERE (api_key       IS NOT NULL AND api_key_id       IS NULL)
       OR (api_secret    IS NOT NULL AND api_secret_id    IS NULL)
       OR (access_token  IS NOT NULL AND access_token_id  IS NULL)
       OR (refresh_token IS NOT NULL AND refresh_token_id IS NULL)
  LOOP
    IF r.api_key IS NOT NULL AND r.api_key != '' THEN
      UPDATE public.external_system_credentials
      SET api_key_id = vault.create_secret(
        r.api_key,
        'ext_api_key_' || r.restaurant_id::text || '_' || r.system_type
      )
      WHERE id = r.id;
    END IF;

    IF r.api_secret IS NOT NULL AND r.api_secret != '' THEN
      UPDATE public.external_system_credentials
      SET api_secret_id = vault.create_secret(
        r.api_secret,
        'ext_api_secret_' || r.restaurant_id::text || '_' || r.system_type
      )
      WHERE id = r.id;
    END IF;

    IF r.access_token IS NOT NULL AND r.access_token != '' THEN
      UPDATE public.external_system_credentials
      SET access_token_id = vault.create_secret(
        r.access_token,
        'ext_access_' || r.restaurant_id::text || '_' || r.system_type
      )
      WHERE id = r.id;
    END IF;

    IF r.refresh_token IS NOT NULL AND r.refresh_token != '' THEN
      UPDATE public.external_system_credentials
      SET refresh_token_id = vault.create_secret(
        r.refresh_token,
        'ext_refresh_' || r.restaurant_id::text || '_' || r.system_type
      )
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$backfill$;

ALTER TABLE public.external_system_credentials
  DROP COLUMN IF EXISTS api_key,
  DROP COLUMN IF EXISTS api_secret,
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

COMMIT;
