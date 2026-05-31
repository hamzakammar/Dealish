# Changelog

Notable changes to Dealish. Newest first.

## 2026-05-31 — Deployment bug fixes, server-side Places, Sheets import

Fixed the deployment bugs surfaced after the technical-debt pass, and moved
geocoding/ratings off Nominatim onto Google Places (server-side).

- **Restaurant ratings are read-only**, sourced from Google (`places.rating` /
  `userRatingCount`) instead of self-reported. Removes the "restaurants can inflate
  their own stars" bug.
- **Server-side Places** edge function (`supabase/functions/places`): New Places API
  v1 proxy with `autocomplete` / `details` / `geocode`, returning
  `{lat,lng,address,name,rating,userRatingCount}`. Keyed by the `GOOGLE_MAPS_API_KEY`
  secret. Fixes restaurant-creation (coords now populate) and address autocomplete
  (Nominatim forbade as-you-type autocomplete + throttled).
- `create-restaurant` / `restaurant` admin screens wired to Places, with Nominatim
  kept only as a geocode fallback.
- **Idempotent Sheets import**: re-importing the same Google Sheet now updates rows
  (match by SKU, else name) instead of duplicating every product + inventory row.
- Docs: `places` edge function + `GOOGLE_MAPS_API_KEY` secret recorded.
