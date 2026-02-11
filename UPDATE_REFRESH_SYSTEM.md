# Update & Refresh System

## Overview

All update operations now properly refresh related data and UI state to ensure no stale data remains. This document outlines the refresh mechanisms implemented throughout the codebase.

## Refresh Mechanisms

### 1. **Immediate Local State Updates**
All update operations update local state immediately for instant UI feedback:
- Products: `setProducts(prev => prev.map(...))`
- Inventory Items: `setInventoryItems(prev => prev.map(...))`
- Recommendations: Automatically refreshed via `fetchRecommendations()`

### 2. **Full Data Refresh After Updates**
After updating, all hooks perform a full data fetch to ensure consistency:
- `fetchProducts()` - Refreshes entire products list
- `fetchInventory()` - Refreshes entire inventory list
- `fetchRecommendations()` - Refreshes recommendations list
- `fetchStats()` - Refreshes inventory statistics

### 3. **Focus-Based Refresh**
Screens refresh data when they come into focus using `useFocusEffect`:
- **Inventory Screen**: Refreshes inventory items and stats
- **Recommendations Screen**: Refreshes recommendations list
- **Deals Screen**: Refreshes deals list

### 4. **Cascade Updates**

#### Product Updates
When a product is updated:
1. ✅ Local state updated immediately
2. ✅ Products list refreshed
3. ✅ **If category/subcategory/item_type changed**: Regenerates recommendations for all inventory items using that product
4. ✅ Inventory items using the product get refreshed (via product join in queries)

#### Inventory Item Updates
When an inventory item is updated:
1. ✅ Local state updated immediately
2. ✅ Inventory list refreshed
3. ✅ Stats refreshed (via `refetchStats()`)
4. ✅ **If expiration_date or received_date changed**: Regenerates recommendations
5. ✅ Recommendations list refreshed (if screen is open)

#### Deal Updates
When a deal is updated:
1. ✅ Deal saved to database
2. ✅ **If created from recommendation**: Recommendation status updated to 'created'
3. ✅ Deals list refreshes when screen comes into focus

#### Recommendation Updates
When a recommendation status is updated:
1. ✅ Status updated in database
2. ✅ Recommendations list automatically refreshed
3. ✅ Removed from pending list if status changed

## Update Functions

### `useProducts.updateProduct()`
```typescript
- Updates product in database
- Updates local state immediately
- Refreshes products list
- Regenerates recommendations if category/subcategory/item_type changed
```

### `useInventory.updateInventoryItem()`
```typescript
- Updates inventory item in database
- Updates local state immediately
- Refreshes inventory list
- Refreshes stats
- Regenerates recommendations if expiration/received date changed
```

### `useInventory.addInventoryItem()`
```typescript
- Adds inventory item to database
- Refreshes inventory list
- Generates recommendation if expiration date exists
```

### `useDealRecommendations.updateRecommendationStatus()`
```typescript
- Updates recommendation status
- Refreshes recommendations list automatically
```

## Screen Refresh Patterns

### Inventory Management Screen
```typescript
useFocusEffect(() => {
  refetch();        // Refresh inventory items
  refetchStats();   // Refresh statistics
});
```

### Recommendations Screen
```typescript
useFocusEffect(() => {
  refetch();  // Refresh recommendations
});
```

### Deals Management Screen
```typescript
useFocusEffect(() => {
  fetchDeals();  // Refresh deals list
});
```

## Form Update Patterns

### Product Form
- Loads existing product data when editing (`productId` provided)
- Updates product → Refreshes products list → Regenerates recommendations if needed
- Navigates back after successful update

### Inventory Item Form
- Loads existing item data when editing (`itemId` provided)
- Updates item → Refreshes inventory list → Refreshes stats → Regenerates recommendations
- Navigates back after successful update

### Deal Form
- Loads existing deal data when editing (`dealId` provided)
- Updates deal → Updates recommendation status if created from recommendation
- Navigates back after successful update
- Parent screen refreshes on focus

## State Cleanup

### When `restaurantId` Changes
All hooks clear their state when `restaurantId` becomes null:
- `setProducts([])`
- `setInventoryItems([])`
- `setStats(null)`
- `setRecommendations([])`

### When Screens Unmount
- All `useEffect` cleanup functions properly cancel operations
- No memory leaks from pending requests

## Database Timestamps

All update operations ensure `updated_at` is refreshed:
```typescript
.update({
  ...updates,
  updated_at: new Date().toISOString(),
})
```

## Error Handling

All update operations:
1. ✅ Show error alerts to user
2. ✅ Log errors to console
3. ✅ **Don't update local state if database update fails**
4. ✅ Return `null` or `false` on error (allowing callers to handle)

## Testing Checklist

- [x] Product update refreshes products list
- [x] Product update regenerates recommendations if category changed
- [x] Inventory item update refreshes inventory list
- [x] Inventory item update refreshes stats
- [x] Inventory item update regenerates recommendations
- [x] Deal update refreshes deals list on focus
- [x] Recommendation status update refreshes recommendations list
- [x] Screens refresh when coming into focus
- [x] State clears when restaurantId changes
- [x] No stale data remains after updates

## Future Enhancements

1. **Optimistic Updates**: Update UI immediately, rollback on error
2. **WebSocket Updates**: Real-time updates when data changes
3. **Cache Invalidation**: Smart cache invalidation for related data
4. **Batch Updates**: Optimize multiple updates in single refresh

---

**Status**: ✅ All update operations properly refresh related data. No stale state remains.
