-- Add is_flagged column to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_flagged boolean DEFAULT false;

-- Function to auto-flag a deal when thumbs_down count hits the threshold.
-- Threshold: 5 thumbs_down AND more downs than ups.
-- Unflag automatically if votes swing back (e.g. admin clears bad votes).
CREATE OR REPLACE FUNCTION check_deal_accuracy()
RETURNS TRIGGER AS $$
DECLARE
  deal_id_val uuid;
  down_count  integer;
  up_count    integer;
BEGIN
  -- Works for INSERT, UPDATE, and DELETE
  deal_id_val := COALESCE(NEW.deal_id, OLD.deal_id);

  SELECT
    COUNT(*) FILTER (WHERE type = 'thumbs_down'),
    COUNT(*) FILTER (WHERE type = 'thumbs_up')
  INTO down_count, up_count
  FROM deal_flags
  WHERE deal_id = deal_id_val;

  UPDATE deals
  SET is_flagged = (down_count >= 5 AND down_count > up_count)
  WHERE id = deal_id_val;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fires after any vote change
DROP TRIGGER IF EXISTS deal_accuracy_check ON deal_flags;
CREATE TRIGGER deal_accuracy_check
AFTER INSERT OR UPDATE OR DELETE ON deal_flags
FOR EACH ROW EXECUTE FUNCTION check_deal_accuracy();
