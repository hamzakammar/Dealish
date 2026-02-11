import { supabase } from '@/app/lib/supabase';
import { InventoryItem, Product } from '@/types/inventory';
import { generateDealRecommendation, shouldGenerateRecommendation } from './recommendations';

/**
 * Generate deal recommendations for all expiring inventory items in a restaurant
 */
export async function generateRecommendationsForRestaurant(restaurantId: string): Promise<number> {
  try {
    // Get all active inventory items (with or without expiration dates)
    // Slow-moving inventory recommendations don't require expiration dates
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

    let recommendationsCreated = 0;

    for (const item of inventoryItems as (InventoryItem & { product: Product })[]) {
      // Check if recommendation should be generated (pass product for slow-moving check)
      if (!shouldGenerateRecommendation(item, item.product)) {
        continue;
      }

      // Check if recommendation already exists for this inventory item
      const { data: existingRec } = await supabase
        .from('deal_recommendations')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('inventory_item_id', item.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRec) {
        // Recommendation already exists, skip
        continue;
      }

      // Generate recommendation for the PRODUCT itself (V1 approach)
      // Restaurant owner decides how to use the ingredient (grilled salmon, salmon risotto, etc.)
      const recommendation = generateDealRecommendation(item, item.product);

      if (!recommendation) {
        continue;
      }

      // Insert recommendation
      const { error: insertError } = await supabase
        .from('deal_recommendations')
        .insert([{
          restaurant_id: restaurantId,
          inventory_item_id: item.id,
          product_id: item.product_id,
          ...recommendation,
        }]);

      if (insertError) {
        console.error('Error creating recommendation:', insertError);
        continue;
      }

      recommendationsCreated++;
    }

    return recommendationsCreated;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Generate recommendations for a specific inventory item
 */
export async function generateRecommendationForItem(
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

    // Check if recommendation should be generated (pass product for slow-moving check)
    if (!shouldGenerateRecommendation(item, item.product)) {
      return false;
    }

    // Check if recommendation already exists for this inventory item
    const { data: existingRec } = await supabase
      .from('deal_recommendations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('inventory_item_id', item.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRec) {
      return false; // Already exists
    }

    // Generate recommendation for the PRODUCT itself (V1 approach)
    // Restaurant owner decides how to use the ingredient (grilled salmon, salmon risotto, etc.)
    const recommendation = generateDealRecommendation(item, item.product);

    if (!recommendation) {
      return false;
    }

    // Insert recommendation
    const { error: insertError } = await supabase
      .from('deal_recommendations')
      .insert([{
        restaurant_id: restaurantId,
        inventory_item_id: item.id,
        product_id: item.product_id,
        ...recommendation,
      }]);

    if (insertError) {
      throw insertError;
    }

    return true;
  } catch (error) {
    console.error('Error generating recommendation for item:', error);
    throw error;
  }
}
