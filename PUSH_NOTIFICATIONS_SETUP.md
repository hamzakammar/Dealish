# Push Notifications Setup Guide

## Overview
Push notifications are implemented for three events:
1. **New deals on favorite restaurants** - Users get notified when a new deal is added to a restaurant they've favorited
2. **Deal redemption** - Users get notified when they redeem a deal via QR code scan
3. **New partner restaurants** - All users get notified when a new restaurant becomes a partner

## Setup Steps

### 1. Database Migrations
Run the following migrations in order:
```bash
# Add push token fields to profiles table
psql -f database/migrations/add_push_tokens.sql

# Optional: Add database triggers (requires pg_net extension)
# psql -f database/migrations/add_notification_triggers.sql
```

### 2. Supabase Edge Function
Deploy the Edge Function to handle sending notifications:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-push-notification
```

The Edge Function requires these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin access)

### 3. Expo Configuration
The app is already configured in `app.json` with:
- iOS background modes for remote notifications
- Android next-gen notifications API
- Expo notifications plugin

### 4. Get Expo Project ID
You need to configure your Expo Project ID. You can get it from:
1. Run `npx expo whoami` and `npx expo init` to create an EAS project, OR
2. Get it from your `app.json` if you've set it up with EAS

Add to `app.json`:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
```

### 5. Testing on Physical Device
Push notifications **only work on physical devices**, not simulators/emulators.

1. Build and install on a physical device
2. Grant notification permissions when prompted
3. Test notifications using Expo's tool: https://expo.dev/notifications

## Usage

### Automatic Notifications

#### Deal Redemption
Notifications are automatically sent when a user scans a QR code to redeem a deal. This happens in `utils/qrCode.ts` → `recordQRCodeScan()`.

#### New Deals (Admin Side)
When creating a new deal on the admin side, call:
```typescript
import { notifyNewDeal } from '@/utils/notifications';

await notifyNewDeal(
  dealId,
  restaurantId,
  dealTitle,
  dealDescription // optional
);
```

#### New Partner Restaurants (Admin Side)
When a restaurant becomes a partner, call:
```typescript
import { notifyNewPartner } from '@/utils/notifications';

await notifyNewPartner(restaurantId);
```

### User Settings
Users can control notifications in Settings:
- **Favorites Updates** - Controls new deal notifications for favorited restaurants
- **Visit Updates** - Controls deal redemption notifications
- **Deal Updates** - Controls new partner restaurant notifications

Settings are stored in `profiles.settings.notifications` and are checked before sending notifications.

## Architecture

### Flow
1. **Event occurs** (deal created, QR scanned, restaurant becomes partner)
2. **Check user preferences** - Filter users based on settings
3. **Get push tokens** - Query users with valid push tokens
4. **Call Edge Function** - Send notification request to Supabase Edge Function
5. **Edge Function** - Validates settings, calls Expo Push Service
6. **Expo Push Service** - Delivers notification to device
7. **Device** - Shows notification, handles taps

### Files
- `hooks/usePushNotifications.ts` - Client-side push token management
- `utils/notifications.ts` - Helper functions for sending notifications
- `supabase/functions/send-push-notification/index.ts` - Edge Function for sending
- `database/migrations/add_push_tokens.sql` - Database schema
- `database/migrations/add_notification_triggers.sql` - Optional database triggers

## Troubleshooting

### Notifications not working?
1. Check device is physical (not simulator)
2. Verify notification permissions are granted
3. Check push token is saved in database (`profiles.push_token`)
4. Verify Expo Project ID is configured
5. Check Edge Function is deployed and has correct env vars
6. Check user settings allow notifications

### Testing
Use Expo's Push Notification Tool: https://expo.dev/notifications
- Enter a push token from your database
- Send a test notification
- Check device receives it

## Notes
- Database triggers (`add_notification_triggers.sql`) require `pg_net` extension
- If triggers don't work, use the helper functions (`notifyNewDeal`, `notifyNewPartner`) from application code
- Notifications respect user settings automatically
- Push tokens are automatically saved when users log in
