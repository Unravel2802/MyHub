# Handoff — LeetCode Tracker (Claude → Codex)

A Notion-style tracker for the history of LeetCode problems, surfaced from the
Prep Tracker page. Contract-first: Claude published the schema, types,
repository, event type, and store shape below — **Codex owns the store action
bodies, the UI (table + status board views), routing/nav, and the tests for
all of it.** Don't change the published interfaces — flag it if one is wrong
or missing something the UI needs.

## Why a new module, not new `prep_entries` columns

Prep Tracker's `algorithm` entry type already logs algorithm reps, but as
loose, unlinked rows — free-text `topic`, no way to tie two attempts at "Two
Sum" together into one revisitable record. That's the same "problem bank vs.
rep log" split Design Drills already drew for system-design practice
(`supabase/migrations/0024_design_drills.sql`'s header, `myhub_plan.md` §2.3:
"don't conflate a problem bank with a rep log"). This is the LeetCode
analogue, structured the same way: a **problem** is the reusable record, an
**attempt** is one sitting against it.

## Published contract (already landed by Claude)

- **Migration**: `supabase/migrations/0033_leetcode_tracker.sql` —
  `leetcode_problems` (title, url, difficulty, tags, status) and
  `leetcode_attempts` (problem_id, date, time_to_solve_min, outcome, notes,
  solution_code, solution_language). Soft deletes only. RLS matches every
  other table (authenticated-only).
- **Types**: `src/modules/leetcode/types.ts` — `LeetCodeProblem`,
  `LeetCodeAttempt`, `LeetCodeDifficulty`, `LeetCodeStatus`,
  `LeetCodeOutcome`. Note `LeetCodeStatus` (the board column, set manually on
  the problem) is distinct from `LeetCodeOutcome` (the per-attempt result) —
  don't collapse them.
- **Repository**: `src/modules/leetcode/LeetCodeRepository.ts` — fully
  implemented and tested (`LeetCodeRepository.test.ts`, 8 tests). CRUD for
  both problems and attempts, mirroring `PrepRepository.ts`'s shape exactly.
- **Domain logic**: `src/modules/leetcode/leetcodeBoard.ts` — pure, tested
  (`leetcodeBoard.test.ts`, 5 tests): `groupByStatus` (board columns, always
  includes every `LeetCodeStatus` key even when empty), `attemptsForProblem`,
  `attemptStats` (count + most recent attempt for the table view's "Attempts"
  / "Last attempt" columns). Don't duplicate this logic in the store or a
  component — call these.
- **Event**: `src/lib/events.ts` — `leetcode.attempt_logged` (`attemptId`,
  `problemId`, `outcome`). Fired once per logged attempt; nothing else should
  learn about a LeetCode attempt except through this event.
- **Store shape**: `src/modules/leetcode/useLeetCodeStore.ts` — interface
  published, derived selectors implemented, **async action bodies are
  stubs that throw** (`Not implemented — see useLeetCodeStore.ts contract.`).

## What Codex builds

1. **Store action bodies** in `useLeetCodeStore.ts`. Mirror
   `usePrepStore.ts`'s `createEntry`/`updateEntry`/`deleteEntry` pattern
   exactly: optimistic update, roll back and set `error` via a
   `toUserMessage()` helper (add the identical `FAILURE_MESSAGE` +
   `toUserMessage` pair — commented-out at the top of the file, ready to
   uncomment) on failure, track in-flight ids in `pendingIds`. `createAttempt`
   must emit `leetcode.attempt_logged` on success, same spot in the flow as
   `usePrepStore.createEntry` emits `prep.logged`.
2. **Table view** (the primary Notion-style surface): sortable/filterable by
   difficulty, tags, status; inline-editable cells where reasonable (status,
   tags at minimum). Columns should include the derived "Attempts" / "Last
   attempt" from `attemptStats`.
3. **Status board view**: columns from `leetcodeBoard.ts`'s
   `LEETCODE_STATUSES` (fixed order: to_review → in_progress → solved →
   needs_revisit), drag-and-drop via the already-approved `@dnd-kit/*` (same
   library as the Task Kanban board — don't add a second DnD dependency).
   Dropping a card calls `updateProblem(id, { status })`.
4. **Problem detail / attempt history**: clicking a problem shows its full
   attempt timeline (`attemptsForProblem`) with notes and solution code.
   Render `solutionCode` via the existing highlight.js code-pad pattern from
   Design Drills' scratchpad (`dangerouslySetInnerHTML` on highlight.js'
   own output only — this is "the user's own scratchpad text" case
   CLAUDE.md's dependency list carves out; never route it through
   `Markdown.tsx`, which stays DB-markdown-only).
5. **Forms**: create/edit problem (title, url, difficulty, tags), log an
   attempt (date, time-to-solve, outcome, notes, optional solution code +
   language). `react-hook-form` or plain controlled state, per the approved
   list.
6. **Routing/nav**: surface this from the Prep Tracker page (`app/prep`) —
   e.g. a tab or sub-section, your call on the exact layout. Add a nav entry
   if you introduce a distinct route; if it's a tab within the existing page,
   no nav change is needed.
7. **Tests**: store tests (mirror `usePrepStore.test.ts` — optimistic
   update/rollback, event emission, pendingIds), component tests, and an E2E
   test exercising log-an-attempt → status changes → attempt shows in history
   (CLAUDE.md's rule 4: anything touching optimistic-rollback gets an E2E
   test, not just unit coverage).

## Not in scope here

No spaced-repetition / "next review date" scheduling — the `needs_revisit`
status is the only signal for "come back to this," manually set by the user.
If that's wanted later, it's a new column + a small piece of domain logic,
flag it rather than bolting it onto `status`.
