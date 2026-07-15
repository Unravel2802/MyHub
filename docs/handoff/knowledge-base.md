# Handoff — Knowledge Base (Claude Code → Codex)

Contract published (migration `0016_knowledge_base.sql`, `NoteRepository.ts`,
`useNoteStore.ts`, `moduleHues.ts`/`appNav.ts` wiring). This is fully-implemented
repository + store code, not a throw-stub — the CRUD/optimistic-rollback shape is
identical to every other module's store, so stubbing it would have saved near-zero
effort while leaving a mount-time crash risk if the page below gets wired in before
this doc is read. What's actually left is UI.

## What's published

- `src/modules/knowledgeBase/types.ts` — `Note`, `NoteLink` (the latter is
  "the other note" from whichever side you're looking from — a link row doesn't
  surface which end was `source`/`target`, only the two connected note ids).
- `src/modules/knowledgeBase/NoteRepository.ts` — `getNotes`, `createNote`,
  `updateNote`, `deleteNote` (soft), `getLinksForNote(noteId)`,
  `createLink(sourceNoteId, targetNoteId)`, `deleteLink(id)`. `createLink` throws a
  typed `SelfLinkError` if you pass the same id twice — the DB also rejects this via
  a CHECK constraint, but the repository catches it first so the store can show a
  specific message.
- `src/modules/knowledgeBase/useNoteStore.ts` — `notes`, `links` (keyed by
  `noteId`), the usual `isLoading`/`error`/`isCreating`/`pendingIds`, and all six
  CRUD/link actions with optimistic update + rollback already wired.
- Nav: `/notes` → "Knowledge Base" is in `appNav.ts`. Hue: `"fuchsia"` is a new
  `HueName` — propagated into `globals.css` and every existing
  `Record<HueName, ...>` map already, so `hueFor("/notes")` just works.

## What's yours

1. **The `/notes` page** (`app/notes/page.tsx` + `src/modules/knowledgeBase/components/KnowledgeBasePage.tsx`). Reuse
   `PageHeader` (see `PrepTracker.tsx`/`AchievementsPage.tsx` for the
   `bleed`/actions/description pattern) and whatever form pattern fits — a note
   is just a title + markdown body, closer to `WeeklyReview.tsx`'s reflection
   form than anything with enums/selects.
2. **A link-picker UI** on a note's detail view: list its current links
   (`fetchLinksForNote`), a way to search/pick another note and call
   `createLink`, and a way to `deleteLink`. `createLink` can reject with a
   `SelfLinkError` — the store already turns that into `"A note can't link to
itself."` in `error`, so the UI just needs to disable picking the note
   you're currently viewing (belt-and-suspenders on the UI side, not required
   for correctness).
3. **Playwright E2E coverage for the bidirectional link behavior** — create
   two notes, link them from one direction, confirm both notes list each other,
   delete the link, confirm it's gone from both sides. CLAUDE.md calls out
   bi-directional links specifically as needing E2E coverage, not just the unit
   tests already in `NoteRepository.test.ts`.
4. **Eyeball the `fuchsia` hue against `violet` (Roadmap) in the nav rail
   before merging.** I verified `fuchsia` clears WCAG AA contrast against the
   surface tokens (it's in `palette.test.ts`'s gate now), but contrast math
   doesn't cover hue-_distinguishability_ — fuchsia and violet sit close enough
   on the color wheel that they may be hard to tell apart for red-green color
   vision deficiency, and the nav rail's hue dots are small enough that hue is
   the only signal. Not a blocker, just look at the two dots side by side
   before merging and flag it if it reads as a problem.

## What's intentionally not here

**No Event Bus event for notes** (no `note.created`/`note.linked`). Checked
`streaks.ts`/`achievementCatalog.ts`: neither is driven by a generic "activity
happened" concept — `ActivitySnapshot` is a hardcoded 4-field struct (`tasks`,
`prepEntries`, `applications`, `outreachEntries`) with no roadmap-traceable number
for knowledge-base activity. Wiring an event here now would be adding a hook
nothing consumes. If a future roadmap revision gives knowledge-base activity a
real number to track, that's a new contract change, not something to route around
here.
