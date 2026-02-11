export type Product = {
  id: string;
  restaurant_id: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string; // e.g., 'fresh_raw', 'frozen', 'prepared'
  item_type?: string; // e.g., 'fish_seafood', 'poultry', 'beef_pork_lamb'
  unit: string;
  base_unit?: string;
  supplier?: string;
  external_product_id?: string;
  external_system?: 'marketman' | 'restaurant365' | 'oracle_simphony' | null;
  image_url?: string;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  restaurant_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  purchase_date?: string;
  expiration_date?: string;
  received_date: string;
  location?: string;
  batch_number?: string;
  supplier?: string;
  status: 'active' | 'expired' | 'sold' | 'wasted' | 'low_stock';
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type InventoryItemWithProduct = InventoryItem & {
  product: Product;
};

export type InventorySyncLog = {
  id: string;
  restaurant_id: string;
  external_system: 'marketman' | 'restaurant365' | 'oracle_simphony';
  sync_type: 'manual' | 'scheduled' | 'webhook';
  status: 'success' | 'failed' | 'partial';
  items_synced: number;
  items_created: number;
  items_updated: number;
  errors?: any;
  synced_at: string;
  created_at: string;
};

export type ExternalSystemCredentials = {
  id: string;
  restaurant_id: string;
  system_type: 'marketman' | 'restaurant365' | 'oracle_simphony';
  api_key?: string;
  api_secret?: string;
  account_id?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_active: boolean;
  last_sync_at?: string;
  sync_schedule?: 'daily' | 'hourly' | 'manual' | 'realtime';
  created_at: string;
  updated_at: string;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  image_url?: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type MenuItemIngredient = {
  id: string;
  menu_item_id: string;
  product_id: string;
  quantity: number;
  unit: string;
  is_required: boolean;
  created_at: string;
};

export type MenuItemWithIngredients = MenuItem & {
  ingredients: (MenuItemIngredient & { product: Product })[];
};

export type InventoryAlert = {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  product_id: string;
  alert_type: 'expiring_soon' | 'expiring_today' | 'expired' | 'slow_moving';
  urgency_score?: number;
  days_until_expiration?: number;
  days_since_received?: number;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryAlertWithProduct = InventoryAlert & {
  product: Product;
  inventory_item?: InventoryItem;
};

// Keep DealRecommendation for future use (V2+)
export type DealRecommendation = {
  id: string;
  restaurant_id: string;
  inventory_item_id?: string;
  product_id: string;
  menu_item_id?: string; // Menu item that uses the expiring ingredient
  recommendation_type: 'flash_sale' | 'clearance' | 'bundle' | 'custom';
  suggested_title: string;
  suggested_description?: string;
  suggested_discount_percent?: number;
  urgency_score?: number;
  days_until_expiration?: number;
  status: 'pending' | 'approved' | 'rejected' | 'created' | 'dismissed';
  deal_id?: string;
  created_at: string;
  updated_at: string;
};

export type DealRecommendationWithProduct = DealRecommendation & {
  product: Product;
  inventory_item?: InventoryItem;
  menu_item?: MenuItem;
};

export type InventoryStats = {
  total_items: number;
  total_value: number;
  expiring_today: number;
  expiring_this_week: number;
  expiring_next_week: number;
  low_stock_items: number;
  expired_items: number;
};

export type UnitConversion = {
  from: string;
  to: string;
  factor: number; // Multiply from unit by factor to get to unit
};

// Common unit conversions
export const UNIT_CONVERSIONS: Record<string, UnitConversion[]> = {
  // Weight conversions (to base unit: grams)
  weight: [
    { from: 'g', to: 'g', factor: 1 },
    { from: 'kg', to: 'g', factor: 1000 },
    { from: 'oz', to: 'g', factor: 28.3495 },
    { from: 'lb', to: 'g', factor: 453.592 },
    { from: 'lbs', to: 'g', factor: 453.592 },
    { from: 'oz', to: 'lb', factor: 0.0625 },
    { from: 'lb', to: 'oz', factor: 16 },
    { from: 'g', to: 'kg', factor: 0.001 },
    { from: 'kg', to: 'lb', factor: 2.20462 },
    { from: 'lb', to: 'kg', factor: 0.453592 },
  ],
  // Volume conversions (to base unit: milliliters)
  volume: [
    { from: 'ml', to: 'ml', factor: 1 },
    { from: 'l', to: 'ml', factor: 1000 },
    { from: 'liter', to: 'ml', factor: 1000 },
    { from: 'fl oz', to: 'ml', factor: 29.5735 },
    { from: 'cup', to: 'ml', factor: 236.588 },
    { from: 'pint', to: 'ml', factor: 473.176 },
    { from: 'quart', to: 'ml', factor: 946.353 },
    { from: 'gallon', to: 'ml', factor: 3785.41 },
    { from: 'fl oz', to: 'cup', factor: 0.125 },
    { from: 'cup', to: 'fl oz', factor: 8 },
  ],
};

// Product categories
export const PRODUCT_CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'beverages',
  'dry_goods',
  'frozen',
  'bakery',
  'deli',
  'condiments',
  'spices',
  'other',
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

// Product subcategories for more granular tracking
export const PRODUCT_SUBCATEGORIES = [
  'fresh_raw',
  'frozen',
  'prepared',
  'canned',
  'dry',
] as const;

export type ProductSubcategory = typeof PRODUCT_SUBCATEGORIES[number];

// Product item types for detailed categorization
export const PRODUCT_ITEM_TYPES = [
  // Proteins
  'fish_seafood',
  'poultry',
  'beef_pork_lamb',
  'marinated_cooked_proteins',
  'frozen_fish_seafood',
  'frozen_poultry',
  'frozen_beef_pork_lamb',
  'frozen_prepared_proteins',
  // Produce
  'leafy_greens_herbs',
  'vegetables',
  'fruit',
  // Dairy & Eggs
  'milk_cream_soft_cheese',
  'hard_cheese_butter',
  'eggs',
  // Prepared Foods
  'pastries_baked_goods',
  'breads',
  'prepared_desserts',
  'frozen_apps_sides',
  'frozen_desserts',
  // Pantry
  'pasta_rice_flour',
  'house_made_sauces_dressings',
  'canned_foods',
  // Alcohol
  'spirits',
  'wine',
  'sparkling',
  'beer_kegs',
  'beer_cans_bottles',
  'canned_cocktails_seltzers',
  // Non-Alcoholic
  'canned_sodas',
  'fresh_squeezed_juices',
  'commercial_juices',
  'syrups_mixers',
] as const;

export type ProductItemType = typeof PRODUCT_ITEM_TYPES[number];

// Storage locations
export const STORAGE_LOCATIONS = [
  'freezer',
  'refrigerator',
  'pantry',
  'dry_storage',
  'counter',
  'walk_in',
  'other',
] as const;

export type StorageLocation = typeof STORAGE_LOCATIONS[number];
