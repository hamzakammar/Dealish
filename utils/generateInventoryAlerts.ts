import { supabase } from '@/app/lib/supabase';
import { InventoryAlert, InventoryItem, Product } from '@/types/inventory';
import {
    calculateDaysSinceReceived,
    getRecommendationThreshold,
    shouldRecommendForSlowMoving
} from './recommendationThresholds';
import { calculateDaysUntilExpiration, calculateUrgencyScore } from './recommendations';

/**
 * Generate inventory alert for expiring or slow-moving items (V1: Simple notifications)
 */
export function generateInventoryAlert(
  inventoryItem: InventoryItem,
  product: Product
): Omit<InventoryAlert, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'> | null {
  const daysUntilExpiration = calculateDaysUntilExpiration(inventoryItem.expiration_date);
  const daysSinceReceived = calculateDaysSinceReceived(inventoryItem.received_date);
  const threshold = getRecommendationThreshold(product.category, product.subcategory, product.item_type);
  
  // Determine alert type and message
  let alertType: InventoryAlert['alert_type'];
  let message: string;
  let urgencyScore: number;

  // Prioritize expiration-based alerts (more urgent)
  if (daysUntilExpiration !== null) {
    urgencyScore = calculateUrgencyScore(
      daysUntilExpiration,
      inventoryItem.quantity,
      product.category
    );

    if (daysUntilExpiration < 0) {
      // Already expired
      alertType = 'expired';
      message = `${product.name} has expired. Consider removing from inventory.`;
    } else if (daysUntilExpiration === 0) {
      // Expiring today
      alertType = 'expiring_today';
      message = `${product.name} expires today! Use it soon or consider creating a deal.`;
    } else if (daysUntilExpiration <= 3) {
      // Expiring in 1-3 days
      alertType = 'expiring_soon';
      message = `${product.name} expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}. Consider using it soon.`;
    } else if (daysUntilExpiration <= 7) {
      // Expiring in 4-7 days
      alertType = 'expiring_soon';
      message = `${product.name} expires in ${daysUntilExpiration} days. Plan to use it this week.`;
    } else {
      // More than 7 days - don't alert yet
      return null;
    }
  } else if (shouldRecommendForSlowMoving(daysSinceReceived, threshold) && threshold && daysSinceReceived !== null) {
    // Slow-moving inventory alert
    alertType = 'slow_moving';
    urgencyScore = Math.min(50, Math.round((daysSinceReceived / threshold.daysSinceReceived) * 20));
    
    const categoryName = product.category ? product.category.replace('_', ' ') : 'items';
    message = threshold.suggestedMessage.replace(
      /items? logged \d+ days? ago/i,
      `${product.name} (${categoryName})`
    );
  } else {
    // No alert needed
    return null;
  }

  return {
    inventory_item_id: inventoryItem.id,
    product_id: product.id,
    alert_type: alertType,
    urgency_score: urgencyScore,
    days_until_expiration: daysUntilExpiration || undefined,
    days_since_received: daysSinceReceived || undefined,
    message,
    is_read: false,
  };
}

/**
 * Generate alerts for a specific inventory item
 */
export async function generateAlertForItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<boolean> {
  try {
    // Get the inventory item with product
    const { data: itemData, error: itemError } = await supabase
      .from('inventory_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('id', inventoryItemId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (itemError || !itemData) {
      throw itemError || new Error('Inventory item not found');
    }

    const item = itemData as InventoryItem & { product: Product };

    // Only generate for active items
    if (item.status !== 'active') {
      return false;
    }

    // Check if alert already exists for this item
    const { data: existingAlert } = await supabase
      .from('inventory_alerts')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('inventory_item_id', item.id)
      .eq('is_read', false)
      .maybeSingle();

    if (existingAlert) {
      return false; // Alert already exists
    }

    // Generate alert
    const alert = generateInventoryAlert(item, item.product);

    if (!alert) {
      return false;
    }

    // Insert alert
    const { error: insertError } = await supabase
      .from('inventory_alerts')
      .insert([{
        restaurant_id: restaurantId,
        ...alert,
      }]);

    if (insertError) {
      throw insertError;
    }

    return true;
  } catch (error) {
    console.error('Error generating alert for item:', error);
    throw error;
  }
}

/**
 * Generate alerts for all expiring/slow-moving items in a restaurant
 */
export async function generateAlertsForRestaurant(restaurantId: string): Promise<number> {
  try {
    // Get all active inventory items
    const { data: inventoryItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active');

    if (itemsError) throw itemsError;

    if (!inventoryItems || inventoryItems.length === 0) {
      return 0;
    }

    let alertsCreated = 0;

    for (const item of inventoryItems as (InventoryItem & { product: Product })[]) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('inventory_alerts')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('inventory_item_id', item.id)
        .eq('is_read', false)
        .maybeSingle();

      if (existingAlert) {
        continue; // Alert already exists
      }

      // Generate alert
      const alert = generateInventoryAlert(item, item.product);

      if (!alert) {
        continue;
      }

      // Insert alert
      const { error: insertError } = await supabase
        .from('inventory_alerts')
        .insert([{
          restaurant_id: restaurantId,
          ...alert,
        }]);

      if (insertError) {
        console.error('Error creating alert:', insertError);
        continue;
      }

      alertsCreated++;
    }

    return alertsCreated;
  } catch (error) {
    console.error('Error generating alerts:', error);
    throw error;
  }
}
