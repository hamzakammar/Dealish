# Dealish

Restaurant deal discovery app for iOS and Android.

## Stack

- React Native (Expo)
- Supabase (auth, database, edge functions)
- Google Maps / Apple Maps

## Features

- Browse nearby restaurant deals on an interactive map
- Filter by category, distance, and active deals
- Restaurant admin dashboard
- Google Sheets integration — sync inventory automatically via OAuth
- Partner restaurant support

## Admin

Restaurant owners can manage deals, inventory, and integrations from the in-app admin dashboard.

### Google Sheets Sync

Connect a Google account and paste a Sheet URL. Deals sync automatically every 5 minutes. Columns are detected automatically — no template required.

## Dev

```bash
npm install
npx expo start
```

