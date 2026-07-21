# Handoff — Design Drills Phase 3: bookmarks + search + filters (Claude → Codex)

Let the user **star drills**, **search** the bank, and **filter** it. Claude owns
the bookmark persistence (migration + repo + store optimistic toggle, all landed
and unit-tested); **Codex owns the star UI, the search box, the filter controls,
the mock, and the tests.** Search and filtering are pure client-side work over
the already-loaded `drills` — no new repo/store surface for them.

## Published contract (already landed by Claude)

**Migration `0029_design_drill_bookmarks.sql`** — a `design_drill_bookmarks`
table (own table, not a column on `design_drills`), soft-deletable, with a
partial unique index keeping one _active_ bookmark per drill. Apply it on the dev
Supabase stack.

**Repository:**

```ts
listBookmarkedDrillIds(): Promise<string[]>
addBookmark(drillId: string): Promise<void>     // plain insert; store guards double-add
removeBookmark(drillId: string): Promise<void>  // soft-deletes the active row
```

**Store (`useDesignDrillsStore`):**

```ts
bookmarkedDrillIds: string[];
fetchBookmarks: () => Promise<void>;
toggleBookmark: (drillId: string) => Promise<void>; // optimistic + rollback; tracks pendingIds
isBookmarked: (drillId: string) => boolean;
```

Optimistic flip + rollback and `pendingIds` tracking are done and covered in
`useDesignDrillsStore.test.ts`. Don't reimplement them — just call `toggleBookmark`
and read `isBookmarked` / `bookmarkedDrillIds`.

## What Codex builds

1. **Star toggle** on each drill (in `DrillList` cards and `DrillDetail`): a
   `lucide-react` star/bookmark icon button wired to `toggleBookmark(drill.id)`,
   filled when `isBookmarked(drill.id)`, disabled while
   `pendingIds.includes(drill.id)`. Call `fetchBookmarks()` on mount in
   `DesignDrillsPage` alongside `fetchDrills()`/`fetchAttempts()`.
2. **Search** — a text input filtering the loaded `drills` client-side by title /
   prompt / tags (case-insensitive). No repo/store change.
3. **Filters** — `DrillList` already has category + difficulty selects; add a
   **"Bookmarked only"** toggle (uses `isBookmarked`) and tag/topic filter chips.
   Keep it all client-side over `drills`.
4. **Mock** — extend `tests/ui/supabaseDesignDrillsMock.ts` to handle
   `design_drill_bookmarks`: GET (list active), POST (insert), PATCH (soft-delete).
   Mirror the existing attempt handlers.
5. **Tests** — E2E: starring a drill persists (assert the mock's bookmark rows and
   the filled state after reload); "Bookmarked only" narrows the list; search
   narrows and clears. Unit tests for any non-trivial filter helper.

## Constraints

- Bookmark writes go **only** through the store (optimistic path); never query
  Supabase from a component (repository pattern).
- Search/filter is client-side over `drills` — do not add a repo/store method or a
  DB query for it.
- Soft-deletes only; store errors already log the real error + show the generic
  message. Icons from `lucide-react` only.
