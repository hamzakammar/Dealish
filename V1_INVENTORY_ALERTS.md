# V1 Inventory Alerts System

## Overview

For V1, the inventory system now uses **simple notifications/alerts** for expiring and slow-moving inventory items, instead of automatically recommending deals. This provides a cleaner, simpler approach that gives restaurant owners visibility into their inventory status without overwhelming them with deal suggestions.

## What Changed

### From Deal Recommendations → To Inventory Alerts

**Previous Approach (V1 - Deal Recommendations):**
- System automatically generated deal recommendations for expiring items
- Recommendations included suggested titles, descriptions, and discount percentages
- Required owner approval before creating deals
- More complex workflow

**New Approach (V1 - Inventory Alerts):**
- System generates simple notifications/alerts for expiring and slow-moving items
- Alerts provide clear messages about item status
- Restaurant owners can view alerts and decide how to act
- Simpler, more straightforward workflow

## Database Schema

### New Table: `inventory_alerts`

```sql
CREATE TABLE inventory_alerts (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL,
  product_id UUID NOT NULL,
  alert_type TEXT NOT NULL, -- 'expiring_soon', 'expiring_today', 'expired', 'slow_moving'
  urgency_score INTEGER, -- 0-100
  days_until_expiration INTEGER,
  days_since_received INTEGER,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Existing Table: `deal_recommendations`

The `deal_recommendations` table still exists in the database but is **not used in V1**. It remains available for future V2+ features if needed.

## Alert Types

1. **`expiring_soon`**: Items expiring in 1-7 days
2. **`expiring_today`**: Items expiring today
3. **`expired`**: Items that have already expired
4. **`slow_moving`**: Items that have been in inventory too long (based on category thresholds)

## Alert Generation Logic

Alerts are generated automatically when:
- An inventory item is added or updated
- An inventory item has an expiration date within 7 days
- An inventory item has been in inventory longer than its category threshold (for slow-moving alerts)
- A product's category/subcategory/item_type is updated (regenerates alerts for related items)

## UI Changes

### Admin Screen Navigation

**Before:**
- "Deal Recommendations" button → `/admin/inventory/recommendations`

**After:**
- "Inventory Alerts" button → `/admin/inventory/alerts`

### Alerts Screen Features

- **List View**: Shows all unread alerts sorted by urgency
- **Alert Cards**: Display product info, alert message, and inventory details
- **Actions**:
  - View Item: Navigate to inventory item details
  - Dismiss: Mark alert as read
  - Mark All Read: Dismiss all alerts at once
- **Empty State**: Shows when no alerts exist

## Files Changed

### New Files
- `database/migrations/add_inventory_alerts.sql` - Database migration
- `hooks/useInventoryAlerts.ts` - Hook for fetching/managing alerts
- `utils/generateInventoryAlerts.ts` - Alert generation logic
- `app/admin/inventory/alerts.tsx` - Alerts UI screen

### Modified Files
- `types/inventory.ts` - Added `InventoryAlert` and `InventoryAlertWithProduct` types
- `hooks/useInventory.ts` - Changed to generate alerts instead of recommendations
- `hooks/useProducts.ts` - Changed to regenerate alerts instead of recommendations
- `app/admin.tsx` - Updated navigation button to point to alerts screen

### Unchanged Files (Still Available for Future)
- `hooks/useDealRecommendations.ts` - Still exists but not used in V1
- `utils/generateRecommendations.ts` - Still exists but not used in V1
- `app/admin/inventory/recommendations.tsx` - Still exists but not used in V1
- `app/admin/deal-form.tsx` - Still references recommendations (for future V2+)

## Migration Steps

1. Run the database migration:
   ```sql
   -- Run: database/migrations/add_inventory_alerts.sql
   ```

2. Existing deal recommendations will remain in the database but won't be displayed in V1

3. New alerts will be generated automatically as inventory items are added/updated

## Future Considerations (V2+)

- Deal recommendations can be reintroduced as a separate feature
- Alerts could be enhanced with push notifications
- Alerts could include quick actions (e.g., "Create Deal" button)
- Integration with external inventory systems could auto-generate alerts
