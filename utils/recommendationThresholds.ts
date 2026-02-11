/**
 * Recommendation thresholds based on category, subcategory, and item type
 * These thresholds indicate when to generate recommendations for slow-moving inventory
 * Based on industry standards for inventory turnover
 */

export interface RecommendationThreshold {
  daysSinceReceived: number; // Days since item was received/logged
  suggestedMessage: string;
}

// Mapping of category + subcategory + item type to recommendation threshold
export const RECOMMENDATION_THRESHOLDS: Record<string, RecommendationThreshold> = {
  // Proteins - Fresh/Raw
  'proteins_fresh_raw_fish_seafood': {
    daysSinceReceived: 2,
    suggestedMessage: 'Fresh fish & seafood items logged 2 days ago are moving slowly. Consider a special to move stock.',
  },
  'proteins_fresh_raw_poultry': {
    daysSinceReceived: 3,
    suggestedMessage: 'Fresh poultry items logged 3 days ago are moving slowly. Consider a special to move stock.',
  },
  'proteins_fresh_raw_beef_pork_lamb': {
    daysSinceReceived: 4,
    suggestedMessage: 'Fresh beef / pork items logged 4 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Proteins - Prepared
  'proteins_prepared_marinated_cooked_proteins': {
    daysSinceReceived: 2,
    suggestedMessage: 'Marinated / cooked protein items logged 2 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Proteins - Frozen
  'proteins_frozen_frozen_fish_seafood': {
    daysSinceReceived: 30,
    suggestedMessage: 'Frozen fish & seafood items logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  'proteins_frozen_frozen_poultry': {
    daysSinceReceived: 45,
    suggestedMessage: 'Frozen poultry items logged 45 days ago are moving slowly. Consider a special to move stock.',
  },
  'proteins_frozen_frozen_beef_pork_lamb': {
    daysSinceReceived: 60,
    suggestedMessage: 'Frozen beef / pork items logged 60 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Prepared Proteins - Frozen
  'prepared_proteins_frozen_frozen_prepared_proteins': {
    daysSinceReceived: 30,
    suggestedMessage: 'Frozen prepared protein items logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Prepared Non-Protein - Frozen
  'prepared_non_protein_frozen_frozen_apps_sides': {
    daysSinceReceived: 21,
    suggestedMessage: 'Frozen prepared side items logged 21 days ago are moving slowly. Consider a special to move stock.',
  },
  'prepared_non_protein_frozen_frozen_desserts': {
    daysSinceReceived: 30,
    suggestedMessage: 'Frozen desserts items logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Produce - Fresh
  'produce_fresh_leafy_greens_herbs': {
    daysSinceReceived: 3,
    suggestedMessage: 'Leafy greens/ herb items logged 3 days ago are moving slowly. Consider a special to move stock.',
  },
  'produce_fresh_vegetables': {
    daysSinceReceived: 5,
    suggestedMessage: 'Fresh vegetable items logged 5 days ago are moving slowly. Consider a special to move stock.',
  },
  'produce_fresh_fruit': {
    daysSinceReceived: 5,
    suggestedMessage: 'Fresh fruit items logged 5 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Dairy & Eggs
  'dairy_dairy_milk_cream_soft_cheese': {
    daysSinceReceived: 10,
    suggestedMessage: 'Dairy items logged 10 days ago are moving slowly. Consider a special to move stock.',
  },
  'dairy_dairy_hard_cheese_butter': {
    daysSinceReceived: 14,
    suggestedMessage: 'Dairy items logged 14 days ago are moving slowly. Consider a special to move stock.',
  },
  'dairy_eggs_eggs': {
    daysSinceReceived: 14,
    suggestedMessage: 'Eggs logged 14 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Fresh Prepared Food
  'fresh_prepared_food_fresh_refrigerated_pastries_baked_goods': {
    daysSinceReceived: 2,
    suggestedMessage: 'Pastries & Baked Good items logged 2 days ago are moving slowly. Consider a special to move stock.',
  },
  'fresh_prepared_food_fresh_refrigerated_breads': {
    daysSinceReceived: 2,
    suggestedMessage: 'Bread items logged 2 days ago are moving slowly. Consider a special to move stock.',
  },
  'fresh_prepared_food_fresh_refrigerated_prepared_desserts': {
    daysSinceReceived: 3,
    suggestedMessage: 'Prepared Dessert items logged 3 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Pantry
  'pantry_dry_goods_pasta_rice_flour': {
    daysSinceReceived: 30,
    suggestedMessage: 'Dry Good items logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  'pantry_prepared_house_made_sauces_dressings': {
    daysSinceReceived: 7,
    suggestedMessage: 'House-made Sauces & Dressing items logged 7 days ago are moving slowly. Consider a special to move stock.',
  },
  'pantry_canned_canned_foods': {
    daysSinceReceived: 60,
    suggestedMessage: 'Canned Food items logged 60 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Alcohol
  'alcohol_spirits_spirits': {
    daysSinceReceived: 30,
    suggestedMessage: 'Spirit Bottles logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  'alcohol_wine_wine': {
    daysSinceReceived: 60,
    suggestedMessage: 'Wine logged 60 days ago is moving slowly. Consider a special to move stock.',
  },
  'alcohol_sparkling_sparkling': {
    daysSinceReceived: 45,
    suggestedMessage: 'Sparkling Wine logged 45 days ago is moving slowly. Consider a special to move stock.',
  },
  'alcohol_beer_beer_kegs': {
    daysSinceReceived: 14,
    suggestedMessage: 'Beer (Kegs) logged 14 days ago are moving slowly. Consider a special to move stock.',
  },
  'alcohol_beer_beer_cans_bottles': {
    daysSinceReceived: 30,
    suggestedMessage: 'Beer (Cans/Bottles) logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  'alcohol_pre_mixed_canned_cocktails_seltzers': {
    daysSinceReceived: 30,
    suggestedMessage: 'Canned Cocktails / Seltzers logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  
  // Non-Alcoholic
  'non_alcoholic_sodas_canned_sodas': {
    daysSinceReceived: 45,
    suggestedMessage: 'Canned Sodas logged 45 days ago are moving slowly. Consider a special to move stock.',
  },
  'non_alcoholic_juices_fresh_squeezed_juices': {
    daysSinceReceived: 2,
    suggestedMessage: 'Fresh-Squeezed Juices logged 2 days ago are moving slowly. Consider a special to move stock.',
  },
  'non_alcoholic_juices_commercial_juices': {
    daysSinceReceived: 30,
    suggestedMessage: 'Commercial Juices logged 30 days ago are moving slowly. Consider a special to move stock.',
  },
  'non_alcoholic_mixers_syrups_mixers': {
    daysSinceReceived: 14,
    suggestedMessage: 'Syrups & Mixers logged 14 days ago are moving slowly. Consider a special to move stock.',
  },
};

/**
 * Get recommendation threshold for a product based on category, subcategory, and item type
 * Falls back to expiration-based logic if no specific threshold found
 */
export function getRecommendationThreshold(
  category?: string | null,
  subcategory?: string | null,
  itemType?: string | null
): RecommendationThreshold | null {
  // Build key from category_subcategory_item_type
  const key = [category, subcategory, itemType]
    .filter(Boolean)
    .map(s => s?.toLowerCase().replace(/\s+/g, '_'))
    .join('_');

  return RECOMMENDATION_THRESHOLDS[key] || null;
}

/**
 * Calculate days since item was received
 */
export function calculateDaysSinceReceived(receivedDate: string | null | undefined): number | null {
  if (!receivedDate) return null;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const received = new Date(receivedDate);
    if (isNaN(received.getTime())) {
      return null;
    }
    received.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - received.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    console.error('Error calculating days since received:', error);
    return null;
  }
}

/**
 * Check if item should generate recommendation based on slow-moving inventory
 * Uses days since received (not expiration date)
 */
export function shouldRecommendForSlowMoving(
  daysSinceReceived: number | null,
  threshold: RecommendationThreshold | null
): boolean {
  if (daysSinceReceived === null || !threshold) {
    return false;
  }

  return daysSinceReceived >= threshold.daysSinceReceived;
}
