-- ============================================================================
-- Inventory Alerts Migration
-- Creates table for expiring inventory notifications (V1: Simple alerts, not deal recommendations)
-- ============================================================================

-- Create inventory_alerts table (replaces deal_recommendations for V1)
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('expiring_soon', 'expiring_today', 'expired', 'slow_moving')),
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 100),
  days_until_expiration INTEGER,
  days_since_received INTEGER,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_restaurant_id ON inventory_alerts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_inventory_item_id ON inventory_alerts(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_is_read ON inventory_alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_created_at ON inventory_alerts(created_at DESC);

-- ============================================================================
-- RLS POLICIES FOR INVENTORY_ALERTS
-- ============================================================================

ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners can view their own alerts
CREATE POLICY "Restaurant owners can view their alerts"
  ON inventory_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_alerts.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: System can insert alerts (via service role or authenticated users)
CREATE POLICY "System can insert alerts"
  ON inventory_alerts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_alerts.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own alerts (mark as read, dismiss)
CREATE POLICY "Restaurant owners can update their alerts"
  ON inventory_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_alerts.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_alerts.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own alerts
CREATE POLICY "Restaurant owners can delete their alerts"
  ON inventory_alerts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_alerts.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_alerts TO authenticated;
