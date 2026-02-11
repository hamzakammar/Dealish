# Menu Items & Deal Recommendations

## Overview

The recommendation system has been updated to recommend deals on **menu items** (like burgers, pizzas, salads) instead of raw ingredients (like tomatoes, lettuce, beef). This makes more sense for restaurants - customers buy menu items, not raw ingredients.

## How It Works

1. **Restaurant adds inventory** (e.g., tomatoes expiring in 3 days)
2. **System finds menu items** that use that ingredient (e.g., "Classic Burger" uses tomatoes)
3. **System generates recommendation** for the menu item (e.g., "Flash Sale: Classic Burger - 40% off")
4. **Restaurant owner approves** and creates a deal on the burger

## Database Schema

### New Tables

#### `menu_items`
Stores menu items (dishes) for each restaurant:
- `id` - UUID primary key
- `restaurant_id` - Foreign key to restaurants
- `name` - Menu item name (e.g., "Classic Burger")
- `description` - Optional description
- `category` - Category (e.g., "burger", "pizza", "salad")
- `price` - Menu item price
- `image_url` - Optional image
- `is_available` - Whether item is currently available

#### `menu_item_ingredients`
Links menu items to products (ingredients):
- `id` - UUID primary key
- `menu_item_id` - Foreign key to menu_items
- `product_id` - Foreign key to products (ingredients)
- `quantity` - Amount of ingredient needed
- `unit` - Unit for quantity (e.g., "oz", "lb", "each")
- `is_required` - Whether ingredient is required (only required ingredients trigger recommendations)

### Updated Tables

#### `deal_recommendations`
Added `menu_item_id` column:
- Links recommendations to menu items instead of just products
- If `menu_item_id` is set, the recommendation is for a menu item
- If `menu_item_id` is null, recommendation is for a product (legacy support)

## Workflow

### 1. Create Menu Items

First, restaurants need to create menu items and link them to ingredients:

```sql
-- Create a burger menu item
INSERT INTO menu_items (restaurant_id, name, category, price)
VALUES ('restaurant-id', 'Classic Burger', 'burger', 12.99);

-- Link ingredients to the burger
INSERT INTO menu_item_ingredients (menu_item_id, product_id, quantity, unit, is_required)
VALUES 
  ('burger-id', 'beef-product-id', 0.25, 'lb', true),
  ('burger-id', 'tomato-product-id', 2, 'each', true),
  ('burger-id', 'lettuce-product-id', 1, 'oz', true),
  ('burger-id', 'cheese-product-id', 1, 'slice', false); -- Optional
```

### 2. Add Inventory

When inventory is added with an expiration date:

```typescript
// Add tomatoes expiring in 3 days
await addInventoryItem({
  product_id: 'tomato-product-id',
  quantity: 10,
  unit: 'lb',
  expiration_date: '2026-02-13', // 3 days from now
  ...
});
```

### 3. System Generates Recommendations

The system automatically:
1. Finds menu items that use the expiring ingredient (tomatoes)
2. Generates a recommendation for each menu item (e.g., "Classic Burger")
3. Creates a deal recommendation entry

### 4. Restaurant Owner Reviews

The owner sees recommendations like:
- **"Flash Sale: Classic Burger"**
- **"40% off - Made with fresh ingredients expiring in 3 days"**
- Shows which ingredient is expiring (tomatoes)

### 5. Create Deal

Owner clicks "Create Deal" → Deal form pre-fills with:
- Title: "Flash Sale: Classic Burger"
- Description: "Limited time deal! Our Classic Burger is 40% off..."
- Discount: 40%

## Migration Steps

1. **Run the menu items migration:**
   ```bash
   # In Supabase SQL Editor, run:
   database/migrations/add_menu_items.sql
   ```

2. **Create menu items for your restaurant:**
   - Use the admin UI (to be built) or SQL directly
   - Link menu items to products/ingredients

3. **Existing recommendations:**
   - Old recommendations (without menu_item_id) will still work
   - New recommendations will require menu items

## Example: Complete Flow

### Setup
1. Restaurant has products: "Beef Patties", "Tomatoes", "Lettuce", "Buns"
2. Restaurant creates menu item: "Classic Burger"
3. Links ingredients:
   - Beef Patties: 0.25 lb (required)
   - Tomatoes: 2 each (required)
   - Lettuce: 1 oz (required)
   - Buns: 1 each (required)

### Scenario: Tomatoes Expiring
1. Restaurant adds inventory: 10 lb tomatoes expiring in 2 days
2. System finds: "Classic Burger" uses tomatoes
3. System generates: "Flash Sale: Classic Burger - 40% off"
4. Owner approves and creates deal
5. Deal goes live: Customers get 40% off burgers

### Result
- Tomatoes get used in burgers (not wasted)
- Restaurant moves inventory
- Customers get a good deal
- Win-win-win!

## UI Updates Needed

### Menu Items Management Screen
- Create/edit menu items
- Link ingredients to menu items
- Set quantities and units
- Mark ingredients as required/optional

### Recommendations Screen (Updated)
- Shows menu item name instead of product name
- Shows which ingredient is expiring
- Example: "Classic Burger" (Menu Item) • Uses Tomatoes

## Benefits

1. **More Relevant**: Customers buy menu items, not raw ingredients
2. **Better Deals**: Deals on burgers are more appealing than deals on tomatoes
3. **Inventory Management**: Helps restaurants use expiring ingredients in dishes
4. **Flexibility**: Can still recommend deals on products if no menu items exist (legacy)

## Future Enhancements

1. **Multiple Ingredients**: If multiple ingredients are expiring, prioritize menu items that use multiple expiring ingredients
2. **Ingredient Substitution**: Suggest menu items where expiring ingredients can be substituted
3. **Menu Item Availability**: Only recommend deals on available menu items
4. **Bundles**: Create bundle deals when multiple menu items use expiring ingredients

---

**Note**: The old recommendation system (recommending deals on products directly) is still supported for backward compatibility, but new recommendations will prioritize menu items.
