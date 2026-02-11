# Recommendation Timing System

## Overview

The recommendation system now uses **granular thresholds** based on category, subcategory, and item type to determine when to generate deal recommendations. This is based on industry standards for inventory turnover and helps restaurants identify slow-moving inventory before it expires.

## Two Types of Recommendations

### 1. Expiration-Based Recommendations
- Triggered when items are **close to expiring** (within 14 days)
- More urgent, higher discounts
- Example: Tomatoes expiring in 2 days → Recommend burger deal

### 2. Slow-Moving Inventory Recommendations
- Triggered when items have been **sitting too long** based on category/subcategory/item_type
- Uses "days since received" instead of expiration date
- Example: Fresh fish received 2+ days ago → Recommend seafood menu item deal

## Recommendation Thresholds

The system uses thresholds from your industry data:

| Category | Subcategory | Item Type | Notify After (Days) |
|----------|-------------|-----------|---------------------|
| Proteins | Fresh/Raw | Fish & Seafood | 2 |
| Proteins | Fresh/Raw | Poultry | 3 |
| Proteins | Fresh/Raw | Beef/Pork/Lamb | 4 |
| Proteins | Prepared | Marinated/Cooked | 2 |
| Proteins | Frozen | Fish & Seafood | 30 |
| Proteins | Frozen | Poultry | 45 |
| Proteins | Frozen | Beef/Pork/Lamb | 60 |
| Produce | Fresh | Leafy Greens & Herbs | 3 |
| Produce | Fresh | Vegetables | 5 |
| Produce | Fresh | Fruit | 5 |
| Dairy & Eggs | Dairy | Milk/Cream/Soft Cheese | 10 |
| Dairy & Eggs | Dairy | Hard Cheese/Butter | 14 |
| Dairy & Eggs | Eggs | Eggs | 14 |
| Fresh Prepared | Fresh/Refrigerated | Pastries & Baked Goods | 2 |
| Fresh Prepared | Fresh/Refrigerated | Breads | 2 |
| Fresh Prepared | Fresh/Refrigerated | Prepared Desserts | 3 |
| Pantry | Dry Goods | Pasta/Rice/Flour | 30 |
| Pantry | Prepared | House-made Sauces | 7 |
| Pantry | Canned | Canned Foods | 60 |
| Alcohol | Spirits | Spirits | 30 |
| Alcohol | Wine | Wine | 60 |
| Alcohol | Sparkling | Sparkling | 45 |
| Alcohol | Beer | Beer Kegs | 14 |
| Alcohol | Beer | Beer Cans/Bottles | 30 |
| Non-Alcoholic | Sodas | Canned Sodas | 45 |
| Non-Alcoholic | Juices | Fresh-Squeezed | 2 |
| Non-Alcoholic | Juices | Commercial | 30 |

## How It Works

### Example 1: Fresh Fish (Expiration-Based)
1. Restaurant adds: 10 lb fresh salmon, expires in 2 days
2. System checks:
   - Expiration: 2 days → **YES** (within 14 days)
   - Slow-moving: Received today → **NO** (threshold is 2 days)
3. **Recommendation generated**: "Flash Sale: Grilled Salmon - 40% off"

### Example 2: Fresh Fish (Slow-Moving)
1. Restaurant added: 10 lb fresh salmon, 3 days ago, no expiration date
2. System checks:
   - Expiration: None → **NO**
   - Slow-moving: 3 days since received → **YES** (threshold is 2 days)
3. **Recommendation generated**: "Special: Grilled Salmon - 20% off. Fresh fish items logged 2 days ago are moving slowly."

### Example 3: Frozen Poultry (Slow-Moving)
1. Restaurant added: 50 lb frozen chicken, 45 days ago
2. System checks:
   - Expiration: None → **NO**
   - Slow-moving: 45 days since received → **YES** (threshold is 45 days)
3. **Recommendation generated**: "Special: Chicken Wings - 20% off. Frozen poultry items logged 45 days ago are moving slowly."

## Product Setup

To use the granular thresholds, products need:

1. **Category** (required for basic recommendations)
   - e.g., `proteins`, `produce`, `dairy`, `alcohol`

2. **Subcategory** (optional, for more granular thresholds)
   - e.g., `fresh_raw`, `frozen`, `prepared`, `canned`, `dry`

3. **Item Type** (optional, for most specific thresholds)
   - e.g., `fish_seafood`, `poultry`, `beef_pork_lamb`, `leafy_greens_herbs`

### Example Product Setup

```sql
-- Fresh salmon product
INSERT INTO products (
  restaurant_id,
  name,
  category,
  subcategory,
  item_type,
  unit
) VALUES (
  'restaurant-id',
  'Fresh Salmon',
  'proteins',
  'fresh_raw',
  'fish_seafood',
  'lb'
);
```

This product will trigger recommendations:
- **After 2 days** if no expiration date (slow-moving threshold)
- **Within 14 days** if expiration date is set (expiration-based)

## Discount Levels

### Expiration-Based Discounts
- **0 days** (expiring today): 50% off
- **1 day** (expiring tomorrow): 45% off
- **2-3 days**: 40% off
- **4-7 days**: 30% off
- **8-14 days**: 20% off

### Slow-Moving Discounts
- **Just hit threshold**: 20% off
- **1.5x threshold**: 30% off
- **2x threshold**: 40% off

## Migration Steps

1. **Run the subcategory migration:**
   ```sql
   -- Run: database/migrations/add_product_subcategories.sql
   ```

2. **Update existing products** (optional):
   ```sql
   -- Add subcategory and item_type to existing products
   UPDATE products 
   SET subcategory = 'fresh_raw', item_type = 'fish_seafood'
   WHERE category = 'seafood' AND name ILIKE '%salmon%';
   ```

3. **Update product forms** to include subcategory and item_type fields

## Benefits

1. **More Accurate**: Uses industry-specific thresholds instead of generic categories
2. **Proactive**: Catches slow-moving inventory before it expires
3. **Flexible**: Works with or without expiration dates
4. **Granular**: Different thresholds for different product types
5. **Industry-Standard**: Based on real restaurant inventory turnover data

## Future Enhancements

1. **Custom Thresholds**: Allow restaurants to set custom thresholds per product
2. **Seasonal Adjustments**: Adjust thresholds based on season (e.g., seafood in summer)
3. **Usage Tracking**: Track actual usage vs. received to refine thresholds
4. **Multi-Ingredient Priority**: Prioritize menu items that use multiple slow-moving ingredients

---

**Note**: The system supports both expiration-based and slow-moving recommendations. If an item meets BOTH criteria, expiration-based takes priority (more urgent).
