import { DealRecommendation, InventoryItem, Product } from '@/types/inventory';
import {
    calculateDaysSinceReceived,
    getRecommendationThreshold,
    shouldRecommendForSlowMoving
} from './recommendationThresholds';

/**
 * Calculate days until expiration
 * Returns the number of full days remaining (e.g., if expires tomorrow, returns 1)
 * Handles DATE strings (YYYY-MM-DD) correctly by parsing as local date, not UTC
 */
export function calculateDaysUntilExpiration(expirationDate: string | null | undefined): number | null {
  if (!expirationDate) return null;

  try {
    // Get today's date in local timezone (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse expiration date as local date (not UTC)
    // If it's a DATE string (YYYY-MM-DD), parse it manually to avoid UTC interpretation
    let expDate: Date;
    if (expirationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // It's a DATE string (YYYY-MM-DD), parse as local date
      const [year, month, day] = expirationDate.split('-').map(Number);
      expDate = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      // It's a full timestamp, parse normally
      expDate = new Date(expirationDate);
    }

    if (isNaN(expDate.getTime())) {
      // Invalid date
      return null;
    }
    
    // Ensure expiration date is also at midnight local time
    expDate.setHours(0, 0, 0, 0);

    // Calculate difference in milliseconds
    const diffTime = expDate.getTime() - today.getTime();
    // Convert to days (floor to get full days remaining)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    console.error('Error calculating days until expiration:', error);
    return null;
  }
}

/**
 * Calculate urgency score (0-100) based on expiration date and other factors
 */
export function calculateUrgencyScore(
  daysUntilExpiration: number | null,
  quantity: number,
  category?: string
): number {
  if (daysUntilExpiration === null) {
    return 0; // No expiration date = low urgency
  }

  // Base score from expiration date (more urgent = higher score)
  let score = Math.max(0, 100 - (daysUntilExpiration * 5));

  // Adjust for stock level (more stock = higher urgency to move it)
  score += Math.min(quantity / 10, 20);

  // Category adjustments (perishables = higher urgency)
  const perishableCategories = ['produce', 'dairy', 'meat', 'seafood'];
  if (category && perishableCategories.includes(category)) {
    score += 10;
  }

  // Cap at 100 and round to integer (database expects INTEGER type)
  return Math.round(Math.min(Math.max(score, 0), 100));
}

/**
 * Generate deal recommendation based on inventory item (V1: Product-based recommendations)
 * Uses BOTH expiration-based AND slow-moving inventory logic
 * Restaurant owner decides how to use the ingredient (grilled salmon, salmon risotto, etc.)
 */
export function generateDealRecommendation(
  inventoryItem: InventoryItem,
  product: Product
): Omit<DealRecommendation, 'id' | 'restaurant_id' | 'product_id' | 'created_at' | 'updated_at'> | null {
  const daysUntilExpiration = calculateDaysUntilExpiration(inventoryItem.expiration_date);
  const daysSinceReceived = calculateDaysSinceReceived(inventoryItem.received_date);
  const threshold = getRecommendationThreshold(product.category, product.subcategory, product.item_type);
  
  // Determine if this is expiration-based or slow-moving recommendation
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 14;
  const isSlowMoving = shouldRecommendForSlowMoving(daysSinceReceived, threshold);

  if (!isExpiringSoon && !isSlowMoving) {
    return null;
  }

  // Calculate urgency score (use expiration if available, otherwise use days since received)
  const urgencyDays = daysUntilExpiration !== null ? daysUntilExpiration : (daysSinceReceived || 0);
  const urgencyScore = calculateUrgencyScore(
    daysUntilExpiration,
    inventoryItem.quantity,
    product.category
  );

  let recommendationType: DealRecommendation['recommendation_type'];
  let discountPercent: number;
  let title: string;
  let description: string;

  // Prioritize expiration-based recommendations (more urgent)
  if (isExpiringSoon && daysUntilExpiration !== null) {
    if (daysUntilExpiration <= 0) {
      // Already expired or expiring today
      recommendationType = 'flash_sale';
      discountPercent = 50;
      title = `Flash Sale: ${product.name}`;
      description = `Limited time - ${product.name} expires today! Get ${discountPercent}% off.`;
    } else if (daysUntilExpiration <= 1) {
      // Expiring tomorrow
      recommendationType = 'flash_sale';
      discountPercent = 45;
      title = `Flash Sale: ${product.name}`;
      description = `Limited time - ${product.name} expires tomorrow! Get ${discountPercent}% off.`;
    } else if (daysUntilExpiration <= 3) {
      // Expiring in 2-3 days
      recommendationType = 'flash_sale';
      discountPercent = 40;
      title = `Flash Sale: ${product.name}`;
      description = `Limited time - ${product.name} expires in ${daysUntilExpiration} days! Get ${discountPercent}% off.`;
    } else if (daysUntilExpiration <= 7) {
      // Expiring in 4-7 days
      recommendationType = 'clearance';
      discountPercent = 30;
      title = `Clearance: ${product.name}`;
      description = `${product.name} on clearance - ${discountPercent}% off. Expires in ${daysUntilExpiration} days.`;
    } else {
      // Expiring in 8-14 days
      recommendationType = 'clearance';
      discountPercent = 20;
      title = `Clearance: ${product.name}`;
      description = `${product.name} on clearance - ${discountPercent}% off. Expires in ${daysUntilExpiration} days.`;
    }
  } else if (isSlowMoving && threshold && daysSinceReceived !== null) {
    // Slow-moving inventory recommendation
    recommendationType = 'clearance';
    // Discount based on how long it's been sitting
    if (daysSinceReceived >= threshold.daysSinceReceived * 2) {
      discountPercent = 40; // Been sitting twice as long as threshold
    } else if (daysSinceReceived >= threshold.daysSinceReceived * 1.5) {
      discountPercent = 30; // Been sitting 1.5x threshold
    } else {
      discountPercent = 20; // Just hit threshold
    }
    title = `Special: ${product.name}`;
    // Use the threshold's suggested message, but adapt it for the product
    const categoryName = product.category ? product.category.replace('_', ' ') : 'items';
    description = threshold.suggestedMessage.replace(
      /items? logged \d+ days? ago/i,
      `${categoryName}`
    );
  } else {
    return null;
  }

  return {
    inventory_item_id: inventoryItem.id,
    recommendation_type: recommendationType,
    suggested_title: title,
    suggested_description: description,
    suggested_discount_percent: discountPercent,
    urgency_score: urgencyScore,
    days_until_expiration: daysUntilExpiration || undefined,
    status: 'pending',
  };
}

/**
 * Generate deal recommendation for a menu item that uses an expiring ingredient
 * NOTE: This is for FUTURE use (V2+) - currently V1 recommends deals directly on products
 * Uses BOTH expiration-based AND slow-moving inventory logic
 */
export function generateDealRecommendationForMenuItem(
  inventoryItem: InventoryItem,
  product: Product,
  menuItem: { id: string; name: string } // Simplified type for future use
): Omit<DealRecommendation, 'id' | 'restaurant_id' | 'product_id' | 'created_at' | 'updated_at'> | null {
  const daysUntilExpiration = calculateDaysUntilExpiration(inventoryItem.expiration_date);
  const daysSinceReceived = calculateDaysSinceReceived(inventoryItem.received_date);
  const threshold = getRecommendationThreshold(product.category, product.subcategory, product.item_type);
  
  // Determine if this is expiration-based or slow-moving recommendation
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 14;
  const isSlowMoving = shouldRecommendForSlowMoving(daysSinceReceived, threshold);

  if (!isExpiringSoon && !isSlowMoving) {
    return null;
  }

  // Calculate urgency score (use expiration if available, otherwise use days since received)
  const urgencyDays = daysUntilExpiration !== null ? daysUntilExpiration : (daysSinceReceived || 0);
  const urgencyScore = calculateUrgencyScore(
    daysUntilExpiration,
    inventoryItem.quantity,
    product.category
  );

  let recommendationType: DealRecommendation['recommendation_type'];
  let discountPercent: number;
  let title: string;
  let description: string;

  // Prioritize expiration-based recommendations (more urgent)
  if (isExpiringSoon && daysUntilExpiration !== null) {
    if (daysUntilExpiration <= 0) {
      // Already expired or expiring today
      recommendationType = 'flash_sale';
      discountPercent = 50;
      title = `Flash Sale: ${menuItem.name}`;
      description = `Limited time deal! Our ${menuItem.name} is ${discountPercent}% off. Made fresh with ingredients expiring today.`;
    } else if (daysUntilExpiration <= 1) {
      // Expiring tomorrow
      recommendationType = 'flash_sale';
      discountPercent = 45;
      title = `Flash Sale: ${menuItem.name}`;
      description = `Limited time deal! Our ${menuItem.name} is ${discountPercent}% off. Made fresh with ingredients expiring tomorrow.`;
    } else if (daysUntilExpiration <= 3) {
      // Expiring in 2-3 days
      recommendationType = 'flash_sale';
      discountPercent = 40;
      title = `Flash Sale: ${menuItem.name}`;
      description = `Limited time deal! Our ${menuItem.name} is ${discountPercent}% off. Made fresh with ingredients expiring in ${daysUntilExpiration} days.`;
    } else if (daysUntilExpiration <= 7) {
      // Expiring in 4-7 days
      recommendationType = 'clearance';
      discountPercent = 30;
      title = `Special: ${menuItem.name}`;
      description = `${menuItem.name} on special - ${discountPercent}% off. Made with fresh ingredients expiring in ${daysUntilExpiration} days.`;
    } else {
      // Expiring in 8-14 days
      recommendationType = 'clearance';
      discountPercent = 20;
      title = `Special: ${menuItem.name}`;
      description = `${menuItem.name} on special - ${discountPercent}% off. Made with fresh ingredients expiring in ${daysUntilExpiration} days.`;
    }
  } else if (isSlowMoving && threshold && daysSinceReceived !== null) {
    // Slow-moving inventory recommendation
    recommendationType = 'clearance';
    // Discount based on how long it's been sitting
    if (daysSinceReceived >= threshold.daysSinceReceived * 2) {
      discountPercent = 40; // Been sitting twice as long as threshold
    } else if (daysSinceReceived >= threshold.daysSinceReceived * 1.5) {
      discountPercent = 30; // Been sitting 1.5x threshold
    } else {
      discountPercent = 20; // Just hit threshold
    }
    title = `Special: ${menuItem.name}`;
    description = threshold.suggestedMessage.replace(
      /items? logged \d+ days? ago/i,
      `items used in ${menuItem.name}`
    );
  } else {
    return null;
  }

  return {
    inventory_item_id: inventoryItem.id,
    recommendation_type: recommendationType,
    suggested_title: title,
    suggested_description: description,
    suggested_discount_percent: discountPercent,
    urgency_score: urgencyScore,
    days_until_expiration: daysUntilExpiration || undefined,
    status: 'pending',
  };
}

/**
 * Check if inventory item should generate a recommendation
 * Uses BOTH expiration-based AND slow-moving inventory logic
 */
export function shouldGenerateRecommendation(
  inventoryItem: InventoryItem,
  product?: Product
): boolean {
  // Only generate for active items
  if (inventoryItem.status !== 'active') {
    return false;
  }

  // Check expiration-based recommendation (if expiration date exists)
  const daysUntilExpiration = calculateDaysUntilExpiration(inventoryItem.expiration_date);
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 14;

  // Check slow-moving inventory recommendation (based on days since received)
  const daysSinceReceived = calculateDaysSinceReceived(inventoryItem.received_date);
  const threshold = product 
    ? getRecommendationThreshold(product.category, product.subcategory, product.item_type)
    : null;
  const isSlowMoving = shouldRecommendForSlowMoving(daysSinceReceived, threshold);

  // Generate recommendation if EITHER condition is met
  return isExpiringSoon || isSlowMoving;
}
