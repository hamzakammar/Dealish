# Expiration Dates & Barcodes - How It Works

## ⚠️ Important Clarification

**Barcodes DO NOT contain expiration dates.** Here's how it actually works:

### What Barcodes Provide
- **Product Identification**: Barcode identifies WHAT the product is
  - Example: `1234567890123` = "Organic Tomatoes"
  - Example: `9876543210987` = "Whole Milk"

### What Barcodes DON'T Provide
- ❌ Expiration dates
- ❌ Batch numbers
- ❌ Purchase dates
- ❌ Quantity received
- ❌ Storage location

## 🔄 Current Workflow

### Step-by-Step Process:

1. **Scan Barcode** → Identifies the PRODUCT
   ```
   Barcode: 1234567890123
   → Product: "Organic Tomatoes"
   ```

2. **User Enters Inventory Details** → Creates an INVENTORY ITEM
   ```
   Product: Organic Tomatoes
   Quantity: 10 lbs
   Expiration Date: 2026-02-15  ← USER ENTERS THIS MANUALLY
   Purchase Date: 2026-02-10
   Location: Refrigerator
   ```

3. **System Generates Recommendation** → Based on expiration date
   ```
   Expiration: 2026-02-15 (5 days away)
   → Recommendation: 30% off clearance deal
   ```

## 📋 Where Expiration Dates Come From

### Option 1: Manual Entry (Current Implementation)
- Restaurant owner scans barcode
- Looks at the product packaging for expiration date
- Enters it manually in the form

### Option 2: External Systems (Future Integration)
When integrated with MarketMan/Restaurant365/Oracle Simphony:
- External system tracks inventory with expiration dates
- Sync pulls expiration dates automatically
- No manual entry needed

### Option 3: Product Defaults (Could Be Added)
- Some products have standard shelf lives
- Example: Milk = 7 days, Produce = 3-5 days
- Could auto-suggest expiration dates based on product category

## 🎯 Real-World Scenario

**Restaurant receives shipment:**
```
📦 Delivery arrives: Feb 10, 2026
   - 10 lbs Organic Tomatoes (Barcode: 1234567890123)
   - Expiration date on box: Feb 15, 2026
   - 5 gallons Whole Milk (Barcode: 9876543210987)
   - Expiration date on carton: Feb 17, 2026
```

**In the app:**
1. Scan tomato barcode → "Organic Tomatoes" product found
2. Enter: Quantity 10, Unit lb, Expiration Feb 15
3. Scan milk barcode → "Whole Milk" product found
4. Enter: Quantity 5, Unit gallon, Expiration Feb 17

**System automatically:**
- Generates deal recommendation for tomatoes (5 days away)
- Generates deal recommendation for milk (7 days away)

## 💡 UX Improvements We Could Add

### 1. Quick Date Buttons
Add buttons for common expiration periods:
```
[Today] [Tomorrow] [+3 Days] [+7 Days] [+14 Days]
```

### 2. Date Picker Component
Replace text input with native date picker:
```typescript
// Use expo-date-picker or similar
<DatePicker
  value={expirationDate}
  onChange={setExpirationDate}
/>
```

### 3. Smart Defaults by Category
Auto-suggest expiration dates based on product category:
```
Produce → +5 days from today
Dairy → +7 days from today
Meat → +3 days from today
Dry Goods → +30 days from today
```

### 4. Batch/Lot Number Scanning
Some products have lot numbers that could be scanned:
- Lot number might encode expiration date
- Could parse and extract expiration date

### 5. Camera OCR for Expiration Dates
Advanced feature:
- Take photo of product label
- Use OCR to extract expiration date
- Auto-fill the field

## 🔌 External System Integration

When integrated with external systems, expiration dates WOULD come automatically:

### MarketMan Integration Example:
```typescript
// Sync from MarketMan API
const inventory = await marketmanAPI.getInventory(restaurantId);

// Response includes expiration dates
{
  product_id: "1234567890123",
  quantity: 10,
  expiration_date: "2026-02-15",  // ← Comes from MarketMan!
  received_date: "2026-02-10"
}
```

### Restaurant365 Integration Example:
```typescript
// Sync from Restaurant365
const items = await restaurant365API.getInventoryItems();

// Each item has expiration date
items.forEach(item => {
  // Expiration date already included
  addInventoryItem({
    ...item,
    expiration_date: item.expiry_date  // From Restaurant365
  });
});
```

## ✅ Current Implementation Status

**What Works:**
- ✅ Barcode scanning identifies products
- ✅ Manual expiration date entry
- ✅ Automatic recommendation generation based on expiration dates
- ✅ Expiration date is optional (items without dates won't get recommendations)

**What's Missing:**
- ⏳ Date picker component (currently text input)
- ⏳ Quick date buttons
- ⏳ Smart defaults by category
- ⏳ External system integration (Phase 2)

## 🎯 Recommendation

**For MVP (Current):**
- Keep manual entry (it's accurate)
- Add quick date buttons for better UX
- Make expiration date more prominent in the form

**For Phase 2:**
- Integrate with external systems
- Auto-populate expiration dates from sync
- Add date picker component

## 📝 Summary

**Key Point:** Barcodes identify products, not expiration dates. Expiration dates must be:
1. Entered manually (current)
2. Synced from external systems (future)
3. Estimated based on product category (could add)

The system is designed to work with manual entry, which is actually more accurate than trying to guess expiration dates from barcodes!
