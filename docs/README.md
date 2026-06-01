# Dealish Documentation

This is the documentation index. Start with `AGENTS.md` at the repo root, then use
the map below. Docs are kept close to the code and are expected to stay current —
if you change the system's shape, update the relevant doc in the same change.

## Map

| Doc | What it covers |
|---|---|
| [`overview.md`](./overview.md) | What Dealish is, who it's for, the core loops |
| [`architecture.md`](./architecture.md) | System shape, layers, data flow |
| [`database-schema.md`](./database-schema.md) | **Authoritative** live Supabase schema (tables, RLS, triggers, RPCs) + critical findings |
| [`routing.md`](./routing.md) | Expo Router route map (every screen) |
| [`features.md`](./features.md) | Feature-by-feature breakdown with the files behind each |
| [`integrations.md`](./integrations.md) | External services: Supabase, Maps, ORS, push, OAuth, Sheets, Sentry, Resend |
| [`edge-functions.md`](./edge-functions.md) | The Deno edge functions and how they're invoked |
| [`deal-scraping-agent.md`](./deal-scraping-agent.md) | Weekly agent that auto-detects non-partner deals into a review queue (design + build plan) |
| [`configuration.md`](./configuration.md) | Env vars, secrets, build/EAS config, app identifiers |
| [`testing.md`](./testing.md) | Test setup and current (failing) state |
| [`debt.md`](./debt.md) | **Authoritative** technical-debt log |
| [`decisions/`](./decisions/) | Architecture Decision Records (ADRs) |
| [`plans/`](./plans/) | Active and historical plans |
| [`sheets-integration/`](./sheets-integration/) | Google Apps Script helper for the Sheets sync |

## Reading order for a new contributor

1. `AGENTS.md` (root) — conventions and how to make changes.
2. `docs/overview.md` — what the app does.
3. `docs/architecture.md` — how it's built.
4. `docs/database-schema.md` — the data model and its sharp edges.
5. `docs/debt.md` — what's already broken or deferred.

## Source-of-truth notes

- **Data model:** `docs/database-schema.md` reflects the live hosted Supabase
  project. The repo's `database/migrations/` do **not** create the base tables.
- **Debt:** `docs/debt.md` is the only place deferred work is tracked. Add entries
  before merging, don't leave debt undocumented.
- **Decisions:** non-trivial choices belong in `docs/decisions/` as ADRs.
