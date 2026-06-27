# Database Query Analysis - Frontend & Scripts

**Analysis Date:** 2026-06-23

## Overview
This document identifies potential inefficiencies in database queries across frontend hooks and backend scripts, including N+1 query patterns, unnecessary column fetching, and missing error handling.

---

## ✅ Well-Optimized Queries

### 1. **useActiveDealsMap** (`hooks/useActiveDealsMap.ts`)
- **Query Pattern:** Batch fetch with `.in()` operator
- **Lines:** 32-37
```typescript
const { data, error } = await supabase
  .from("deals")
  .select("*")
  .in("restaurant_id", restaurantIds)
  .eq("is_active", true)
  .neq("is_flagged", true);
```
- **✅ Efficient:** Uses `.in()` to fetch deals for multiple restaurants in ONE query
- **✅ Good:** Has error handling and cleanup on unmount
- **Minor Issue:** Selects all columns (`*`) but only uses specific fields

---

## ⚠️ Potential N+1 Query Patterns

### 2. **useProducts.updateProduct** (`hooks/useProducts.ts`)
- **Location:** Lines 129-146
- **Issue:** Potential N+1 when regenerating alerts after product update
```typescript
const { data: inventoryItems } = await supabase
  .from('inventory_items')
  .select('id')
  .eq('restaurant_id', restaurantId)
  .eq('product_id', id)
  .eq('status', 'active');

if (inventoryItems) {
  for (const item of inventoryItems) {  // N+1: Loop makes individual calls
    await generateAlertForItem(restaurantId, item.id);
  }
}
```
- **Problem:** `generateAlertForItem()` is called sequentially for each inventory item
- **Impact:** If a product has 50 inventory items, this creates 50+ sequential database queries
- **Recommendation:** 
  - Batch alert generation into a single operation
  - Use `Promise.all()` for parallel execution
  - Consider database function for bulk alert regeneration

---

## 🔴 Selecting Too Many Columns

### 3. **useRestaurantDeals** (`hooks/useRestaurantDeals.ts`)
- **Location:** Lines 96-102
```typescript
const { data, error } = await supabase
  .from("deals")
  .select("*")  // ⚠️ Selects all columns
  .eq("restaurant_id", restaurantId)
  .eq("is_active", true)
  .neq("is_flagged", true)
  .order("created_at", { ascending: false });
```
- **Issue:** Selects all columns but filtering logic only needs:
  - `end_at`, `start_at`, `is_recurring`, `recurrence_days`, `recurrence_start_time`, `recurrence_end_time`
- **Recommendation:** Specify only needed columns to reduce payload size

### 4. **useRestaurants** (`hooks/useRestaurants.ts`)
- **Location:** Lines 21-25
```typescript
return supabase
  .from("restaurants")
  .select("id,name,lat,lng,address,phone,hero_image_url,type,display_image,rating,num_ratings,partner")
  .eq("is_active", true)
  .limit(500);
```
- **✅ Good:** Explicitly selects only needed columns
- **⚠️ Issue:** Fetches up to 500 restaurants at once (large payload)
- **Minor:** `display_image` and `hero_image_url` are both fetched as fallbacks for each other

---

## 🔴 Missing Indexes / Query Performance

### 5. **useInventoryAlerts** (`hooks/useInventoryAlerts.ts`)
- **Location:** Lines 26-35
```typescript
const { data, error: fetchError } = await supabase
  .from('inventory_alerts')
  .select(`
    *,
    product:products(*),
    inventory_item:inventory_items(*)
  `)
  .eq('restaurant_id', restaurantId)
  .eq('is_read', false)
  .order('created_at', { ascending: false });
```
- **Issues:**
  1. Joins two tables (`products`, `inventory_items`) with wildcard selects
  2. No limit on results - could fetch hundreds of alerts
  3. **Potential N+1:** Each alert row triggers 2 additional table lookups
- **Recommendations:**
  - Add `.limit()` for pagination
  - Specify only needed columns from joined tables
  - Ensure composite index on `(restaurant_id, is_read, created_at)`

### 6. **useInventory** (`hooks/useInventory.ts`)
- **Location:** Lines 28-36
```typescript
const { data, error: fetchError } = await supabase
  .from('inventory_items')
  .select(`
    *,
    product:products(*)
  `)
  .eq('restaurant_id', restaurantId)
  .order('expiration_date', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: false });
```
- **Issues:**
  1. No limit - fetches all inventory items
  2. Wildcard select on joined `products` table
  3. Double sort could be slow on large datasets
- **Recommendations:**
  - Add pagination with `.limit()` and `.offset()`
  - Select specific product columns: `product:products(id,name,category,barcode)`

---

## 🔴 Inefficient Polling / Refetching

### 7. **useRestaurantDeals Polling** (`hooks/useRestaurantDeals.ts`)
- **Location:** Lines 126-130
```typescript
const interval = setInterval(() => {
  if (mounted && restaurantId) {
    fetchDeals();  // Refetches EVERY MINUTE
  }
}, 60000);
```
- **Issue:** Refetches all deals every 60 seconds regardless of changes
- **Impact:** Unnecessary database load, especially for static deals
- **Recommendations:**
  1. Use Supabase Realtime subscriptions instead of polling
  2. Increase polling interval to 5-10 minutes
  3. Add conditional refetch only when deals are time-sensitive

### 8. **useActiveDealsMap Polling** (`hooks/useActiveDealsMap.ts`)
- **Location:** Lines 84-86
```typescript
const interval = setInterval(() => {
  if (mounted) fetchActiveDeals();
}, 60000);
```
- **Same Issue:** Polls every minute for all restaurants
- **Recommendation:** Use Realtime subscriptions for deal changes

---

## 🔴 Scripts: Missing Error Handling & Potential Issues

### 9. **grab-deals.js** (`scripts/agent/grab-deals.js`)

#### Issue A: No Error Handling in Main Loop
- **Location:** Lines 422-459
```javascript
for (const r of restaurants) {
  try {
    const res = await processRestaurant(r);
    // ... processing logic
  } catch (err) {
    log(`! ${r.name}: ${err.message}`);  // Only logs, doesn't track failures
  }
}
```
- **Problem:** Failed restaurants are logged but not tracked for retry
- **Recommendation:** 
  - Track failed restaurant IDs
  - Add retry mechanism with exponential backoff
  - Store failure count in database

#### Issue B: Sequential Processing (Not Parallel)
- **Location:** Lines 422-459
```javascript
for (const r of restaurants) {
  await processRestaurant(r);  // Sequential - slow!
}
```
- **Problem:** Processes restaurants one at a time
- **Impact:** If processing 100 restaurants takes 5s each = 500s total
- **Recommendation:**
  - Use `Promise.allSettled()` with concurrency limit (e.g., 10 at a time)
  - Example:
    ```javascript
    const concurrencyLimit = 10;
    for (let i = 0; i < restaurants.length; i += concurrencyLimit) {
      const batch = restaurants.slice(i, i + concurrencyLimit);
      await Promise.allSettled(batch.map(r => processRestaurant(r)));
    }
    ```

#### Issue C: Unbounded URL Fetching
- **Location:** Lines 348-354
```javascript
for (const u of urls) {
  if (pages >= MAX_PAGES) break;
  const html = u === website && home ? home : await fetchUrl(u);
  if (!html) continue;
  pages++;
  combined += '\n' + htmlToText(html);
}
```
- **Problem:** No timeout/limit on total combined text size
- **Recommendation:** Add cumulative text size limit (e.g., 50KB max)

#### Issue D: Database Staleness Check Could Be More Efficient
- **Location:** Lines 449-456
```javascript
if (APPLY) {
  const { data: st } = await supabase
    .from('scraped_deal_candidates')
    .update({ status: 'stale' })
    .eq('restaurant_id', r.id)
    .eq('status', 'pending')
    .lt('last_seen_at', runStartedAt)
    .select('id');
  if (st) staled += st.length;
}
```
- **Issue:** Runs AFTER processing each restaurant (N queries for N restaurants)
- **Recommendation:** Batch this into ONE query at the end:
  ```javascript
  await supabase
    .from('scraped_deal_candidates')
    .update({ status: 'stale' })
    .in('restaurant_id', processedRestaurantIds)
    .eq('status', 'pending')
    .lt('last_seen_at', runStartedAt);
  ```

---

## 📊 Summary of Issues

| Component | Issue | Severity | Impact |
|-----------|-------|----------|--------|
| `useProducts.updateProduct` | N+1 alert regeneration loop | 🔴 High | Slow product updates |
| `useRestaurantDeals` | Polling every 60s | 🟡 Medium | Unnecessary DB load |
| `useActiveDealsMap` | Polling every 60s | 🟡 Medium | Unnecessary DB load |
| `useInventoryAlerts` | No limit + wildcard joins | 🟡 Medium | Large payloads |
| `useInventory` | No limit + double sort | 🟡 Medium | Slow on large datasets |
| `grab-deals.js` | Sequential processing | 🔴 High | Very slow script execution |
| `grab-deals.js` | No retry mechanism | 🟡 Medium | Silent failures |
| `grab-deals.js` | Per-restaurant staleness check | 🟡 Medium | N queries instead of 1 |

---

## 🔧 Recommended Fixes Priority

### High Priority
1. **Parallelize `grab-deals.js`** - Add concurrency limit to process multiple restaurants at once
2. **Fix N+1 in `useProducts.updateProduct`** - Batch alert regeneration
3. **Add pagination to `useInventory`** - Prevent fetching thousands of items

### Medium Priority
4. **Replace polling with Realtime subscriptions** - `useRestaurantDeals`, `useActiveDealsMap`
5. **Add limits to `useInventoryAlerts`** - Prevent unbounded queries
6. **Optimize joined selects** - Specify columns instead of `*`

### Low Priority
7. **Add retry logic to `grab-deals.js`**
8. **Batch staleness updates in `grab-deals.js`**
9. **Add cumulative text size limit in `grab-deals.js`**

---

## 📝 Example Fixes

### Fix #1: Batch Alert Regeneration
```typescript
// BEFORE (N+1)
for (const item of inventoryItems) {
  await generateAlertForItem(restaurantId, item.id);
}

// AFTER (Parallel)
await Promise.all(
  inventoryItems.map(item => 
    generateAlertForItem(restaurantId, item.id)
  )
);
```

### Fix #2: Add Realtime Subscription
```typescript
// Replace polling interval with Realtime
useEffect(() => {
  const channel = supabase
    .channel('deals-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'deals',
      filter: `restaurant_id=eq.${restaurantId}`
    }, () => {
      fetchDeals();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [restaurantId]);
```

### Fix #3: Parallelize Script with Concurrency Limit
```javascript
async function processBatch(restaurants, concurrency = 10) {
  const results = [];
  for (let i = 0; i < restaurants.length; i += concurrency) {
    const batch = restaurants.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(r => processRestaurant(r))
    );
    results.push(...batchResults);
  }
  return results;
}
```

---

## 🎯 Next Steps
1. Review this analysis with the team
2. Prioritize fixes based on user impact and frequency of use
3. Add database indexes for commonly filtered columns
4. Consider implementing query result caching for static data
5. Monitor query performance with Supabase logs after fixes

