# Handoff — Daily Dashboard (Claude Code → Codex)

Published contract. Last of the four MVP modules. It has nothing to show until
Prep Tracker and Job Application CRM have real implementations behind them, so
if you're picking modules in build order, finish those first — but the contract
is ready whenever you get here.

## What's already landed

| File                                               | State                             |
| -------------------------------------------------- | --------------------------------- |
| `src/modules/dashboard/dashboardSelectors.ts`      | Done — pure aggregation, no DB    |
| `src/modules/dashboard/dashboardSelectors.test.ts` | Done — 15 unit tests, all passing |
| `src/modules/dashboard/useDashboardStore.ts`       | **Stub — yours**                  |

No migration, no repository — §2.3 is explicit that this module owns no table.

## The one architecture call this module needed

§2.3 says the Dashboard aggregates the other three modules' data but doesn't say
_how_ it's allowed to read it, and the architecture rules forbid importing
another module's internals. The assumption made here (documented in
`useDashboardStore.ts`'s doc comment, flag it to the Lead Architect if it looks
wrong): **this store may call the other modules' Repository functions directly**
(`TaskRepository.getTasks`/`getTemplates`, `PrepRepository.getEntries`,
`ApplicationRepository.getApplications`, `InterviewRepository.getInterviews`) —
because the Repository Pattern rule already makes each Repository the sanctioned
data-access boundary for its module, not something private to it. What's still
off limits: importing another module's **Zustand store**, its components, or any
non-exported helper. Only the Repository read path is shared across modules.

## Your work

### `fetchAll()` — currently throws `not implemented`

1. Call the four repository functions listed above (in parallel — `Promise.all`,
   nothing here depends on anything else finishing first).
2. Run each result through `dashboardSelectors.ts`:
   - `thisWeeksScheduleBlocks(tasks, new Date())` → `scheduleBlocks`
   - `applicationsNeedingFollowUp(applications, todayString)` → `followUps`
     (today as `yyyy-MM-dd`, matching the DB's date columns)
   - `interviewsNeedingPostMortem(interviews, new Date())` → `postMortemReminders`
   - `findGateChecklistTask(tasks, new Date())` then, if found,
     `gateChecklistProgress(tasks, gateTask)` → `gateChecklist` (else `null` —
     the UI should render "no gate checklist found for this month" rather than
     crash, since nothing enforces that one exists)
   - `scorecardFor(prepEntries, currentMonth)` and `weakestTopics(prepEntries)`
     from `@/src/modules/prep/prepScorecard` → `prepScorecard` / `weakestTopics`
3. Standard `isLoading`/`error` handling, same shape as the other stores.

### `subscribeToUpdates()` — currently throws `not implemented`

Subscribe via `on()` from `src/lib/events.ts` to `task.completed`,
`application.stage_changed`, `interview.completed`, and `prep.logged`. On any of
them, call `fetchAll()` again. Return the unsubscribe function `on()` gives you.
Deliberately coarse — refetch everything rather than patching one field, since
these are cheap reads and a full refetch can't drift the way incremental
patching over four separate data sources could.

### UI (yours)

Four panels reading straight from the store fields — this week's schedule
blocks, the follow-up list, the post-mortem reminder list, and the gate
checklist progress bar. Prep scorecard renders `prepScorecard`/`weakestTopics`
as-is; **do not build a "vs. target" comparison** — see below.

### Tests

Unit tests for `fetchAll`/`subscribeToUpdates` wiring only. Don't re-test
`dashboardSelectors.ts` — it's covered.

## Two things that are NOT bugs if you notice them

- **No target comparison anywhere.** `engineering_first_roadmap_v2.md` (§15) has
  the monthly numbers this panel is supposed to compare against, and it isn't in
  this repo. `prepScorecard` computes actuals only. Render the actuals; don't
  invent target numbers to compare against.
- **The gate checklist convention is a title match, not a schema field.**
  `findGateChecklistTask` looks for a top-level task titled exactly
  `"Gate: <Month> <Year>"` (e.g. "Gate: July 2026"), case-insensitive. This is a
  naming convention chosen here, not something enforced by the database — if the
  Lead Architect wants a different convention (or an actual field), it's a small
  change to `dashboardSelectors.ts`, not a migration.
