import { ProductCategory } from '@/types/inventory';

/**
 * Default shelf life in days for different product categories
 * Used to auto-suggest expiration dates
 */
export const DEFAULT_SHELF_LIFE: Record<ProductCategory, number> = {
  produce: 5,        // Fresh produce: 5 days
  dairy: 7,          // Dairy products: 7 days
  meat: 3,           // Fresh meat: 3 days
  seafood: 2,        // Seafood: 2 days
  beverages: 30,     // Beverages: 30 days
  dry_goods: 90,     // Dry goods: 90 days
  frozen: 180,       // Frozen items: 180 days
  bakery: 3,         // Bakery items: 3 days
  deli: 5,           // Deli items: 5 days
  condiments: 60,    // Condiments: 60 days
  spices: 365,       // Spices: 1 year
  other: 7,          // Default: 7 days
};

/**
 * Get suggested expiration date based on product category
 * @param category Product category
 * @param purchaseDate Purchase date (defaults to today)
 * @returns Suggested expiration date as YYYY-MM-DD string
 */
export function getSuggestedExpirationDate(
  category?: ProductCategory | string | null,
  purchaseDate?: Date | string
): string {
  const days = category && category in DEFAULT_SHELF_LIFE
    ? DEFAULT_SHELF_LIFE[category as ProductCategory]
    : DEFAULT_SHELF_LIFE.other;

  const purchase = purchaseDate
    ? (typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate)
    : new Date();

  const expiration = new Date(purchase);
  expiration.setDate(expiration.getDate() + days);

  return expiration.toISOString().split('T')[0];
}

/**
 * Get default storage location based on product category
 */
export function getDefaultLocation(category?: ProductCategory | string | null): string {
  const locationMap: Record<string, string> = {
    produce: 'refrigerator',
    dairy: 'refrigerator',
    meat: 'refrigerator',
    seafood: 'refrigerator',
    frozen: 'freezer',
    bakery: 'counter',
    deli: 'refrigerator',
    beverages: 'pantry',
    dry_goods: 'dry_storage',
    condiments: 'pantry',
    spices: 'dry_storage',
  };

  return category && category in locationMap
    ? locationMap[category]
    : 'pantry';
}
