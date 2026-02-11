# V1 Recommendation Approach

## Overview

For V1, the system recommends deals **directly on products** (ingredients), not on menu items. This keeps the system simple and allows restaurants to decide how to use expiring ingredients.

## How It Works

### Example: Fresh Salmon Expiring
1. **Restaurant adds inventory**: 10 lb fresh salmon, expires in 2 days
2. **System identifies**: Salmon is in "proteins" category, subcategory "fresh_raw", item_type "fish_seafood"
3. **System generates recommendation**: "Flash Sale: Fresh Salmon - 40% off"
4. **Restaurant owner decides**: How to use it (grilled salmon, salmon risotto, salmon pasta, etc.)
5. **Owner creates deal**: Uses the recommendation as a starting point, customizes the deal

## Recommendation Logic

### Two Types of Recommendations

#### 1. Expiration-Based (Priority)
- Triggers when items expire within 14 days
- More urgent = higher discount
- Example: Salmon expiring in 2 days → 40% discount

#### 2. Slow-Moving Inventory
- Triggers based on category/subcategory/item_type thresholds
- Uses "days since received" instead of expiration date
- Example: Fresh fish received 2+ days ago → Recommendation generated

### Category-Based Thresholds

The system uses granular thresholds from your industry data:

| Category | Subcategory | Item Type | Threshold |
|----------|-------------|-----------|-----------|
| Proteins | Fresh/Raw | Fish & Seafood | 2 days |
| Proteins | Fresh/Raw | Poultry | 3 days |
| Proteins | Fresh/Raw | Beef/Pork/Lamb | 4 days |
| Produce | Fresh | Vegetables | 5 days |
| Dairy | Dairy | Milk/Cream/Soft Cheese | 10 days |
| ... | ... | ... | ... |

## What Gets Recommended

### Product-Based Recommendations
- **Title**: "Flash Sale: [Product Name]" or "Clearance: [Product Name]"
- **Description**: Mentions expiration or slow-moving status
- **Discount**: Based on urgency (20-50%)
- **Category**: Shows product category (e.g., "Proteins • Fresh Raw")

### Example Recommendations

**Expiration-Based:**
- "Flash Sale: Fresh Salmon"
- "Limited time - Fresh Salmon expires in 2 days! Get 40% off."

**Slow-Moving:**
- "Special: Fresh Salmon"
- "Fresh fish & seafood items logged 2 days ago are moving slowly. Consider a special to move stock."

## What Restaurant Owners Do

1. **See recommendation**: "Flash Sale: Fresh Salmon - 40% off"
2. **Decide how to use it**: 
   - Grilled salmon dish?
   - Salmon risotto?
   - Salmon pasta?
   - Salmon burger?
3. **Create deal**: Use recommendation as starting point, customize title/description
4. **Deal goes live**: Customers see the deal

## Benefits of V1 Approach

1. **Simple**: No need to map ingredients to menu items
2. **Flexible**: Restaurant decides how to use ingredients
3. **Fast to implement**: No complex menu item relationships
4. **Proves the model**: Validates that recommendations drive sales
5. **Category-based**: Uses industry-standard thresholds

## Future Evolution (V2+)

Once V1 proves successful, we can add:
- Menu item mapping
- Automatic suggestions for how to use ingredients
- Multi-ingredient recommendations
- Recipe suggestions

## Database Schema

### Current (V1)
- `products` - Ingredients/products
- `inventory_items` - Stock with expiration dates
- `deal_recommendations` - Recommendations on products
- `menu_items` - Exists but not used for recommendations yet

### Recommendation Flow
```
Inventory Item (Salmon, expires in 2 days)
  ↓
Product (category: proteins, subcategory: fresh_raw, item_type: fish_seafood)
  ↓
Recommendation ("Flash Sale: Fresh Salmon - 40% off")
  ↓
Restaurant Owner Creates Deal
  ↓
Deal Goes Live
```

## Key Files

- `utils/generateRecommendations.ts` - Generates product-based recommendations
- `utils/recommendations.ts` - Recommendation logic with expiration + slow-moving
- `utils/recommendationThresholds.ts` - Category-based thresholds
- `app/admin/inventory/recommendations.tsx` - UI showing product recommendations

---

**V1 Philosophy**: Keep it simple. Recommend WHAT to discount (the ingredient), let restaurants decide HOW to use it (the dish).
