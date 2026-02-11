-- ============================================================================
-- Menu Items Migration
-- Creates tables for menu items and their ingredient relationships
-- Allows recommendations to be made on menu items that use expiring ingredients
-- ============================================================================

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "appetizer", "entree", "dessert", "beverage", "burger", "pizza"
  price DECIMAL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create menu_item_ingredients table (many-to-many relationship)
-- Links menu items to products (ingredients) they use
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL CHECK (quantity >= 0), -- Amount of ingredient needed
  unit TEXT NOT NULL, -- Unit for the quantity (e.g., "oz", "lb", "each")
  is_required BOOLEAN DEFAULT true, -- If false, ingredient is optional/substitutable
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(menu_item_id, product_id) -- One entry per menu item per ingredient
);

-- Add menu_item_id to deal_recommendations table
ALTER TABLE deal_recommendations
ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu_item_id ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_product_id ON menu_item_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_deal_recommendations_menu_item_id ON deal_recommendations(menu_item_id) WHERE menu_item_id IS NOT NULL;

-- ============================================================================
-- RLS POLICIES FOR MENU_ITEMS
-- ============================================================================

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners can view their own menu items
CREATE POLICY "Restaurant owners can view their menu items"
  ON menu_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Public can view available menu items (for customer app)
CREATE POLICY "Public can view available menu items"
  ON menu_items
  FOR SELECT
  USING (is_available = true);

-- Policy: Restaurant owners can insert their own menu items
CREATE POLICY "Restaurant owners can insert their menu items"
  ON menu_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update their own menu items
CREATE POLICY "Restaurant owners can update their menu items"
  ON menu_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
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
      WHERE restaurants.id = menu_items.restaurant_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete their own menu items
CREATE POLICY "Restaurant owners can delete their menu items"
  ON menu_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = menu_items.restaurant_id
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
-- RLS POLICIES FOR MENU_ITEM_INGREDIENTS
-- ============================================================================

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

-- Policy: Restaurant owners can view ingredients for their menu items
CREATE POLICY "Restaurant owners can view menu item ingredients"
  ON menu_item_ingredients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM menu_items
      JOIN restaurants ON restaurants.id = menu_items.restaurant_id
      WHERE menu_items.id = menu_item_ingredients.menu_item_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can insert ingredients for their menu items
CREATE POLICY "Restaurant owners can insert menu item ingredients"
  ON menu_item_ingredients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menu_items
      JOIN restaurants ON restaurants.id = menu_items.restaurant_id
      WHERE menu_items.id = menu_item_ingredients.menu_item_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can update ingredients for their menu items
CREATE POLICY "Restaurant owners can update menu item ingredients"
  ON menu_item_ingredients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM menu_items
      JOIN restaurants ON restaurants.id = menu_items.restaurant_id
      WHERE menu_items.id = menu_item_ingredients.menu_item_id
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
      SELECT 1 FROM menu_items
      JOIN restaurants ON restaurants.id = menu_items.restaurant_id
      WHERE menu_items.id = menu_item_ingredients.menu_item_id
      AND restaurants.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'owner')
    )
  );

-- Policy: Restaurant owners can delete ingredients for their menu items
CREATE POLICY "Restaurant owners can delete menu item ingredients"
  ON menu_item_ingredients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM menu_items
      JOIN restaurants ON restaurants.id = menu_items.restaurant_id
      WHERE menu_items.id = menu_item_ingredients.menu_item_id
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
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_items TO authenticated;
GRANT SELECT ON menu_items TO anon; -- Public can view available items
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_item_ingredients TO authenticated;
