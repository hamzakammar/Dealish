-- Tracks outbound sync failures from sheets-outbound edge function.
-- Populated when the Apps Script webhook is unreachable after all retry attempts.
CREATE TABLE IF NOT EXISTS sheet_sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES sheet_integrations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_sync_errors_integration ON sheet_sync_errors(integration_id, created_at DESC);

ALTER TABLE sheet_sync_errors ENABLE ROW LEVEL SECURITY;

-- Restaurant owners can see errors for their own integrations
CREATE POLICY "owner_read_sync_errors" ON sheet_sync_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sheet_integrations si
      JOIN restaurants r ON r.id = si.restaurant_id
      WHERE si.id = sheet_sync_errors.integration_id
        AND r.owner_id = auth.uid()
    )
  );

-- Service role (edge function) can insert
CREATE POLICY "service_role_write_sync_errors" ON sheet_sync_errors
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
