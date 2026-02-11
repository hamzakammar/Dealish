-- ============================================================================
-- Inventory Management System Migration
-- Creates tables for products, inventory items, sync logs, credentials, and recommendations
-- ============================================================================

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  barcode TEXT, -- UPC/EAN barcode
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "produce", "dairy", "meat", "beverages", "dry_goods"
  unit TEXT NOT NULL DEFAULT 'each', -- "lbs", "oz", "each", "case", "gallon", "liter"
  base_unit TEXT, -- Base unit for conversions (e.g., "oz" for weight, "ml" for volume)
  supplier TEXT,
  external_product_id TEXT, -- ID from MarketMan/Restaurant365/etc
  external_system TEXT, -- "marketman", "restaurant365", "oracle_simphony", null for manual
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, barcode) -- One product per barcode per restaurant
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL, -- Current unit (can differ from product.unit for conversions)
  unit_cost DECIMAL CHECK (unit_cost >= 0),
  purchase_date DATE,
  expiration_date DATE,
  received_date TIMESTAMP DEFAULT NOW(),
  location TEXT, -- "freezer", "refrigerator", "pantry", "dry_storage", "counter"
  batch_number TEXT,
  supplier TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'sold', 'wasted', 'low_stock')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create inventory_sync_logs table
CREATE TABLE IF NOT EXISTS inventory_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  external_system TEXT NOT NULL CHECK (external_system IN ('marketman', 'restaurant365', 'oracle_simphony')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
  items_synced INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  errors JSONB, -- Store error details as JSON
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create external_system_credentials table
CREATE TABLE IF NOT EXISTS external_system_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL CHECK (system_type IN ('marketman', 'restaurant365', 'oracle_simphony')),
  api_key TEXT, -- Encrypted (should be encrypted at application level)
  api_secret TEXT, -- Encrypted
  account_id TEXT,
  access_token TEXT, -- For OAuth systems
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  sync_schedule TEXT, -- "daily", "hourly", "manual", "realtime"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, system_type) -- One credential set per system per restaurant
);

-- Create deal_recommendations table
CREATE TABLE IF NOT EXISTS deal_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('flash_sale', 'clearance', 'bundle', 'custom')),
  suggested_title TEXT NOT NULL,
  suggested_description TEXT,
  suggested_discount_percent DECIMAL CHECK (suggested_discount_percent >= 0 AND suggested_discount_percent <= 100),
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 100), -- 1-100 based on expiration
  days_until_expiration INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'created', 'dismissed')),
  deal_id UUID REFERENCES deals(id), -- If recommendation was turned into a deal
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_external ON products(external_system, external_product_id) WHERE external_product_id IS NOT NULL;

-- Create indexes for inventory_items table
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiration_date ON inventory_items(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiring_soon ON inventory_items(restaurant_id, expiration_date, status) WHERE expiration_date IS NOT NULL AND status = 'active';

-- Create indexes for inventory_sync_logs table
CREATE INDEX IF NOT EXISTS idx_sync_logs_restaurant_id ON inventory_sync_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_external_system ON inventory_sync_logs(external_system);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced_at ON inventory_sync_logs(synced_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON inventory_sync_logs(status);

-- Create indexes for external_system_credentials table
CREATE INDEX IF NOT EXISTS idx_credentials_restaurant_id ON external_system_credentials(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_credentials_system_type ON external_system_credentials(system_type);
CREATE INDEX IF NOT EXISTS idx_credentials_is_active ON external_system_credentials(is_active) WHERE is_active = true;

-- Create indexes for deal_recommendations table
CREATE INDEX IF NOT EXISTS idx_recommendations_restaurant_id ON deal_recommendations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON deal_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_urgency_score ON deal_recommendations(urgency_score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recommendations_product_id ON deal_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_inventory_item_id ON deal_recommendations(inventory_item_id) WHERE inventory_item_id IS NOT NULL;

-- Enable Row Level Security on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_system_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR PRODUCTS
-- ============================================================================

-- Policy: Restaurant owners can view their own products
CREATE POLICY "Restaurant owners can view their products"
  ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can insert their own products
CREATE POLICY "Restaurant owners can insert their products"
  ON products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own products
CREATE POLICY "Restaurant owners can update their products"
  ON products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = products.restaurant_id
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
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own products
CREATE POLICY "Restaurant owners can delete their products"
  ON products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = products.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- ============================================================================
-- RLS POLICIES FOR INVENTORY_ITEMS
-- ============================================================================

-- Policy: Restaurant owners can view their own inventory items
CREATE POLICY "Restaurant owners can view their inventory items"
  ON inventory_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can insert their own inventory items
CREATE POLICY "Restaurant owners can insert their inventory items"
  ON inventory_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own inventory items
CREATE POLICY "Restaurant owners can update their inventory items"
  ON inventory_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_items.restaurant_id
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
      WHERE restaurants.id = inventory_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own inventory items
CREATE POLICY "Restaurant owners can delete their inventory items"
  ON inventory_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- ============================================================================
-- RLS POLICIES FOR INVENTORY_SYNC_LOGS
-- ============================================================================

-- Policy: Restaurant owners can view their own sync logs
CREATE POLICY "Restaurant owners can view their sync logs"
  ON inventory_sync_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_sync_logs.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: System can insert sync logs (via service role or authenticated users)
CREATE POLICY "System can insert sync logs"
  ON inventory_sync_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = inventory_sync_logs.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- ============================================================================
-- RLS POLICIES FOR EXTERNAL_SYSTEM_CREDENTIALS
-- ============================================================================

-- Policy: Restaurant owners can view their own credentials
CREATE POLICY "Restaurant owners can view their credentials"
  ON external_system_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = external_system_credentials.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can insert their own credentials
CREATE POLICY "Restaurant owners can insert their credentials"
  ON external_system_credentials
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = external_system_credentials.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own credentials
CREATE POLICY "Restaurant owners can update their credentials"
  ON external_system_credentials
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = external_system_credentials.restaurant_id
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
      WHERE restaurants.id = external_system_credentials.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own credentials
CREATE POLICY "Restaurant owners can delete their credentials"
  ON external_system_credentials
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = external_system_credentials.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- ============================================================================
-- RLS POLICIES FOR DEAL_RECOMMENDATIONS
-- ============================================================================

-- Policy: Restaurant owners can view their own recommendations
CREATE POLICY "Restaurant owners can view their recommendations"
  ON deal_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deal_recommendations.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: System can insert recommendations (via service role or authenticated users)
CREATE POLICY "System can insert recommendations"
  ON deal_recommendations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deal_recommendations.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own recommendations
CREATE POLICY "Restaurant owners can update their recommendations"
  ON deal_recommendations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deal_recommendations.restaurant_id
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
      WHERE restaurants.id = deal_recommendations.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own recommendations
CREATE POLICY "Restaurant owners can delete their recommendations"
  ON deal_recommendations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = deal_recommendations.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO authenticated;
GRANT SELECT, INSERT ON inventory_sync_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON external_system_credentials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_recommendations TO authenticated;

-- ============================================================================
-- CREATE FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_system_credentials_updated_at BEFORE UPDATE ON external_system_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_recommendations_updated_at BEFORE UPDATE ON deal_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
