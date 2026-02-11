# Inventory Management System - Testing Guide

## Prerequisites

1. **Database Migration**: Run the migration file first
2. **App Running**: Have your Expo app running (`npm start` or `expo start`)
3. **Admin Access**: Log in as a restaurant owner/admin

---

## Step 1: Run Database Migration

### Option A: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `database/migrations/add_inventory_system.sql`
4. Copy and paste the entire SQL into the editor
5. Click **Run** to execute

### Option B: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
# Or manually:
psql -h your-db-host -U postgres -d your-db-name -f database/migrations/add_inventory_system.sql
```

### Verify Migration
Run this query in Supabase SQL Editor to verify tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'inventory_items', 'deal_recommendations', 'inventory_sync_logs', 'external_system_credentials');
```

You should see all 5 tables listed.

---

## Step 2: Test Product Creation

### Test Case 2.1: Create Product via Form
1. Navigate to Admin Dashboard
2. Select a restaurant
3. Go to **Inventory** → Click **Scan Barcode** → Click **Enter Manually**
4. You'll be prompted to create a product first
5. Fill in:
   - **Product Name**: "Organic Tomatoes"
   - **Barcode**: "1234567890123" (or leave empty)
   - **Category**: "produce"
   - **Unit**: "lb"
   - **Base Unit**: "oz" (optional)
   - **Supplier**: "Local Farm" (optional)
6. Click **Create Product**
7. ✅ **Expected**: Product created successfully, redirected to inventory form

### Test Case 2.2: Create Product with Barcode
1. Go to **Inventory** → **Scan Barcode**
2. Scan a barcode (or enter manually: "9876543210987")
3. If product doesn't exist, you'll see "Product Not Found" alert
4. Click **Create Product**
5. Fill in product details
6. ✅ **Expected**: Product created with barcode linked

---

## Step 3: Test Inventory Item Creation

### Test Case 3.1: Add Inventory Item (Expiring Soon)
1. After creating a product, you should be on the inventory item form
2. Fill in:
   - **Product**: Select the product you just created
   - **Quantity**: "10"
   - **Unit**: "lb" (should auto-fill from product)
   - **Unit Cost**: "2.50"
   - **Expiration Date**: Enter a date 3 days from now (format: YYYY-MM-DD)
   - **Storage Location**: "refrigerator"
   - **Purchase Date**: Today's date (optional)
3. Click **Add Item**
4. ✅ **Expected**: 
   - Item added successfully
   - Redirected to inventory list
   - Item appears in list
   - **Deal recommendation should be automatically generated** (check recommendations screen)

### Test Case 3.2: Add Inventory Item (Expiring Today)
1. Create another inventory item with expiration date = today
2. ✅ **Expected**: 
   - Item added
   - Recommendation generated with 50% discount suggestion
   - High urgency score (80-100)

### Test Case 3.3: Add Inventory Item (No Expiration)
1. Add inventory item without expiration date
2. ✅ **Expected**: 
   - Item added successfully
   - **No recommendation generated** (only items expiring within 14 days get recommendations)

---

## Step 4: Test Inventory List View

### Test Case 4.1: View Inventory Dashboard
1. Navigate to **Inventory**
2. ✅ **Expected**: 
   - Stats cards show:
     - Total Items
     - Expiring Today
     - Expiring This Week
     - Total Value
   - Inventory list displays all items
   - Items sorted by expiration date (soonest first)

### Test Case 4.2: Test Filters
1. Click **Expiring** filter
   - ✅ Should show only items expiring within 7 days
2. Click **Expired** filter
   - ✅ Should show only expired items (red color)
3. Click **All** filter
   - ✅ Should show all items

### Test Case 4.3: Edit Inventory Item
1. Click on an inventory item
2. Modify quantity or expiration date
3. Click **Update Item**
4. ✅ **Expected**: 
   - Item updated
   - If expiration date changed, recommendation may be regenerated

### Test Case 4.4: Delete Inventory Item
1. Click on an inventory item
2. Click delete button (trash icon)
3. Confirm deletion
4. ✅ **Expected**: Item removed from list

---

## Step 5: Test Barcode Scanner

### Test Case 5.1: Scan Existing Product
1. Go to **Inventory** → **Scan Barcode**
2. If you have a physical barcode scanner or can simulate:
   - Use Expo Go camera to scan a barcode
   - Or manually enter a barcode that exists in your database
3. ✅ **Expected**: 
   - Product found
   - Redirected to inventory item form with product pre-selected

### Test Case 5.2: Scan New Product
1. Scan a barcode that doesn't exist
2. ✅ **Expected**: 
   - "Product Not Found" alert
   - Option to create product
   - After creating, redirected to inventory form

---

## Step 6: Test Deal Recommendations

### Test Case 6.1: View Recommendations
1. Navigate to **Deal Recommendations** from admin dashboard
2. ✅ **Expected**: 
   - List of pending recommendations
   - Each recommendation shows:
     - Product name
     - Urgency badge (color-coded)
     - Suggested discount percentage
     - Days until expiration
     - Suggested title and description

### Test Case 6.2: Create Deal from Recommendation
1. Click **Create Deal** on a recommendation
2. ✅ **Expected**: 
   - Navigates to deal form
   - Deal form pre-filled with:
     - Title from recommendation
     - Description from recommendation
     - Tags might include product category
3. Review and save deal
4. ✅ **Expected**: 
   - Deal created
   - Recommendation status updated to "created"
   - Recommendation disappears from pending list (or shows as created)

### Test Case 6.3: Dismiss Recommendation
1. Click **Dismiss** on a recommendation
2. Confirm dismissal
3. ✅ **Expected**: 
   - Recommendation removed from pending list
   - Status set to "dismissed"

---

## Step 7: Test Unit Conversions

### Test Case 7.1: Test Weight Conversions
1. Create a product with unit "lb"
2. Add inventory item with quantity "2" and unit "lb"
3. Try to convert to "oz"
4. ✅ **Expected**: 
   - System should handle conversions (2 lb = 32 oz)
   - Display shows correct converted values

### Test Case 7.2: Test Volume Conversions
1. Create a product with unit "gallon"
2. Add inventory item
3. ✅ **Expected**: System recognizes volume units and can convert

---

## Step 8: Test Recommendation Algorithm

### Test Case 8.1: Urgency Scoring
Create inventory items with different expiration dates and verify urgency scores:

| Days Until Expiration | Expected Discount | Expected Urgency Score |
|----------------------|-------------------|----------------------|
| 0 (today)            | 50%               | 80-100               |
| 1 (tomorrow)         | 45%               | 75-95                |
| 2-3 days             | 40%               | 60-85                |
| 4-7 days             | 30%               | 40-70                |
| 8-14 days            | 20%               | 20-50                |
| >14 days             | No recommendation | N/A                  |

### Test Case 8.2: Perishable Categories
1. Create products in perishable categories (produce, dairy, meat, seafood)
2. Add inventory items with same expiration dates
3. ✅ **Expected**: Perishable items get higher urgency scores (+10 points)

---

## Step 9: End-to-End Workflow Test

### Complete Flow:
1. **Create Product**
   - Scan barcode or create manually
   - ✅ Product created

2. **Add Inventory**
   - Add item with expiration date 5 days away
   - ✅ Item added, recommendation auto-generated

3. **View Recommendations**
   - Go to Deal Recommendations
   - ✅ See recommendation with 30% discount, medium-high urgency

4. **Create Deal**
   - Click "Create Deal"
   - Review pre-filled form
   - Save deal
   - ✅ Deal created, recommendation marked as "created"

5. **Verify in Deals**
   - Go to Manage Deals
   - ✅ New deal appears in list

---

## Common Issues & Troubleshooting

### Issue: "Table doesn't exist" error
**Solution**: Make sure you ran the database migration

### Issue: Recommendations not generating
**Check**:
- Item has expiration date set
- Expiration date is within 14 days
- Item status is "active"
- No existing pending recommendation for this item

### Issue: Barcode scanner not working
**Check**:
- Camera permissions granted
- Using physical device (not simulator)
- Barcode format is supported (UPC/EAN)

### Issue: Unit conversions not working
**Check**:
- Units are compatible (weight with weight, volume with volume)
- Base unit is set correctly on product

---

## Quick Test Data

Use this test data to quickly set up a test scenario:

```sql
-- Create a test product (replace restaurant_id with your actual ID)
INSERT INTO products (restaurant_id, name, barcode, category, unit, base_unit)
VALUES (
  'your-restaurant-id',
  'Organic Lettuce',
  '1234567890123',
  'produce',
  'lb',
  'oz'
);

-- Create inventory item expiring in 3 days
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
  'your-restaurant-id',
  (SELECT id FROM products WHERE barcode = '1234567890123'),
  5,
  'lb',
  3.50,
  CURRENT_DATE + INTERVAL '3 days',
  'refrigerator',
  'active'
);
```

After inserting, check if recommendation was generated:
```sql
SELECT * FROM deal_recommendations 
WHERE restaurant_id = 'your-restaurant-id' 
AND status = 'pending';
```

---

## Testing Checklist

- [ ] Database migration executed successfully
- [ ] Can create products
- [ ] Can scan/enter barcodes
- [ ] Can add inventory items
- [ ] Inventory list displays correctly
- [ ] Filters work (all, expiring, expired)
- [ ] Can edit inventory items
- [ ] Can delete inventory items
- [ ] Recommendations auto-generate for expiring items
- [ ] Recommendations show correct urgency scores
- [ ] Can create deals from recommendations
- [ ] Can dismiss recommendations
- [ ] Unit conversions work
- [ ] Stats dashboard shows correct numbers
- [ ] Expiration date colors are correct (red/orange/green)

---

## Next Steps After Testing

Once testing is complete:
1. Fix any bugs found
2. Add external system integrations (Phase 2)
3. Set up scheduled jobs for bulk recommendation generation
4. Add push notifications for expiring items
5. Implement analytics dashboard

---

**Happy Testing! 🧪**

If you encounter any issues, check the browser console (for web) or React Native debugger for error messages.
