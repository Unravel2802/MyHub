# Reader — contract handoff

**Status:** contract published (migration, types, repository/store signatures,
annotation geometry + tests). UI is Codex's.

A PDF reader with select-to-highlight annotation. Requested 2026-08-11; **not
in `myhub_plan.md`** — it's an addition outside Wave 2's eight phases, approved
directly by the Lead Architect. Scope for v1 was chosen explicitly: **highlights
and comments, no freehand drawing.**

## What already exists (don't rewrite these)

| File                                            | What it is                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `supabase/migrations/0042_reader_documents.sql` | Both tables, the `reader-documents` Storage bucket, RLS on both plus `storage.objects` |
| `src/modules/reader/types.ts`                   | `ReaderDocument`, `Annotation`, `NormalizedRect`                                       |
| `src/modules/reader/annotationGeometry.ts`      | Selection → storable coordinates. **17 unit tests.**                                   |
| `src/modules/reader/ReaderRepository.ts`        | Signatures + typed errors; bodies are `not implemented`                                |
| `src/modules/reader/useReaderStore.ts`          | State/action shape + `toUserMessage`; actions are `not implemented`                    |
| `src/lib/events.ts`                             | `reader.document_added`, `reader.annotation_added`                                     |

## What's left

1. **Fill in `ReaderRepository.ts`** — mechanical Supabase round-trips against
   the published signatures. Follow `NoteRepository.ts` for the row↔domain
   mapping style (`fromRow`, snake_case columns, `.is("deleted_at", null)`).
   - Parse `rects` through `isNormalizedRectArray` rather than casting the
     jsonb. It's `jsonb` — Postgres guarantees "non-empty array" and nothing
     else, so a bad row otherwise renders as invisible NaN-positioned
     highlights that are impossible to debug from the UI.
2. **Fill in `useReaderStore.ts`** — optimistic-set-then-rollback, same shape
   as `useTaskStore`. Emit the two events on success.
3. **Build the UI** (`src/modules/reader/components/`, route `app/reader/page.tsx`):
   - Library list + upload (drag-drop or file input)
   - Viewer: PDF.js canvas + text layer, page nav, zoom
   - Select text → highlight in a chosen hue; optionally attach a comment
   - Per-document annotation sidebar; clicking one scrolls to it
4. **Add the nav entry** — `{ href: "/reader", label: "Reader", icon: BookOpen }`
   in `appNav.ts` **and** `"/reader"` in `CORE_TOOL_HREFS` (`miniApps.ts`).
   Deliberately left out of the contract commit: a nav item pointing at a route
   that doesn't exist yet is a 404 in the sidebar. Add both together with the
   page, in one commit — `miniApps.test.ts` fails if a nav entry is classified
   as neither a mini-app member nor a core tool, which is the intended gate.
   It lands in the orbit's Core Tools node automatically once classified.
5. **Hue** — all ten named hues are claimed, so `hueFor("/reader")` falls back
   through `miniAppFor` to `accent`. That's correct and needs no change; don't
   invent an eleventh hue for it.

## Things that will bite you

- **`workerSrc` must point at a file in `public/`, not a CDN.** PDF.js loads
  its worker at runtime; a CDN URL adds a third-party request on a page showing
  the user's private documents. Copy the worker from `pdfjs-dist/build/` in a
  build step or commit it.
- **Pixels must never reach the repository.** `Range.getClientRects()` is only
  valid at the zoom/scroll it was measured at. Convert with
  `toNormalizedRects(clientRects, pageElementRect)` at the point of selection —
  both rects must come from the _same frame_, or the scroll offsets won't
  cancel. Convert back with `toPixelRect` when rendering.
- **Upload before insert.** `createDocument` uploads the file, then writes the
  row. A row whose bytes never uploaded opens to nothing and needs manual
  cleanup; an orphaned object is invisible and reclaimable. Don't "tidy" this
  into a transaction-looking insert-first.
- **`storagePath` is generated (`crypto.randomUUID() + ".pdf"`), never the
  filename.** Two uploads of `paper.pdf` would collide on a unique column.
- **Deleting a document does not delete its bytes** (soft deletes only,
  architecture rule 4). Hard-deleting would make the surviving row unopenable.
- **Debounce `setLastPageRead`.** It fires on every page turn — by far the
  highest-frequency write in the module.
- **`updateAnnotation` intentionally can't change `rects` / `pageNumber` /
  `selectedText`.** Those identify a passage; changing them would re-point an
  annotation at text the user never selected. Re-anchoring = delete + recreate.

## Testing

`annotationGeometry.ts` is covered. For the UI, the E2E-worthy behaviour
(CLAUDE.md rule 4) is **the highlight round-trip**: create a highlight, reload,
and assert it renders at the same normalized position — that's the path where a
silent regression is invisible until a user's annotations are already wrong.
Upload and rendering can be mocked; don't put a real PDF fixture through
Supabase in CI.
