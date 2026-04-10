-- API Keys for restaurant owners (used by Apps Script to authenticate)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,      -- SHA-256 of the actual key, never store plaintext
  label TEXT NOT NULL DEFAULT 'Default',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only the restaurant owner can see/manage their keys
CREATE POLICY "owner_manage_api_keys" ON api_keys
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Sheet integrations: one per restaurant per sheet
CREATE TABLE IF NOT EXISTS sheet_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,                    -- Google Sheet ID from URL
  sheet_tab TEXT NOT NULL DEFAULT 'Sheet1', -- Tab/worksheet name
  webhook_url TEXT,                          -- Apps Script doPost URL for outbound sync
  detected_mapping JSONB,                    -- LLM-detected column mapping
  mapping_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, sheet_id)
);

ALTER TABLE sheet_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_sheet_integrations" ON sheet_integrations
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Track synced rows to enable bidirectional sync without loops
CREATE TABLE IF NOT EXISTS sheet_synced_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES sheet_integrations(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,                -- 1-based row number in sheet
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  row_hash TEXT,                             -- Hash of last synced row data to detect changes
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_direction TEXT NOT NULL DEFAULT 'sheet_to_dealish', -- 'sheet_to_dealish' | 'dealish_to_sheet'
  UNIQUE(integration_id, row_index)
);

ALTER TABLE sheet_synced_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_view_synced_rows" ON sheet_synced_rows
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM sheet_integrations WHERE restaurant_id IN (
        SELECT id FROM restaurants WHERE owner_id = auth.uid()
      )
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_restaurant ON api_keys(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sheet_integrations_restaurant ON sheet_integrations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sheet_synced_rows_integration ON sheet_synced_rows(integration_id);
CREATE INDEX IF NOT EXISTS idx_sheet_synced_rows_deal ON sheet_synced_rows(deal_id);
