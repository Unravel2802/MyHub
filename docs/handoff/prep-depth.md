# Handoff — Prep depth: mock subtypes, resume deep-dive, time allocation (Claude Code → Codex)

Published contract. Wave 2, Phase 3 (`myhub_plan.md` Part B).

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0008_prep_subtypes.sql` | Done — `mock_subtype` enum + nullable `prep_entries.mock_subtype` (CHECKed to `mock_interview` rows only) + `resume_deep_dive` added to `prep_entry_type` |
| `src/modules/prep/types.ts` | Done — `MockSubtype`, `PrepEntryType` gains `resume_deep_dive`, `PrepEntry.mockSubtype: MockSubtype \| null` |
| `src/modules/prep/PrepRepository.ts` | Done — `mock_subtype` round-trips through `entryFromRow`/`entryWrite`/`CreatePrepEntryInput.mockSubtype`. This is the minimal mechanical mapping needed for the contract to compile — no UI-facing behavior yet |
| `src/modules/prep/usePrepStore.ts` | Done — optimistic-create literal and `applyEntryUpdates` both carry `mockSubtype` through, same pattern as every other field |
| `src/lib/events.ts` | Done — `PrepType` (the `prep.logged` event payload) gains `resume_deep_dive` |
| `src/modules/prep/prepScorecard.ts` | Done — `EMPTY_COUNTS` gains `resume_deep_dive: 0` |
| `src/modules/prep/prepTargets.ts` | Done — `CumulativeCheckpoint.bySubtype`, `DECEMBER_2026_CHECKPOINT.bySubtype = { coding: 6, system_design: 6, ml_system_design: 2 }`, new `mockSubtypeProgress(entries, checkpoint) → MockSubtypeProgress \| null` |
| `src/modules/prep/prepAllocation.ts` (new) | Done — `TARGET_ALLOCATION` (algorithm .35 / system_design .25 / behavioral .15 / ml_system_design .15 / resume_deep_dive .10) + `timeAllocation(entries, fromDate?)`, excluding `mock_interview` from both numerator and denominator |
| `src/modules/prep/components/PrepEntryList.tsx` | Touched minimally — added a `"Resume deep-dive"` label to the existing `labels` map so the file compiles against the widened `PrepEntryType`. **Not styled/reviewed beyond that** — restyle freely if it doesn't fit |
| Tests | `prepTargets.test.ts` (mockSubtypeProgress: split-by-subtype, legacy-NULL-counts-as-unclassified, null-when-no-bySubtype), `prepAllocation.test.ts` (new, full coverage), `prepScorecard.test.ts` fixed for the new enum member |

Full gate green: typecheck, lint, 146 unit tests, 30 E2E — zero regressions.

Everything else in this phase is yours.

## Your work

### 1. `PrepEntryForm` — subtype select + resume deep-dive option

- Add `"Resume deep-dive"` as a selectable entry type (it now exists in `PrepEntryType`).
- When `type === "mock_interview"`, show a subtype `<select>` (Coding / System design / ML
  system design) wired to `CreatePrepEntryInput.mockSubtype`. Leave it unset (`undefined`) by
  default — don't force a choice; a mock logged without picking a subtype is a legitimate,
  supported state (counts as "unclassified", not an error).
- For every other entry type, don't send `mockSubtype` at all.

### 2. `TimeAllocationPanel` (new component)

Renders `timeAllocation(entries)` from `prepAllocation.ts`: one row per area (label + `ProgressBar`
actual vs. target, using the `StatCard`/`ProgressBar` primitives from Phase 1's
`src/components/ui/`), plus a small note — something like "mock-interview time excluded (§11.3)"
— so it's clear why mock hours don't show up here. Render `—` for `actualPct === null` areas,
never `0%` (same null-vs-zero discipline as `FunnelPanel` elsewhere in the plan).

### 3. December checkpoint card — per-subtype breakdown

Wherever the December checkpoint currently renders combined mock progress (x/14), extend it to
show the per-subtype breakdown from `mockSubtypeProgress`: x/6 coding, x/6 system-design, x/2
ML-system-design, plus "n unclassified mocks" whenever `unclassified > 0`. `mockSubtypeProgress`
returns `null` for checkpoints without a `bySubtype` (only February currently) — guard for that.

### 4. Subtype `Badge` in `PrepEntryList`

Add a small `Badge` next to mock-interview entries showing their subtype (or "unclassified" when
`mockSubtype` is null) — using the `Badge` primitive from Phase 1. The label map I added in
`PrepEntryList.tsx` for `resume_deep_dive` is functional but unreviewed; feel free to adjust its
copy/placement.

### 5. Tests

Extend `tests/ui/supabasePrepMock.ts` with `mock_subtype` in its row shape/defaults (same pattern
as `deleted_at`). Extend `tests/ui/prep-tracker.spec.ts`: log a mock with a subtype selected, log
a resume deep-dive entry, and assert the allocation panel renders. Existing 30 E2E specs must
keep passing unmodified.

## Not yours

- Anything about mock rep-count targets outside December's `bySubtype` — February's checkpoint
  intentionally has no per-subtype breakdown (the roadmap doesn't restate it there); don't invent
  one.
- Momentum's `mocks_14` achievement (Phase 5) — it already knows to count legacy-NULL mocks
  toward the combined total; that's out of scope here.
