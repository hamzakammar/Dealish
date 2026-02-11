# Inventory Management System - Brainstorming Document

## Overview
Build an inventory management system that integrates with restaurant POS/inventory systems (MarketMan, Restaurant365, Oracle Simphony) to track product inventory, monitor expiration dates, and automatically recommend deals for items that are going bad.

---

## 🎯 Core Features

### 1. **Inventory Tracking**
- **Barcode Scanning**: Restaurant owners scan product barcodes to add/update inventory
- **Product Database**: Store product information (name, SKU, category, supplier, etc.)
- **Quantity Tracking**: Track current stock levels
- **Expiration Date Management**: Record and monitor expiration dates
- **Multi-location Support**: Track inventory per restaurant location

### 2. **External System Integration**
- **API Integrations**: Connect with MarketMan, Restaurant365, Oracle Simphony
- **Sync Mechanisms**: 
  - Real-time sync (webhooks)
  - Scheduled sync (daily/hourly)
  - Manual sync trigger
- **Data Mapping**: Map external product IDs to internal product IDs
- **Conflict Resolution**: Handle discrepancies between systems

### 3. **Expiration Monitoring**
- **Expiration Alerts**: 
  - Items expiring in 1-3 days (urgent)
  - Items expiring in 4-7 days (warning)
  - Items expiring in 8-14 days (notice)
- **Automated Notifications**: Push notifications to restaurant owners
- **Dashboard Widgets**: Visual indicators of expiring inventory

### 4. **Deal Recommendation Engine**
- **Smart Recommendations**: Automatically suggest deals based on:
  - Items expiring soon
  - Current stock levels
  - Historical sales data
  - Seasonal trends
  - Customer preferences (tags)
- **Deal Templates**: Pre-configured deal types:
  - "Flash Sale" (expiring today/tomorrow)
  - "Clearance" (expiring in 3-7 days)
  - "Bundle Deals" (combine multiple expiring items)
- **One-Click Deal Creation**: Generate deals directly from inventory alerts

---

## 📊 Database Schema Design

### Core Tables

#### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  barcode TEXT, -- UPC/EAN barcode
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., "produce", "dairy", "meat", "beverages"
  unit TEXT, -- "lbs", "oz", "each", "case"
  supplier TEXT,
  external_product_id TEXT, -- ID from MarketMan/Restaurant365/etc
  external_system TEXT, -- "marketman", "restaurant365", "oracle_simphony"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, barcode)
);
```

#### `inventory_items`
```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL NOT NULL,
  unit_cost DECIMAL,
  purchase_date DATE,
  expiration_date DATE,
  received_date TIMESTAMP DEFAULT NOW(),
  location TEXT, -- "freezer", "refrigerator", "pantry", "dry storage"
  batch_number TEXT,
  supplier TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'sold', 'wasted')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `inventory_sync_logs`
```sql
CREATE TABLE inventory_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  external_system TEXT NOT NULL,
  sync_type TEXT CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),
  status TEXT CHECK (status IN ('success', 'failed', 'partial')),
  items_synced INTEGER DEFAULT 0,
  errors JSONB,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `external_system_credentials`
```sql
CREATE TABLE external_system_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  system_type TEXT NOT NULL CHECK (system_type IN ('marketman', 'restaurant365', 'oracle_simphony')),
  api_key TEXT, -- Encrypted
  api_secret TEXT, -- Encrypted
  account_id TEXT,
  access_token TEXT, -- Encrypted, for OAuth systems
  refresh_token TEXT, -- Encrypted
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(restaurant_id, system_type)
);
```

#### `deal_recommendations`
```sql
CREATE TABLE deal_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommendation_type TEXT CHECK (recommendation_type IN ('flash_sale', 'clearance', 'bundle', 'custom')),
  suggested_title TEXT,
  suggested_description TEXT,
  suggested_discount_percent DECIMAL,
  urgency_score INTEGER, -- 1-100, based on expiration date
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'created')),
  deal_id UUID REFERENCES deals(id), -- If recommendation was turned into a deal
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 Integration Architecture

### Integration Patterns

#### 1. **MarketMan Integration**
- **API**: REST API with OAuth 2.0
- **Endpoints Needed**:
  - `/inventory` - Get current inventory
  - `/products` - Get product catalog
  - `/purchases` - Get purchase orders
- **Sync Strategy**: 
  - Daily scheduled sync at 2 AM
  - Real-time webhooks for inventory changes
  - Manual sync button in admin UI

#### 2. **Restaurant365 Integration**
- **API**: REST API with API keys
- **Endpoints Needed**:
  - `/api/inventory` - Inventory levels
  - `/api/products` - Product information
- **Sync Strategy**: 
  - Hourly sync during business hours
  - Manual sync option

#### 3. **Oracle Simphony Integration**
- **API**: REST API or database connection
- **Endpoints Needed**:
  - Inventory endpoints
  - Product catalog endpoints
- **Sync Strategy**: 
  - Real-time via database triggers (if possible)
  - Scheduled syncs

### Integration Service Layer

```typescript
// services/inventory/integrationService.ts
interface IntegrationService {
  authenticate(credentials: ExternalCredentials): Promise<AuthResult>;
  syncInventory(restaurantId: string): Promise<SyncResult>;
  getProducts(restaurantId: string): Promise<Product[]>;
  getInventory(restaurantId: string): Promise<InventoryItem[]>;
}

class MarketManService implements IntegrationService { ... }
class Restaurant365Service implements IntegrationService { ... }
class OracleSimphonyService implements IntegrationService { ... }
```

---

## 📱 User Interface Design

### Admin Dashboard - Inventory Section

#### 1. **Inventory Overview Page**
- **Stats Cards**:
  - Total items in stock
  - Items expiring this week
  - Items expiring today
  - Total inventory value
- **Quick Actions**:
  - "Scan Barcode" button
  - "Sync External System" button
  - "View Recommendations" button

#### 2. **Inventory List View**
- **Filters**:
  - By category
  - By expiration date range
  - By location (freezer, fridge, etc.)
  - By status (active, expired, etc.)
- **Columns**:
  - Product name
  - Quantity
  - Expiration date (color-coded)
  - Status
  - Actions (edit, delete, create deal)

#### 3. **Barcode Scanner Page**
- Camera view for scanning
- Manual entry option
- Product lookup/creation flow
- Quick add to inventory

#### 4. **Deal Recommendations Page**
- **Recommendation Cards**:
  - Product image/icon
  - Product name
  - Expiration date
  - Urgency indicator
  - Suggested deal details
  - "Create Deal" button
  - "Dismiss" button
- **Filters**:
  - By urgency
  - By category
  - By recommendation type

#### 5. **External System Settings**
- Connection status indicator
- Configure credentials
- Test connection button
- Sync schedule settings
- Last sync timestamp

---

## 🤖 Deal Recommendation Algorithm

### Recommendation Logic

```typescript
interface RecommendationFactors {
  daysUntilExpiration: number;
  currentStockLevel: number;
  averageDailySales: number;
  productCategory: string;
  historicalDealPerformance: number;
  seasonalityFactor: number;
}

function calculateUrgencyScore(factors: RecommendationFactors): number {
  // Base score from expiration date
  let score = 100 - (factors.daysUntilExpiration * 5);
  
  // Adjust for stock level (more stock = higher urgency)
  score += Math.min(factors.currentStockLevel / 10, 20);
  
  // Adjust for sales velocity (slow movers = higher urgency)
  if (factors.averageDailySales < 1) {
    score += 15;
  }
  
  // Category adjustments (perishables = higher urgency)
  const perishableCategories = ['produce', 'dairy', 'meat', 'seafood'];
  if (perishableCategories.includes(factors.productCategory)) {
    score += 10;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

function generateDealRecommendation(
  inventoryItem: InventoryItem,
  product: Product
): DealRecommendation {
  const daysUntilExpiration = calculateDaysUntilExpiration(inventoryItem.expiration_date);
  const urgencyScore = calculateUrgencyScore({...});
  
  let recommendationType: string;
  let discountPercent: number;
  
  if (daysUntilExpiration <= 1) {
    recommendationType = 'flash_sale';
    discountPercent = 50; // 50% off
  } else if (daysUntilExpiration <= 3) {
    recommendationType = 'flash_sale';
    discountPercent = 40;
  } else if (daysUntilExpiration <= 7) {
    recommendationType = 'clearance';
    discountPercent = 30;
  } else {
    recommendationType = 'clearance';
    discountPercent = 20;
  }
  
  return {
    type: recommendationType,
    title: `Flash Sale: ${product.name}`,
    description: `Limited time offer - ${product.name} expires ${formatDate(inventoryItem.expiration_date)}`,
    discountPercent,
    urgencyScore,
    suggestedTags: [product.category, 'limited-time', 'expiring-soon']
  };
}
```

### Bundle Recommendations
- Group multiple expiring items from same category
- Create "Buy X, Get Y" deals
- Example: "Expiring Produce Bundle" - combine tomatoes, lettuce, cucumbers

---

## 🔔 Notification System

### Alert Types

1. **Expiration Alerts**
   - Push notification: "5 items expiring in 2 days"
   - Email digest: Daily summary of expiring items
   - In-app notification badge

2. **Recommendation Alerts**
   - Push: "New deal recommendation available"
   - In-app: Highlighted recommendation card

3. **Sync Alerts**
   - Success: "Inventory synced successfully - 45 items updated"
   - Failure: "Sync failed - check connection settings"

### Notification Preferences
- Allow users to configure:
  - Alert thresholds (e.g., only notify if expiring in < 3 days)
  - Notification frequency
  - Preferred channels (push, email, in-app)

---

## 🚀 Implementation Phases

### Phase 1: Core Inventory Tracking (MVP)
**Timeline: 2-3 weeks**

- [ ] Database schema migration
- [ ] Basic inventory CRUD operations
- [ ] Barcode scanner integration
- [ ] Manual inventory entry
- [ ] Inventory list view with filters
- [ ] Expiration date tracking
- [ ] Basic expiration alerts

**Deliverables:**
- Restaurant owners can scan barcodes and add inventory
- View inventory with expiration dates
- Get alerts for expiring items

### Phase 2: External System Integration
**Timeline: 3-4 weeks**

- [ ] Integration service architecture
- [ ] MarketMan API integration
- [ ] Restaurant365 API integration
- [ ] Oracle Simphony integration (if needed)
- [ ] Credential management UI
- [ ] Sync scheduling system
- [ ] Sync status/logging

**Deliverables:**
- Connect to external POS/inventory systems
- Automatic inventory sync
- Manual sync option

### Phase 3: Deal Recommendation Engine
**Timeline: 2-3 weeks**

- [ ] Recommendation algorithm implementation
- [ ] Urgency scoring system
- [ ] Deal template system
- [ ] Recommendation UI
- [ ] One-click deal creation
- [ ] Bundle recommendation logic

**Deliverables:**
- Automated deal recommendations
- Create deals directly from recommendations
- Smart discount suggestions

### Phase 4: Advanced Features
**Timeline: 2-3 weeks**

- [ ] Historical sales data integration
- [ ] Machine learning for better recommendations
- [ ] Multi-product bundle deals
- [ ] Inventory analytics dashboard
- [ ] Cost tracking and profit analysis
- [ ] Supplier management

**Deliverables:**
- Advanced analytics
- ML-powered recommendations
- Financial insights

---

## 🔒 Security & Privacy Considerations

1. **API Credentials**
   - Encrypt stored credentials
   - Use environment variables for API keys
   - Implement credential rotation

2. **Data Access**
   - Row-level security (RLS) for inventory data
   - Restaurant owners can only see their own inventory
   - Audit logs for sensitive operations

3. **Barcode Data**
   - Store barcodes securely
   - Consider GDPR compliance for product data

---

## 📈 Analytics & Reporting

### Key Metrics to Track

1. **Inventory Metrics**
   - Total inventory value
   - Items wasted vs. sold
   - Average days to expiration
   - Most expiring categories

2. **Deal Performance**
   - Deals created from recommendations
   - Redemption rate of inventory-based deals
   - Revenue from expiring inventory deals
   - Waste reduction percentage

3. **System Usage**
   - Sync frequency
   - Barcode scans per day
   - Recommendations generated vs. accepted

---

## 🛠️ Technical Stack Considerations

### New Dependencies Needed
- **Barcode Scanner**: `expo-barcode-scanner` or `react-native-vision-camera` with barcode detection
- **Cron Jobs**: For scheduled syncs (Supabase Edge Functions or external service)
- **Encryption**: For storing API credentials (`crypto-js` or native encryption)
- **Date Handling**: `date-fns` or `dayjs` for expiration date calculations

### API Integration Libraries
- **HTTP Client**: Already using Supabase, can use `fetch` or `axios`
- **OAuth**: For systems requiring OAuth (MarketMan)

---

## 💡 Future Enhancements

1. **AI/ML Features**
   - Predict optimal discount percentages
   - Forecast expiration dates based on historical data
   - Suggest best times to create deals

2. **Supplier Integration**
   - Direct ordering from suppliers
   - Automatic reorder points
   - Supplier price comparison

3. **Multi-Restaurant Chain Support**
   - Transfer inventory between locations
   - Chain-wide inventory visibility
   - Centralized deal management

4. **Customer-Facing Features**
   - Show "limited quantity" badges on deals
   - Real-time inventory availability
   - Pre-order expiring items

---

## ❓ Open Questions

1. **Barcode Database**: 
   - Use existing barcode databases (Open Product Data, UPC Database)?
   - Or rely on external systems for product info?

2. **Expiration Date Accuracy**:
   - How accurate are expiration dates from external systems?
   - Should we allow manual adjustments?

3. **Deal Auto-Creation**:
   - Should deals be created automatically for urgent items?
   - Or always require owner approval?

4. **Inventory Units**:
   - How to handle different units (lbs vs. oz, cases vs. individual)?
   - Unit conversion logic needed?

5. **Partial Expiration**:
   - What if only part of inventory expires? (e.g., 10 lbs, 2 lbs expiring)
   - Track by batch/lot numbers?

---

## 🎨 UI/UX Mockups Ideas

### Inventory Dashboard
```
┌─────────────────────────────────────────┐
│  📦 Inventory Management                │
├─────────────────────────────────────────┤
│  [Scan Barcode] [Sync Systems]          │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 245  │ │  12  │ │   5  │ │$2.4K │  │
│  │Items │ │Expire│ │Expire│ │Value │  │
│  │      │ │Week  │ │Today │ │      │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  🔴 Urgent Recommendations (5)         │
│  ┌───────────────────────────────────┐ │
│  │ 🥬 Lettuce - Expires Tomorrow     │ │
│  │ Create 40% Off Deal →             │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Recent Inventory                       │
│  [Filter: All | Expiring | Low Stock]  │
│  ┌───────────────────────────────────┐ │
│  │ 🥕 Carrots    5 lbs  Exp: 2/15   │ │
│  │ 🥛 Milk       2 gal  Exp: 2/12   │ │
│  │ 🍅 Tomatoes   3 lbs  Exp: 2/14   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 📝 Next Steps

1. **Review & Refine**: Discuss this document with stakeholders
2. **Prioritize Features**: Decide on MVP scope
3. **API Research**: Investigate MarketMan/Restaurant365/Oracle Simphony APIs
4. **Prototype**: Build a simple barcode scanner + inventory entry flow
5. **Database Design**: Finalize schema and create migration files
6. **UI Design**: Create detailed mockups for key screens

---

## 🔗 Resources

- [MarketMan API Documentation](https://marketman.com/api) (need to verify)
- [Restaurant365 API](https://restaurant365.com/api) (need to verify)
- [Oracle Simphony Integration Guide](https://docs.oracle.com) (need to verify)
- [UPC Database](https://www.upcdatabase.com/)
- [Open Product Data](https://www.openproductdata.org/)

---

*Last Updated: February 10, 2026*

---

## 🔧 Quick Implementation Notes

### Barcode Scanner Extension

**Current State**: The app already has QR code scanning using `expo-camera` (`components/QRScanner.tsx`)

**To Support Product Barcodes**: Extend the scanner to support UPC/EAN barcodes:

```typescript
// In QRScanner.tsx or new BarcodeScanner.tsx
barcodeScannerSettings={{
  barcodeTypes: [
    "qr",           // Keep existing QR support
    "ean13",        // Standard product barcode (13 digits)
    "ean8",         // Short product barcode (8 digits)
    "upc_a",        // UPC-A (12 digits)
    "upc_e",        // UPC-E (6 digits)
    "code128",      // Code 128 (common in warehouses)
    "code39",       // Code 39
  ],
}}
```

**Barcode Scanner Component**: Create a reusable `BarcodeScanner.tsx` component that:
- Can be used for both QR codes (deal redemption) and product barcodes (inventory)
- Accepts a `mode` prop: `"qr" | "barcode" | "both"`
- Returns the scanned barcode/UPC code

### Product Lookup Strategy

**Option 1: External Barcode Database APIs**
- [Open Product Data API](https://www.openproductdata.org/)
- [UPCitemdb](https://www.upcitemdb.com/api)
- [Barcode Lookup API](https://www.barcodelookup.com/api)

**Option 2: Build Internal Product Database**
- Start with manual entry
- Gradually build catalog from scans
- Use external APIs as fallback

**Option 3: Rely on External Systems**
- If integrated with MarketMan/Restaurant365, use their product catalogs
- Sync product data during inventory sync

### Recommended Approach
1. **Phase 1**: Manual product entry + barcode scanning (store barcode, let user enter product info)
2. **Phase 2**: Add external barcode API lookup as enhancement
3. **Phase 3**: Integrate with external systems for automatic product data

---

## 📋 Next Immediate Steps

1. **Review this document** with your team
2. **Prioritize features** - decide what's MVP vs. future phases
3. **Research APIs**:
   - MarketMan API documentation
   - Restaurant365 API documentation  
   - Oracle Simphony integration options
   - Barcode lookup APIs (free vs. paid)
4. **Create database migration** for Phase 1 tables (`products`, `inventory_items`)
5. **Build MVP prototype**:
   - Barcode scanner for products
   - Simple inventory entry form
   - Inventory list view
   - Basic expiration alerts

---

## 💬 Discussion Points

**Questions to Consider:**

1. **Integration Priority**: Which external system should we integrate first? (MarketMan seems most common)

2. **Barcode vs Manual Entry**: Should we support both? What's the primary workflow?

3. **Expiration Date Source**: 
   - Do external systems provide expiration dates?
   - Or do restaurant owners manually enter them?

4. **Deal Auto-Creation**: 
   - Should urgent items (expiring today) auto-create deals?
   - Or always require owner approval?

5. **Inventory Units**: 
   - How granular should tracking be? (e.g., track individual items vs. cases)
   - Handle unit conversions? (lbs → oz, cases → individual)

6. **Multi-Product Deals**: 
   - How should bundle deals work?
   - Combine multiple expiring items automatically?

7. **Notifications**: 
   - How often should owners be notified?
   - Email vs. push notifications vs. in-app only?

8. **Historical Data**: 
   - Track historical inventory for analytics?
   - How long to keep expired item records?

---

## 🎯 Success Metrics

**Track these KPIs to measure success:**

- **Adoption Rate**: % of restaurants using inventory system
- **Scan Frequency**: Average barcode scans per restaurant per day
- **Deal Creation Rate**: % of recommendations turned into deals
- **Waste Reduction**: % reduction in expired/wasted inventory
- **Revenue Impact**: Additional revenue from inventory-based deals
- **Time Savings**: Time saved vs. manual inventory management
- **Sync Reliability**: % successful syncs with external systems

---

## 📚 Additional Resources

### Expo Camera Barcode Types
- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- Supported barcode types: `qr`, `ean13`, `ean8`, `upc_a`, `upc_e`, `code128`, `code39`, `codabar`, `itf14`, `aztec`, `datamatrix`, `pdf417`

### Barcode Lookup APIs
- **Free**: UPCitemdb, Open Product Data
- **Paid**: Barcode Lookup API, UPC Database API
- **Consider**: Rate limits, data quality, coverage

### Inventory Management Best Practices
- FIFO (First In, First Out) tracking
- Batch/lot number tracking for recalls
- Minimum stock level alerts
- Supplier management integration

---

*This document is a living document - update as you make decisions and learn more about requirements!*
