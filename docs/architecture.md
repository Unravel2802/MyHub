# Architecture — layers, boundaries, and what enforces them

The one-page answer to "where does this code go, and what may it import?"

MyHub is a **modular monolith**, not a monorepo: one `package.json`, one build,
one deployable, one database. The isolation a monorepo buys with package
manifests is bought here with lint rules — see "What enforces this" below.

## Layers

```
app/                      routes (thin — a route wires a module's page component)
  └─ <route>/page.tsx

src/components/           THE SHELL — chrome every page shares
  ├─ AppShell.tsx         nav rail, command palette, streak indicator
  ├─ momentumState.ts     shell-owned state exposed to pages
  ├─ appNav.ts            the nav list
  ├─ miniApps.ts          mini-app grouping + core-tool classification
  ├─ moduleHues.ts        module -> hue resolution
  └─ ui/                  shared presentational primitives (Panel, StatCard, …)

src/modules/<module>/     A FEATURE — owns its data, state, logic, and UI
  ├─ types.ts             ← PUBLIC
  ├─ <X>Repository.ts     ← PUBLIC   all DB access for this module
  ├─ use<X>Store.ts         private   Zustand store, one per module
  ├─ <domain>.ts            private   pure logic (selectors, scoring, date math)
  └─ components/            private   this module's UI

src/lib/                  cross-cutting infrastructure, owned by nobody
  ├─ events.ts            the Event Bus (discriminated union)
  ├─ supabaseClient.ts    week.ts, money.ts, theme.ts, shortcuts.ts, …

supabase/migrations/      schema, sequential, never edited once applied
tests/ui/                 Playwright E2E + the shared auth/network fixtures
docs/handoff/             per-module contract handoffs for Codex
```

## The import rules

**A module's public surface is exactly two files: `types.ts` and
`*Repository.ts`.** Everything else it owns is private to it.

| From ↓ / To →                 | Another module's `types` / `*Repository` | Another module's store / components | `src/lib` | `src/components/ui` |
| ----------------------------- | ---------------------------------------- | ----------------------------------- | --------- | ------------------- |
| A module                      | ✅                                       | ❌ **lint error**                   | ✅        | ✅                  |
| The shell (`src/components/`) | ✅                                       | ✅                                  | ✅        | ✅                  |
| A route (`app/`)              | ✅                                       | ✅                                  | ✅        | ✅                  |
| `src/lib`                     | ❌ never                                 | ❌ never                            | ✅        | ❌                  |

Two consequences worth stating outright:

- **Cross-module _data_ goes through the other module's repository, never its
  store.** `useDashboardStore` and `useMomentumStore` are the worked examples —
  both read six other modules without importing a single sibling store.
- **Cross-module _behaviour_ goes through the Event Bus** (`src/lib/events.ts`),
  as a discriminated union. Never widen a payload to `unknown`; add a member.

`src/lib` importing a module would invert the whole dependency graph — the
shell and the infrastructure sit _below_ features, not beside them.

### Shell → module is allowed, and that matters

`AppShell` mounts `useMomentumStore` and renders `StreakIndicator` on every
page. That is a **layer** boundary (shell above features), not a **peer** one,
so it's permitted.

This is why `src/components/momentumState.ts` exists. Dashboard and Roadmap
both need the streak and the activity grid. Reading `useMomentumStore` from
those pages looked like module→module coupling, but it wasn't — they were
reading state the shell already owns and mounts. Routing them through
`MomentumRepository` "to obey the rule" would have been strictly worse: a
second fetch of data already in memory, no longer reacting to unlocks. So the
shell exposes it (`useStreak()`, `useActivityGrid()`), and the rule stays
absolute for genuine peers.

**The general lesson:** when a boundary rule seems to force a worse design, the
layer assignment is usually wrong — not the rule.

## What enforces this

| Rule                                    | Enforced by                                         | Fails where                      |
| --------------------------------------- | --------------------------------------------------- | -------------------------------- |
| No cross-module store/component imports | `eslint.config.mjs` → `moduleBoundaries`            | `npm run lint`, pre-commit, CI   |
| Types compile                           | `npm run typecheck`                                 | pre-push, CI                     |
| Behaviour                               | `npm test` (Vitest), `npm run test:ui` (Playwright) | pre-push, CI                     |
| The app actually builds                 | `npm run build`, run by `test:ui`'s webServer       | pre-push, CI                     |
| Schema / RLS / `ON CONFLICT`            | `npm run test:db` against real Supabase             | `.github/workflows/db-tests.yml` |
| Formatting                              | Prettier                                            | pre-commit (`lint-staged`), CI   |

`moduleBoundaries` reads `src/modules/` **from disk**, so a new module is
governed the moment its directory exists — a hardcoded list would have exempted
exactly the newest, least-reviewed code.

Local hooks (`.husky/`) are a fast first pass, not the gate: `--no-verify`
skips them and they don't run on another machine at all. **CI is the gate.**

**E2E runs against a production build, not `next dev`** (see
`playwright.config.ts`). `next dev` compiles each route on first hit, which
with 17 routes and four parallel workers made whichever spec hit a route first
pay the compile — it surfaced as flakiness in `finance.spec.ts` and
`reader.spec.ts`, failing at a different assertion each run while passing in
isolation. Building first removes the variable, costs nothing net (~16s build
against the compile time it replaces), and means the suite tests what ships:
the Reader's `DOMMatrix` server-render crash existed only in a production
render path and a dev-mode suite could not have caught it.

## Adding a new module

1. **Migration** — `supabase/migrations/NNNN_<name>.sql`. Every table gets
   `deleted_at`, a `set_updated_at` trigger, and an authenticated RLS policy.
   Soft deletes only.
2. **`types.ts`** — the domain types.
3. **`<X>Repository.ts`** — all DB access. Nothing else may touch Supabase.
4. **`use<X>Store.ts`** — one store, optimistic-set-then-rollback, and a
   `toUserMessage` that `console.error`s the real error and returns a generic
   string. Never surface a Postgres message in the UI.
5. **Event Bus** — add members to `AppEvent` if other modules must react.
6. **UI** — `components/`, then `app/<route>/page.tsx`.
7. **Nav** — add to `appNav.ts` **and** classify it in `miniApps.ts` (mini-app
   member or core tool). `miniApps.test.ts` fails if you add one without the
   other. Add both in the same commit as the route, or the nav link 404s.

Contract-first (CLAUDE.md): steps 1–5 are Claude's and land as one standalone
commit with stubs that throw `not implemented`; step 6–7 are Codex's, built
against that published surface. `docs/handoff/reader.md` is the current
worked example.

## Why not a monorepo

Considered and declined 2026-08-11. Workspaces buy independent versioning and
deployment; MyHub has one deployable, one database, one user, and global
migrations that can't be owned per package. The cost is real —
`transpilePackages`, build orchestration, a manifest per module — and the
benefit sought (enforced boundaries) is delivered by `moduleBoundaries` for a
fraction of it.

Revisit if a **second deployable** appears — a mobile client or a public site
sharing domain types. That, not module count, is the signal.
