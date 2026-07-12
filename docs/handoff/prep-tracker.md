# Handoff — Prep Tracker (Claude Code → Codex)

Published contract. Build order puts this second, and it has the **earliest real deadline of the
four MVP modules** — the roadmap's diagnostics start in July (§6.1) and it's July now.

Everything below is decided. If it's wrong or missing, **flag it — do not patch around it**.

## What's already landed

| File                                        | State                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/migrations/0003_prep_tracker.sql` | Done — apply in the Supabase SQL editor before testing         |
| `src/modules/prep/types.ts`                 | Done — `PrepEntry`, `BehavioralStory`, outcome unions           |
| `src/modules/prep/prepScorecard.ts`         | Done — pure aggregation, no DB, includes `cumulativeCountsByType` |
| `src/modules/prep/prepScorecard.test.ts`    | Done — 16 unit tests, all passing                               |
| `src/modules/prep/prepTargets.ts`           | Done (2026-07-13) — roadmap checkpoint targets, see below       |
| `src/modules/prep/prepTargets.test.ts`      | Done — 6 unit tests, all passing                                 |
| `src/lib/events.ts`                         | Done — `prep.logged` added to the union                         |
| `src/modules/prep/PrepRepository.ts`        | **Done — implemented and merged**                                |
| `src/modules/prep/usePrepStore.ts`          | **Done — implemented and merged**                                |

## New (2026-07-13): checkpoint-progress UI

The repository and store are done. What's new is `prepTargets.ts` — now that
`engineering_first_roadmap_v2.md` is in the repo, the "deliberately not built: targets" section
below is out of date for two checkpoints specifically. Read the new section further down before
starting this piece.

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

## Targets — partially unblocked (2026-07-13)

`engineering_first_roadmap_v2.md` is now in the repo. `prepTargets.ts` encodes exactly two
checkpoints with unambiguous, schema-mappable numbers — a December 2026 "semester review" and a
February 2027 target set — as cumulative (since-July) counts by `entry_type`, not monthly totals.
Read the doc comment at the top of `prepTargets.ts`: it also explains two things from the roadmap
that were deliberately **not** encoded (interview-prep time-allocation percentages, and per-month
mock-interview subtypes) because they don't map cleanly onto the current schema — don't try to
force those in without flagging it first.

### Your work: checkpoint-progress display

- `prepTargets.activeCheckpoint(todayString)` picks the relevant checkpoint (December until it
  passes, then February).
- `prepTargets.progressTowardCheckpoint(entries, checkpoint)` returns `{ algorithm, systemDesign,
  mlSystemDesign, mockInterview }`, each an `{ actual, target, progress }` — `entries` is just
  `usePrepStore().entries`, already in state, no new store action needed.
- **`progress` is uncapped** — it can exceed `1` once a target is beaten. Render that as "beat the
  target" (e.g. "160/150 — target met"), not as a progress bar stuck at 100%; the whole point of
  not capping it is so the UI can tell "just met" from "well past."
- Behavioral story count target (`FEBRUARY_2027_BEHAVIORAL_STORY_TARGET`, currently `8`) compares
  against `BehavioralStories` row count from `usePrepStore().stories`, **not** against
  `PrepEntries` — a written story and an `entry_type: "behavioral"` practice-session log are
  different things. Don't conflate them.
- This is a small addition to the existing scorecard UI, not a new page — put it near the
  existing scorecard-progress components.

## Two API notes

- `solveRate` is `null`, not `0`, when nothing has been judged yet. "No data" and "0% solve rate"
  must not render the same way — one is a blank slate, the other is a five-alarm fire.
- `weakestTopics` ignores unjudged entries on purpose. An untouched topic isn't weak, it's
  unmeasured; ranking it at 0% would send you to study the thing you have no evidence about.
