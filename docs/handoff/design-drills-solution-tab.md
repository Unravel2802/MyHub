# Handoff — Design Drills: Solution tab + more questions (Claude Code → Codex)

Published contract for the Design Drills follow-up. Claude has landed the
migrations, the seeded content, and the data-contract change. **Codex owns the
UI and the tests.** Neither side touches the other's files.

Everything below is decided. If it's wrong or missing, **flag it — do not patch
around a stale contract.**

## What's already landed (Claude, this branch)

| File                                                   | State                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/migrations/0025_design_drill_solutions.sql`  | Done — adds `solution text not null default ''` + backfills all 12 original drills. Apply in the Supabase SQL editor before testing. |
| `supabase/migrations/0026_design_drills_expansion.sql` | Done — 13 new drills (9 system design, 4 ML), each with `prompt`/`rubric`/`solution`/`tags`.                                         |
| `src/modules/designDrills/types.ts`                    | Done — `solution: string` added to `DesignDrill`.                                                                                    |
| `src/modules/designDrills/DesignDrillsRepository.ts`   | Done — `solution` in `DesignDrillRow` + mapped in `drillFromRow`. `getDrills` already `select("*")`, so it flows through.            |
| `src/modules/designDrills/useDesignDrillsStore.ts`     | **No change needed** — drills pass through unchanged.                                                                                |

Verified: typecheck, lint, `npm test` (369) green; full migration chain
`0001→0026` applied against a throwaway Postgres — 25 drills, all with
non-empty solutions, both new migrations idempotent.

## The contract you build against

`DesignDrill.solution: string` — the full worked answer, plain text authored for
`whitespace-pre-wrap` (same as `prompt`). Empty string = "not written yet".

## Product rules (decided with the user — do not re-litigate)

1. **The solution is ALWAYS viewable** — a LeetCode-style reference tab, NOT
   gated behind finishing the attempt. This is a deliberate reversal of the
   module's original "don't show it alongside the prompt" note. The user made
   this call.
2. **The rubric self-grade stays reveal-on-submit** — unchanged. Only the
   _solution_ is un-gated.
3. **Render with `whitespace-pre-wrap`, like `prompt`.** There is **no markdown
   renderer** in the app and **no markdown lib on the approved-deps list**
   (`CLAUDE.md`). Do **not** add one. Solutions are authored to read cleanly as
   plain text.
4. **No `Tabs` primitive exists** in `src/components/ui/`. Build a small inline
   accessible tab control (`role="tablist"`/`"tab"`/`"tabpanel"`,
   `aria-selected`, arrow-key nav). Do not add shadcn/radix Tabs.
5. Because the solution is always available, a drill must be readable **without
   starting a timed attempt** — a read-only detail view is part of this feature.

## Your work

### Components

- **`DrillBrief.tsx`** (new, shared): the left-panel `[ Prompt | Solution ]`
  tab control; each pane rendered `whitespace-pre-wrap`. The one home for the
  tab logic — reused by both the detail and the workspace.
- **`DrillDetail.tsx`** (new, read-only): `DrillBrief` + the "Your past attempts"
  list + a primary **"Start timed attempt"** button. No timer, no scratchpad.
- **`DrillWorkspace.tsx`** (edit): replace the plain prompt block (currently
  `<div className="…whitespace-pre-wrap…">{drill.prompt}</div>` on the left
  panel) with `DrillBrief`. Timer / scratchpad / autosave / submit→rubric
  self-grade / Finish all stay exactly as they are.
- **`DrillList.tsx`** (edit): make the card title a button that opens the
  read-only detail (`onOpen(drillId)`); keep the existing "Start drill" button
  for a direct timed start.
- **`DesignDrillsPage.tsx`** (edit): add `previewDrillId` state and a third
  render branch — **list / detail / workspace** — wiring `onOpen`, "Start timed
  attempt" (reuse the existing `handleStart`), and back navigation. The page
  already toggles list↔workspace on `activeAttemptId`; add the preview state
  alongside it.

### Tests

- **`tests/ui/supabaseDesignDrillsMock.ts`** (new): mirror
  `tests/ui/supabasePrepMock.ts` — route `design_drills` + `design_drill_attempts`,
  support `failNext` for the rollback test. `design_drills` rows need the new
  `solution` field.
- **`tests/ui/design-drills.spec.ts`** (new): list renders seeded drills; open
  detail → **Solution tab shows the solution text**; start a timed attempt →
  timer runs, Prompt/Solution tabs switch, "Submit & self-grade" reveals the
  rubric checklist, "Finish attempt" PATCHes with `completed_at` + `self_rating`;
  a failed-create rollback (via `failNext`).
- **`src/modules/designDrills/DesignDrillsRepository.test.ts`** (edit): add
  `solution` to the fake `drillRow` and assert `drillFromRow` maps it.
- **`tests/ui/responsive.spec.ts`** (edit): add `/design-drills` to the `PAGES`
  array — the module shipped missing from this overflow test.

## Gotchas

- The workspace timer ticks off `attempt.startedAt` real elapsed time; the
  read-only detail has no attempt, so no timer there.
- `getDrills` orders by (category, difficulty, title). Difficulty is an enum, so
  it sorts alphabetically (advanced < core < warmup), not by ramp — leave as-is
  unless the user asks; it predates this change.
- Keep the module's error convention: generic message to the user, real error to
  `console.error` (already in the store's `toUserMessage`).
