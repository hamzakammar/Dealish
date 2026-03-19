# Architecture

> Last updated: 2026-03-19  
> Status: living document — update whenever the system shape changes.

---

## Overview

Dealish is a mobile-first deal-sharing app. The client is a React Native app built with Expo (file-based routing via Expo Router). The backend is Supabase (PostgreSQL + Auth + Storage + Edge Functions). There is no separate API server.

```
┌─────────────────────────────────────────┐
│            Expo (React Native)          │
│  app/  components/  hooks/  utils/      │
└────────────────────┬────────────────────┘
                     │ supabase-js client
┌────────────────────▼────────────────────┐
│                 Supabase                │
│  Auth │ PostgreSQL │ Storage │ Edge Fns │
└─────────────────────────────────────────┘
```

---

## Client Layer

### Routing
- Expo Router with file-based routing inside `app/`.
- Layouts are defined with `_layout.tsx` files.
- Auth-gating is handled at the layout level, not per-screen.

### State
- Server state (deals, user data) is fetched directly via Supabase queries in `hooks/`.
- Local UI state lives in component `useState` / `useReducer`.
- No global state manager (Redux, Zustand, etc.) is currently used. See `docs/debt.md` if this becomes a problem.

### Components
- Shared, reusable components live in `components/`.
- Screen-specific components live co-located with their screen in `app/`.

---

## Data Layer

### Database
- PostgreSQL via Supabase.
- Migrations live in `supabase/migrations/`.
- Row Level Security (RLS) is enabled on all user-facing tables.
- Typed query helpers live in `database/`.

### Auth
- Supabase Auth handles sign-up, sign-in, and session management.
- The Supabase client is initialized once and shared via a singleton in `database/`.

### Storage
- Supabase Storage is used for user-uploaded images (deal photos, avatars).

### Edge Functions
- Supabase Edge Functions (Deno) live in `supabase/functions/`.
- Used for server-side logic that should not run on the client (e.g., notifications, webhook handling).

---

## External Services

| Service | Purpose | Notes |
|---|---|---|
| Supabase | Auth, DB, Storage, Edge Functions | Primary backend |
| Expo | Build, OTA updates, push notifications | Managed workflow |
| EAS | CI/CD and app store builds | Config in `eas.json` |

---

## Key Data Models

> Update this section as schemas evolve. Reference migration files in `supabase/migrations/` for the canonical schema.

- **User** — authenticated user profile, linked to Supabase Auth UID.
- **Deal** — a deal post with title, description, price, image, category, and location.
- **Vote / Reaction** — upvote/downvote or emoji reaction on a deal.
- **Comment** — threaded comment on a deal.

---

## Known Constraints

- All data access goes through the Supabase client. Do not bypass RLS with service-role keys in client code.
- Expo managed workflow — native modules require an Expo config plugin or a bare workflow migration.
- Edge Functions are stateless. Do not rely on in-memory state between invocations.

---

## Decision Log

See `docs/decisions/` for the full ADR history. Notable decisions:

- Why Supabase over a custom API: see `ADR-0001` (to be created).
- Why Expo Router over React Navigation: see `ADR-0002` (to be created).
