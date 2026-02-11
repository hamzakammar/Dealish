-- ============================================================================
-- Add Subcategory and Item Type to Products
-- Allows granular recommendation thresholds based on category/subcategory/item_type
-- ============================================================================

-- Add subcategory column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS subcategory TEXT; -- e.g., 'fresh_raw', 'frozen', 'prepared', 'canned', 'dry'

-- Add item_type column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS item_type TEXT; -- e.g., 'fish_seafood', 'poultry', 'beef_pork_lamb', etc.

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory) WHERE subcategory IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_item_type ON products(item_type) WHERE item_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.subcategory IS 'Product subcategory for granular tracking (fresh_raw, frozen, prepared, canned, dry)';
COMMENT ON COLUMN products.item_type IS 'Specific item type for recommendation thresholds (fish_seafood, poultry, beef_pork_lamb, etc.)';
