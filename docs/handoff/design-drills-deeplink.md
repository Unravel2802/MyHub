# Handoff — Design Drills Phase 2: deep-link drill pages (Claude → Codex)

Make each drill addressable at **`/design-drills/[slug]`** so a drill can be
bookmarked, shared, and linked from the outline. Contract-first: Claude published
the one data hook you need; **Codex owns the routes, the view refactor, and the
tests.** Don't change the store interface — flag it if it's wrong.

## Published contract (already landed by Claude)

`useDesignDrillsStore` gained a selector:

```ts
// Resolves a drill from its URL slug. undefined while drills are still loading
// or when the slug matches nothing.
drillBySlug: (slug: string) => DesignDrill | undefined;
```

Slugs already exist on every drill (`DesignDrill.slug`, unique). No migration, no
repo change — the store loads all drills via `fetchDrills()` and you select by
slug client-side, consistent with the app's client-store pattern (everything is
behind `AuthGate`; there is no server-side Supabase fetch to add).

## What Codex builds

1. **`app/design-drills/[slug]/page.tsx`** — a thin wrapper that renders the
   Design Drills client surface focused on `params.slug` (mirror the existing
   `app/design-drills/page.tsx` server-wrapper style). On load, ensure
   `fetchDrills()` has run, then `drillBySlug(slug)`:
   - found → render the drill **detail** (`DrillDetail`) for it, with "Start timed
     attempt" working as today;
   - not found _after_ drills have loaded → a not-found state (or `notFound()`).
     Remember `undefined` also means "still loading" — don't flash not-found
     before `fetchDrills()` resolves.
2. **Refactor navigation in `DesignDrillsPage` / `DrillList`** — opening a drill
   should navigate to `/design-drills/[slug]` (via `next/link` or `router.push`)
   instead of the current in-page `previewDrillId` state. Decide whether the
   timed workspace stays in-page state or also gets a URL; keep it simple and
   don't regress the existing attempt flow.
3. **Section deep-links** — `SolutionEditorial` already emits `#${section.id}`
   anchors with `scroll-mt-6`; make sure they resolve on the `[slug]` page.
4. **Tests** — E2E: navigating to `/design-drills/<known-slug>` renders that
   drill's detail; an unknown slug renders the not-found state; add
   `/design-drills/<slug>` to `tests/ui/responsive.spec.ts` if it's a distinct
   scrollable page.

## Constraints

- Keep the client-store pattern (no server-side Supabase in the route).
- Don't duplicate drill-loading logic — go through the store.
- Preserve the always-viewable solution and reveal-on-submit rubric behavior.
