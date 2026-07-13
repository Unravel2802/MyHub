# Handoff — Daily Dashboard (Claude Code → Codex)

Published contract. If you already implemented the original four-panel version of
this store, **read the "New (2026-07-13)" section before doing anything else** —
`useDashboardStore`'s contract grew two new fields and one field's meaning
changed, so `fetchAll()` needs updating, not just extending.

## What's already landed

| File                                                | State                                        |
| ----------------------------------------------------- | ----------------------------------------------- |
| `src/modules/dashboard/dashboardSelectors.ts`       | Done — pure aggregation, no DB                |
| `src/modules/dashboard/dashboardSelectors.test.ts`  | Done — 19 unit tests, all passing             |
| `src/modules/prep/prepTargets.ts`                   | Done (2026-07-13) — roadmap checkpoint targets |
| `src/modules/outreach/*`                            | Contract published, separate handoff doc      |
| `src/modules/dashboard/useDashboardStore.ts`        | **Stub — yours**                              |

No migration, no repository for this module — myhub_plan.md Part A §A.2 is explicit that Daily
Dashboard owns no table of its own.

## The one architecture call this module needed

myhub_plan.md Part A §A.2 says the Dashboard aggregates the other modules' data but doesn't say _how_ it's allowed to
read it, and the architecture rules forbid importing another module's internals. The assumption
made here (documented in `useDashboardStore.ts`'s doc comment, flag it to the Lead Architect if
it looks wrong): **this store may call the other modules' Repository functions directly**
(`TaskRepository`, `PrepRepository`, `ApplicationRepository`, `InterviewRepository`,
`OutreachRepository`) — because the Repository Pattern rule already makes each Repository the
sanctioned data-access boundary for its module, not something private to it. What's still off
limits: importing another module's **Zustand store**, its components, or any non-exported helper.
Only the Repository read path is shared across modules.

## Your work

### `fetchAll()` — currently throws `not implemented`

1. Call **five** repository functions in parallel (`Promise.all`): `TaskRepository.getTasks`,
   `PrepRepository.getEntries`, `ApplicationRepository.getApplications`,
   `InterviewRepository.getInterviews`, `OutreachRepository.getEntries` — the last one is new.
2. Run each result through `dashboardSelectors.ts` / `prepScorecard.ts` / `prepTargets.ts`:
   - `thisWeeksScheduleBlocks(tasks, new Date())` → `scheduleBlocks`
   - `applicationsNeedingFollowUp(applications, todayString)` → `followUps`
   - `interviewsNeedingPostMortem(interviews, new Date())` → `postMortemReminders`
   - `findGateChecklistTask(tasks, new Date())` then, if found,
     `gateChecklistProgress(tasks, gateTask)` → `gateChecklist` (else `null`)
   - `scorecardFor(prepEntries, currentMonth)` and `weakestTopics(prepEntries)` → `prepScorecard`
     / `weakestTopics` (unchanged from before)
   - **New:** `prepTargets.activeCheckpoint(todayString)` then
     `prepTargets.progressTowardCheckpoint(prepEntries, checkpoint)` → `checkpointProgress`
   - **New:** compare `behavioralStories.length` (from `PrepRepository.getStories()` — you'll need
     to add this fifth call, it's not in the four above) against
     `prepTargets.FEBRUARY_2027_BEHAVIORAL_STORY_TARGET` → `behavioralStoryProgress`
   - **New:** `dashboardSelectors.weeklyCadence(applications, outreachEntries, prepEntries, new
     Date())` → `weeklyCadence`
3. Standard `isLoading`/`error` handling, same shape as the other stores.

### `subscribeToUpdates()` — currently throws `not implemented`

Subscribe via `on()` from `src/lib/events.ts` to `task.completed`, `application.stage_changed`,
`interview.completed`, and `prep.logged`. On any of them, call `fetchAll()` again. Return the
unsubscribe function `on()` gives you.

**Outreach Log has no Event Bus type** — logging a conversation doesn't trigger a refetch on its
own. That's an accepted gap, not a bug to fix: one of the four existing events will refresh the
weekly-cadence panel soon enough, and outreach entries don't need instant reactivity.

### UI (yours)

- The original four panels: this week's schedule blocks, the follow-up list, the post-mortem
  reminder list, the gate checklist progress bar.
- **New: checkpoint-progress panel.** Render `checkpointProgress` (algorithm / system-design /
  ML-system-design / mock-interview, each `{ actual, target, progress }`) and
  `behavioralStoryProgress`. `progress` can exceed `1` — render "beat the target" distinctly from
  a maxed-out bar, don't just clamp the display.
- **New: weekly-cadence panel.** Render `weeklyCadence`'s three counts (applications / outreach /
  mock interviews) against their targets (`{min, max?}` — a range for applications and outreach,
  a floor only for mock interviews).

### Tests

Unit tests for `fetchAll`/`subscribeToUpdates` wiring only, including the two new fields. Don't
re-test `dashboardSelectors.ts`, `prepScorecard.ts`, or `prepTargets.ts` — all covered.

## Things that are NOT bugs if you notice them

- **The gate checklist convention is a title match, not a schema field.** `findGateChecklistTask`
  looks for a top-level task titled exactly `"Gate: <Month> <Year>"` (e.g. "Gate: July 2026"),
  case-insensitive. Naming convention, not a database fact — small change to
  `dashboardSelectors.ts` if the Lead Architect wants something else.
- **`checkpointProgress` only covers December 2026 and February 2027.** Two other roadmap numbers
  (interview-prep time-allocation percentages, per-month mock-interview subtypes) were
  deliberately left out — see the doc comment at the top of `prepTargets.ts` for why. Don't add UI
  for numbers that don't exist in the contract; flag it instead if you think they're needed.
