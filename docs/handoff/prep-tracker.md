# Handoff — Prep Tracker (Claude Code → Codex)

Published contract. Build order puts this second, and it has the **earliest real deadline of the
four MVP modules** — the roadmap's diagnostics start in July (§6.1) and it's July now.

Everything below is decided. If it's wrong or missing, **flag it — do not patch around it**.

## What's already landed

| File                                        | State                                                  |
| ------------------------------------------- | ------------------------------------------------------ |
| `supabase/migrations/0003_prep_tracker.sql` | Done — apply in the Supabase SQL editor before testing |
| `src/modules/prep/types.ts`                 | Done — `PrepEntry`, `BehavioralStory`, outcome unions  |
| `src/modules/prep/prepScorecard.ts`         | Done — pure aggregation, no DB                         |
| `src/modules/prep/prepScorecard.test.ts`    | Done — 12 unit tests, all passing                      |
| `src/lib/events.ts`                         | Done — `prep.logged` added to the union                |
| `src/modules/prep/PrepRepository.ts`        | **Stubs — yours**                                      |
| `src/modules/prep/usePrepStore.ts`          | **Stubs — yours**                                      |

## Your work

### 1. `PrepRepository.ts` — every function throws `not implemented`

Plain CRUD over `prep_entries` and `behavioral_stories`. Soft deletes only (`deleted_at`), never
a SQL `DELETE`. No cascades, no nesting, no self-joins — this is the simplest schema of the four.

Two DB constraints will reject bad writes rather than silently accepting them, so surface their
errors rather than working around them:

- `outcome` must match `entry_type`: algorithm entries are `solved`/`partial`/`failed`; every
  other type is `pass`/`needs_work`. Always nullable — you can log a rep before judging it.
- `time_to_solve_min` is **algorithm-only**. It's what the roadmap's average-time diagnostic reads,
  and letting other types set it would poison that average.

### 2. `usePrepStore.ts` — every action throws `not implemented`

Same shape as `useTaskStore`: optimistic insert, roll back and set `error` on failure. Two things:

- **`createEntry` must emit `prep.logged`** on success (`{ entryId, prepType }`). That's the whole
  reason the Dashboard can show running totals without importing this module's internals — if you
  skip the emit, the Dashboard silently goes stale.
- **`scorecard(month)` and `weakestTopics()` are derived, not stored.** Delegate to
  `prepScorecard.ts`; don't cache totals in state and don't recompute the maths yourself.

### 3. UI (yours)

- Entry-logging form, varying by `entry_type` — `time_to_solve_min` only shows for `algorithm`, and
  the outcome options change with the type (see the constraint above). Getting this wrong means the
  DB rejects the insert.
- Behavioral-story editor: concise and extended versions of each story, grouped by theme.
- Scorecard-progress components reading `scorecard(month)` and `weakestTopics()`.

### 4. Tests

Unit tests for the repository/store wiring. **Don't re-test the scorecard maths** — it's covered.

## Deliberately not built: targets

`scorecardFor` computes the _actual_ numbers only. The monthly targets to compare them against
live in `engineering_first_roadmap_v2.md` (§15), which **is not in this repo**. Render actuals now;
the target comparison is a Dashboard concern once that file exists. Do not invent target numbers.

## Two API notes

- `solveRate` is `null`, not `0`, when nothing has been judged yet. "No data" and "0% solve rate"
  must not render the same way — one is a blank slate, the other is a five-alarm fire.
- `weakestTopics` ignores unjudged entries on purpose. An untouched topic isn't weak, it's
  unmeasured; ranking it at 0% would send you to study the thing you have no evidence about.
