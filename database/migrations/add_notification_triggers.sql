-- =============================================================================
-- DEBT-004: OPTIONAL / NOT APPLIED BY DEFAULT.
-- This migration is NOT present in the live database (it was authored but never
-- applied). It is kept as an opt-in option for DB-side push notifications.
--
-- Before applying, note:
--   * Requires the pg_net extension and the GUCs app.supabase_url and
--     app.service_role_key to be set (ALTER DATABASE ... SET ...).
--   * The app ALREADY sends some of these notifications from client code:
--       - deal redemption  -> app/qr-scanner.tsx (after redeem_deal_scan)
--       - new partner       -> utils/notifications.ts
--     If you enable the matching trigger here you will get DUPLICATE pushes.
--     Pick one source per notification type.
--   * Column fixes vs the original draft: uses `partner` (not the non-existent
--     `is_partner`) and casts favourites with ::uuid[] (the column is uuid[]).
-- =============================================================================

-- Function to send push notification when a new deal is created
CREATE OR REPLACE FUNCTION notify_new_deal()
RETURNS TRIGGER AS $$
DECLARE
  restaurant_record RECORD;
  user_record RECORD;
BEGIN
  -- Get restaurant info
  SELECT id, name INTO restaurant_record
  FROM restaurants
  WHERE id = NEW.restaurant_id;

  -- Find users who favorited this restaurant and have push tokens
  FOR user_record IN
    SELECT id, push_token
    FROM profiles
    WHERE push_token IS NOT NULL
      AND favourites @> ARRAY[NEW.restaurant_id]::uuid[]
      AND (settings->>'notifications' IS NULL OR (settings->'notifications'->>'favorites')::boolean IS NOT FALSE)
  LOOP
    -- Call Edge Function to send notification
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', user_record.id,
        'type', 'new_deal',
        'title', 'New Deal at ' || restaurant_record.name,
        'body', NEW.title || COALESCE(' - ' || NEW.description, ''),
        'data', jsonb_build_object(
          'deal_id', NEW.id,
          'restaurant_id', NEW.restaurant_id,
          'screen', '/map'
        )
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new deals
DROP TRIGGER IF EXISTS trigger_notify_new_deal ON deals;
CREATE TRIGGER trigger_notify_new_deal
  AFTER INSERT ON deals
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION notify_new_deal();

-- Function to send push notification when a deal is redeemed (QR code scanned)
CREATE OR REPLACE FUNCTION notify_deal_redeemed()
RETURNS TRIGGER AS $$
DECLARE
  deal_record RECORD;
  restaurant_record RECORD;
  user_record RECORD;
BEGIN
  -- Get deal and restaurant info
  SELECT d.id, d.title, d.restaurant_id INTO deal_record
  FROM deals d
  WHERE d.id = NEW.deal_id;

  SELECT id, name INTO restaurant_record
  FROM restaurants
  WHERE id = deal_record.restaurant_id;

  -- Get user who redeemed the deal
  SELECT id, push_token, settings INTO user_record
  FROM profiles
  WHERE id = NEW.user_id;

  -- Check if user has push token and notifications enabled
  IF user_record.push_token IS NOT NULL 
     AND (user_record.settings->>'notifications' IS NULL 
          OR (user_record.settings->'notifications'->>'visits')::boolean IS NOT FALSE) THEN
    -- Call Edge Function to send notification
    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', user_record.id,
        'type', 'deal_redeemed',
        'title', 'Deal Redeemed!',
        'body', 'You redeemed: ' || deal_record.title || ' at ' || restaurant_record.name,
        'data', jsonb_build_object(
          'deal_id', deal_record.id,
          'restaurant_id', deal_record.restaurant_id,
          'screen', '/account'
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for deal redemptions
DROP TRIGGER IF EXISTS trigger_notify_deal_redeemed ON qr_code_scans;
CREATE TRIGGER trigger_notify_deal_redeemed
  AFTER INSERT ON qr_code_scans
  FOR EACH ROW
  EXECUTE FUNCTION notify_deal_redeemed();

-- Function to send push notification when a new restaurant partner is added
CREATE OR REPLACE FUNCTION notify_new_partner()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Only notify if restaurant is a partner (partner = true)
  IF NEW.partner = true THEN
    -- Find all users with push tokens who have notifications enabled
    FOR user_record IN
      SELECT id, push_token
      FROM profiles
      WHERE push_token IS NOT NULL
        AND (settings->>'notifications' IS NULL 
             OR (settings->'notifications'->>'deals')::boolean IS NOT FALSE)
    LOOP
      -- Call Edge Function to send notification
      PERFORM net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_id', user_record.id,
          'type', 'new_partner',
          'title', 'New Partner Restaurant!',
          'body', NEW.name || ' is now a Dealish partner',
          'data', jsonb_build_object(
            'restaurant_id', NEW.id,
            'screen', '/map'
          )
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new partner restaurants
DROP TRIGGER IF EXISTS trigger_notify_new_partner ON restaurants;
CREATE TRIGGER trigger_notify_new_partner
  AFTER INSERT ON restaurants
  FOR EACH ROW
  WHEN (NEW.partner = true)
  EXECUTE FUNCTION notify_new_partner();

-- Also trigger on UPDATE if is_partner changes from false to true
CREATE OR REPLACE FUNCTION notify_partner_status_change()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Only notify if partner changed from false to true
  IF OLD.partner = false AND NEW.partner = true THEN
    -- Find all users with push tokens who have notifications enabled
    FOR user_record IN
      SELECT id, push_token
      FROM profiles
      WHERE push_token IS NOT NULL
        AND (settings->>'notifications' IS NULL 
             OR (settings->'notifications'->>'deals')::boolean IS NOT FALSE)
    LOOP
      -- Call Edge Function to send notification
      PERFORM net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_id', user_record.id,
          'type', 'new_partner',
          'title', 'New Partner Restaurant!',
          'body', NEW.name || ' is now a Dealish partner',
          'data', jsonb_build_object(
            'restaurant_id', NEW.id,
            'screen', '/map'
          )
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for partner status changes
DROP TRIGGER IF EXISTS trigger_notify_partner_status_change ON restaurants;
CREATE TRIGGER trigger_notify_partner_status_change
  AFTER UPDATE ON restaurants
  FOR EACH ROW
  WHEN (OLD.partner IS DISTINCT FROM NEW.partner)
  EXECUTE FUNCTION notify_partner_status_change();
