# Dealish — Agent Guide

> **Read this first.** This file is the authoritative entry point for any AI agent or engineer working in this repository. It tells you how the codebase is structured, where decisions live, and how to make progress without breaking things.

---

## 1. What is Dealish?

Dealish is a React Native (Expo) mobile app built with TypeScript and a Supabase backend. It helps users find and share deals. The codebase is organized as a single Expo project with file-based routing (`app/`), shared components, and Supabase for auth, database, and edge functions.

---

## 2. Repo Map (progressive disclosure)

| Path | Purpose |
|---|---|
| `app/` | Expo Router screens and layouts (file-based routing) |
| `components/` | Shared UI components |
| `constants/` | App-wide constants (colors, config, etc.) |
| `database/` | Supabase query helpers and typed clients |
| `hooks/` | Custom React hooks |
| `plugins/` | Expo config plugins |
| `supabase/` | Supabase migrations, edge functions, seed data |
| `types/` | Global TypeScript types and interfaces |
| `utils/` | Pure utility functions |
| `docs/` | Architecture, debt log, ADRs, and plans — **start here for context** |
| `AGENTS.md` | This file |
| `LAUNCH_CHECKLIST.md` | Pre-launch task checklist |
| `LAUNCH_READY.md` | Launch readiness assessment |

---

## 3. Key Conventions

- **TypeScript everywhere.** All new files must be `.ts` or `.tsx`. No `any` without a comment explaining why.
- **Supabase is the source of truth for data.** Do not introduce a second database or ORM layer.
- **File-based routing.** New screens go in `app/`. Do not define navigation stacks manually.
- **Component co-location.** A component used in only one screen lives next to that screen. A component used in two or more moves to `components/`.
- **Hooks for side effects.** Data fetching, subscriptions, and async logic belong in `hooks/`, not inline in components.
- **No secrets in source.** Environment variables live in `.env.local` (gitignored). Use `Constants.expoConfig.extra` to access them in app code.

---

## 4. Before You Change Anything

1. Read `docs/architecture.md` — understand the current system shape.
2. Read `docs/debt.md` — know what is already broken or deferred.
3. Check `docs/decisions/` — look for an ADR that covers the area you're working in.
4. Check `docs/plans/` — see if there is an active plan for this feature.

---

## 5. How to Make a Change

1. **Small change (bug fix, copy, style):** Make it directly on `main` with a clear commit message.
2. **Feature or refactor:** Create a branch, open a PR, and reference any relevant ADR or plan.
3. **Architecture decision:** Write or update an ADR in `docs/decisions/` before or alongside the change.
4. **New technical debt:** Add an entry to `docs/debt.md` immediately — do not leave it undocumented.

---

## 6. Running the Project

```bash
npm install
npx expo start
```

For Supabase local dev:
```bash
npx supabase start
```

See `package.json` for all available scripts.

---

## 7. Where Decisions Live

- **Why we chose X over Y:** `docs/decisions/ADR-NNNN-title.md`
- **What is broken or deferred:** `docs/debt.md`
- **What we are building next:** `docs/plans/`
- **System shape and data flow:** `docs/architecture.md`

---

*Keep this file current. If the repo changes shape, update this map.*
