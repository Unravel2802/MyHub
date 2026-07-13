# Handoff — Task completion timestamps, E2E coverage (Claude Code → Codex)

Published contract. Wave 2, Phase 2 (`myhub_plan.md` Part B) — the Momentum foundation. The
migration, repository, and store changes are done; this is the remaining Playwright-mock and
E2E slice.

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0007_task_completed_at.sql` | Done — adds `tasks.completed_at`, backfills done tasks from `updated_at`, indexes it |
| `src/modules/task/types.ts` | Done — `Task.completedAt: string \| null` |
| `src/modules/task/TaskRepository.ts` | Done — `fromRow` maps it; `updateTaskStatus`/`moveTask` set `completed_at` to now/`null` whenever status changes; `completeDescendants` stamps it (guarded by `.neq("status", "done")` so an already-done descendant keeps its original timestamp); `autoCompleteAncestors` stamps; `revertAncestorsToIncomplete` nulls |
| `src/modules/task/useTaskStore.ts` | Done — the optimistic mirrors (`completeDoneAncestors`, `revertDoneAncestors`, `completeTaskDescendants`) set/clear `completedAt` locally to match |
| `src/modules/task/TaskRepository.test.ts`, `useTaskStore.test.ts` | Done — cases for stamp-on-complete, clear-on-revert, and already-done descendants keeping their original timestamp |

Everything else in this phase is yours.

## Your work

### 1. `tests/ui/supabaseTasksMock.ts`

- Add `completed_at: string | null;` to the `TaskRow` type (`tests/ui/supabaseTasksMock.ts:8-23`).
- Add `completed_at: null` to `row()`'s defaults (`tests/ui/supabaseTasksMock.ts:33-47`), same
  pattern as `deleted_at`.
- No change needed to the PATCH handler (`tests/ui/supabaseTasksMock.ts:202-215`) — it already
  does `Object.assign(target, updates, ...)`, so whatever `completed_at` value the app sends
  through `TaskRepository` lands on the row unchanged.

### 2. New E2E case in `tests/ui/task-cascade.spec.ts`

Add one spec asserting the PATCH request bodies actually carry `completed_at`, not just
`status` — the existing cascade specs in that file only assert on rendered DOM state, so this
is the one thing not yet covered end-to-end. Pattern to follow: intercept the `PATCH
**/rest/v1/tasks*` request (`page.route` or `page.waitForRequest`, whichever the file already
uses elsewhere) when completing a task, and assert:

- Completing a task sends `completed_at` as a non-null ISO timestamp string in the same PATCH
  that sets `status: "done"`.
- Reverting a task out of done (e.g. dragging it back to `todo`) sends `completed_at: null` in
  the same PATCH that sets the reverted `status`.

Use the existing `FakeTaskDb`/`mockSupabaseTasks` fixtures already imported by
`task-cascade.spec.ts` — no new fixture plumbing needed.

## Tests

The existing 30 Playwright specs and 139 unit tests are the regression gate — must pass
unmodified alongside your new spec. Run `npm run lint`, `npm run typecheck`, `npm run test:ui`
(or the vitest/playwright scripts directly) before treating this done.

## Not yours

- Momentum's streak-query logic (reading `completed_at` to compute "was anything completed
  today") — that's Phase 5, later, and depends on this column but isn't part of this handoff.
