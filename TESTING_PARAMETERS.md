# Testing Parameters Reference Guide

This guide lists all valid parameters and test data you can use when testing the inventory management system.

---

## 📦 Product Categories

Use these categories when creating products. Each category has **auto-suggested expiration dates**:

| Category | Auto-Suggested Expiration | Default Location | Use Case |
|----------|--------------------------|------------------|----------|
| `produce` | +5 days | `refrigerator` | Fresh vegetables, fruits |
| `dairy` | +7 days | `refrigerator` | Milk, cheese, yogurt |
| `meat` | +3 days | `refrigerator` | Beef, chicken, pork |
| `seafood` | +2 days | `refrigerator` | Fish, shrimp, crab |
| `beverages` | +30 days | `pantry` | Drinks, juices |
| `dry_goods` | +90 days | `dry_storage` | Rice, pasta, canned goods |
| `frozen` | +180 days | `freezer` | Frozen items |
| `bakery` | +3 days | `counter` | Bread, pastries |
| `deli` | +5 days | `refrigerator` | Deli meats, prepared foods |
| `condiments` | +60 days | `pantry` | Sauces, dressings |
| `spices` | +365 days | `dry_storage` | Spices, seasonings |
| `other` | +7 days | `pantry` | Default fallback |

---

## 📍 Storage Locations

Valid storage location values:

- `freezer` - Freezer storage
- `refrigerator` - Refrigerator storage
- `pantry` - Pantry storage
- `dry_storage` - Dry storage area
- `counter` - Counter/room temperature
- `walk_in` - Walk-in cooler/freezer
- `other` - Other location

---

## 📏 Units

### Weight Units
- `g` (grams)
- `kg` (kilograms)
- `oz` (ounces)
- `lb` or `lbs` (pounds)

### Volume Units
- `ml` (milliliters)
- `l` or `liter` (liters)
- `fl oz` (fluid ounces)
- `cup`
- `pint`
- `quart`
- `gallon`

### Count Units
- `each` (default)
- `piece`
- `box`
- `case`
- `pack`
- `bunch`
- `head` (for lettuce, etc.)

**Note**: Units are automatically converted if compatible (weight ↔ weight, volume ↔ volume).

---

## 🏷️ Inventory Item Status

Valid status values:

- `active` - Active inventory (default)
- `expired` - Past expiration date
- `sold` - Item has been sold/used
- `wasted` - Item was wasted/spoiled
- `low_stock` - Low stock warning

---

## 📅 Expiration Date Scenarios for Testing

Use these expiration dates to test different recommendation urgency levels:

| Days Until Expiration | Expected Behavior | Discount Suggestion |
|----------------------|-------------------|---------------------|
| **0 days** (today) | 🔴 High urgency | ~50% discount |
| **1 day** (tomorrow) | 🔴 High urgency | ~45% discount |
| **2-3 days** | 🟠 Medium-high urgency | ~40% discount |
| **4-7 days** | 🟡 Medium urgency | ~30% discount |
| **8-14 days** | 🟢 Low-medium urgency | ~20% discount |
| **>14 days** | ⚪ No recommendation | N/A |

**Quick Date Buttons Available:**
- **Today** - Sets expiration to today
- **Tomorrow** - Sets expiration to tomorrow
- **+3 Days** - Sets expiration to 3 days from now
- **+7 Days** - Sets expiration to 7 days from now

---

## 🧪 Sample Test Products

### Quick Test Products (via UI)

1. **Organic Lettuce** (Produce)
   - Category: `produce`
   - Unit: `lb`
   - Base Unit: `oz`
   - Barcode: `1234567890123`
   - Auto-expiration: +5 days
   - Auto-location: `refrigerator`

2. **Whole Milk** (Dairy)
   - Category: `dairy`
   - Unit: `gallon`
   - Barcode: `9876543210987`
   - Auto-expiration: +7 days
   - Auto-location: `refrigerator`

3. **Ground Beef** (Meat)
   - Category: `meat`
   - Unit: `lb`
   - Barcode: `5555555555555`
   - Auto-expiration: +3 days
   - Auto-location: `refrigerator`

4. **Fresh Salmon** (Seafood)
   - Category: `seafood`
   - Unit: `lb`
   - Barcode: `1111111111111`
   - Auto-expiration: +2 days
   - Auto-location: `refrigerator`

5. **Frozen Vegetables** (Frozen)
   - Category: `frozen`
   - Unit: `lb`
   - Barcode: `2222222222222`
   - Auto-expiration: +180 days
   - Auto-location: `freezer`

---

## 📝 Sample Inventory Items

### Test Case 1: Expiring Today (High Urgency)
```
Product: Organic Lettuce
Quantity: 10
Unit: lb
Unit Cost: $3.50
Expiration Date: TODAY
Location: refrigerator
Status: active
```
**Expected**: Deal recommendation with ~50% discount, high urgency score (80-100)

### Test Case 2: Expiring in 3 Days (Medium-High Urgency)
```
Product: Whole Milk
Quantity: 5
Unit: gallon
Unit Cost: $4.00
Expiration Date: +3 days from today
Location: refrigerator
Status: active
```
**Expected**: Deal recommendation with ~40% discount, medium-high urgency score (60-85)

### Test Case 3: Expiring in 7 Days (Medium Urgency)
```
Product: Ground Beef
Quantity: 20
Unit: lb
Unit Cost: $5.50
Expiration Date: +7 days from today
Location: refrigerator
Status: active
```
**Expected**: Deal recommendation with ~30% discount, medium urgency score (40-70)

### Test Case 4: No Expiration Date
```
Product: Frozen Vegetables
Quantity: 15
Unit: lb
Unit Cost: $2.00
Expiration Date: (leave empty)
Location: freezer
Status: active
```
**Expected**: No deal recommendation (expiration date required)

### Test Case 5: Expiring in 20 Days (No Recommendation)
```
Product: Dry Goods (Rice)
Quantity: 50
Unit: lb
Unit Cost: $1.50
Expiration Date: +20 days from today
Location: dry_storage
Status: active
```
**Expected**: No deal recommendation (>14 days threshold)

---

## 🔗 Navigation Parameters

### Product Form (`/admin/inventory/product-form`)
```
restaurantId: string (required)
productId?: string (optional, for editing)
barcode?: string (optional, pre-fill barcode)
mode?: 'create' | 'edit' (optional)
```

### Inventory Item Form (`/admin/inventory/item-form`)
```
restaurantId: string (required)
itemId?: string (optional, for editing)
productId?: string (optional, pre-select product)
barcode?: string (optional, auto-load product by barcode)
```

### Scanner (`/admin/inventory/scanner`)
```
restaurantId: string (required)
```

### Recommendations (`/admin/inventory/recommendations`)
```
restaurantId: string (required)
```

### Deal Form (from recommendation)
```
restaurantId: string (required)
recommendationId?: string (optional)
suggestedTitle?: string (optional, pre-fill)
suggestedDescription?: string (optional, pre-fill)
suggestedDiscount?: string (optional, pre-fill)
```

---

## 🗄️ SQL Test Data

### Create Test Product
```sql
INSERT INTO products (restaurant_id, name, barcode, category, unit, base_unit, supplier)
VALUES (
  'your-restaurant-id-here',
  'Organic Lettuce',
  '1234567890123',
  'produce',
  'lb',
  'oz',
  'Local Farm'
);
```

### Create Test Inventory Item (Expiring in 3 Days)
```sql
INSERT INTO inventory_items (
  restaurant_id,
  product_id,
  quantity,
  unit,
  unit_cost,
  expiration_date,
  location,
  status
)
VALUES (
  'your-restaurant-id-here',
  (SELECT id FROM products WHERE barcode = '1234567890123' LIMIT 1),
  5,
  'lb',
  3.50,
  CURRENT_DATE + INTERVAL '3 days',
  'refrigerator',
  'active'
);
```

### Create Test Inventory Item (Expiring Today)
```sql
INSERT INTO inventory_items (
  restaurant_id,
  product_id,
  quantity,
  unit,
  unit_cost,
  expiration_date,
  location,
  status
)
VALUES (
  'your-restaurant-id-here',
  (SELECT id FROM products WHERE name = 'Organic Lettuce' LIMIT 1),
  10,
  'lb',
  3.50,
  CURRENT_DATE,  -- Expires today!
  'refrigerator',
  'active'
);
```

### Check Generated Recommendations
```sql
SELECT 
  dr.*,
  p.name as product_name,
  p.category,
  dr.days_until_expiration,
  dr.urgency_score,
  dr.suggested_discount_percent
FROM deal_recommendations dr
JOIN products p ON dr.product_id = p.id
WHERE dr.restaurant_id = 'your-restaurant-id-here'
  AND dr.status = 'pending'
ORDER BY dr.urgency_score DESC;
```

---

## ✅ Testing Checklist

Use these parameters to test each feature:

### Product Creation
- [ ] Create product with each category
- [ ] Verify auto-suggested expiration dates match category defaults
- [ ] Verify auto-suggested locations match category defaults
- [ ] Create product with barcode
- [ ] Create product without barcode
- [ ] Edit existing product

### Inventory Item Creation
- [ ] Add item with expiration date (today) → Should generate recommendation
- [ ] Add item with expiration date (+3 days) → Should generate recommendation
- [ ] Add item with expiration date (+7 days) → Should generate recommendation
- [ ] Add item with expiration date (+20 days) → Should NOT generate recommendation
- [ ] Add item without expiration date → Should NOT generate recommendation
- [ ] Verify auto-filled unit from product
- [ ] Verify auto-filled expiration date from category
- [ ] Verify auto-filled location from category
- [ ] Test quick date buttons (Today, Tomorrow, +3, +7)
- [ ] Test unit conversions

### Recommendations
- [ ] View pending recommendations
- [ ] Verify urgency scores match expiration dates
- [ ] Verify discount suggestions match urgency
- [ ] Create deal from recommendation → Should update recommendation status
- [ ] Dismiss recommendation → Should update status to 'dismissed'

### Filters & Stats
- [ ] Filter by "All" → Shows all items
- [ ] Filter by "Expiring" → Shows items expiring within 7 days
- [ ] Filter by "Expired" → Shows expired items
- [ ] Verify stats dashboard shows correct counts
- [ ] Verify total value calculation

---

## 🎯 Quick Test Scenarios

### Scenario 1: Complete Flow
1. Create product: "Fresh Tomatoes" (category: `produce`)
2. Add inventory: 20 lb, expires in 2 days
3. Check recommendations → Should see recommendation
4. Create deal from recommendation
5. Verify recommendation status = `created`

### Scenario 2: Multiple Products
1. Create 3 products (different categories)
2. Add inventory items with different expiration dates
3. Check recommendations → Should see multiple recommendations
4. Verify urgency scores are correct

### Scenario 3: No Recommendations
1. Add inventory item with expiration >14 days away
2. Check recommendations → Should be empty
3. Add item without expiration date
4. Check recommendations → Should still be empty

---

## 🐛 Common Issues & Solutions

### Issue: Products not loading in picker
**Check:**
- `restaurantId` is passed correctly
- Products exist in database for that restaurant
- RLS policies allow access

### Issue: Recommendations not generating
**Check:**
- Expiration date is set and within 14 days
- Item status is `active`
- No existing pending recommendation for same item

### Issue: Auto-suggestions not working
**Check:**
- Product has a category set
- Product category matches one in `PRODUCT_CATEGORIES`
- Date format is YYYY-MM-DD

---

**Happy Testing! 🧪**
