# Handoff — Job Application CRM (Claude Code → Codex)

Published contract. Module 3 of the MVP build order. No dependency on
`engineering_first_roadmap_v2.md` — everything here is fully specified in
`myhub_plan.md` §2.3, so start whenever you're free.

## What's already landed

| File                                                | State                                                    |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/0004_job_application_crm.sql`  | Done — apply in the Supabase SQL editor before testing    |
| `src/modules/jobApplications/types.ts`              | Done — `Company`, `Application`, `Interview`              |
| `src/lib/events.ts`                                 | Done — `application.stage_changed`, `interview.completed` |
| `src/modules/jobApplications/CompanyRepository.ts`  | **Stubs — yours**                                          |
| `src/modules/jobApplications/ApplicationRepository.ts` | **Stubs — yours**                                       |
| `src/modules/jobApplications/InterviewRepository.ts`   | **Stubs — yours**                                       |
| `src/modules/jobApplications/useApplicationStore.ts`   | **Stubs — yours**                                       |

## The one piece of real logic: when to emit

This is the part that will bite you if you skip the doc comments in
`useApplicationStore.ts`. Read them before implementing. Short version:

- `application.stage_changed` fires **only when `stage` actually changes**, not on
  every application edit. That's why the store contract splits `updateApplication`
  (general fields — cannot touch `stage`) from `updateApplicationStage` (the only
  path that can). Diff the previous stage (already in the store's `applications`
  array) against the repository's returned row, same pattern `useTaskStore` uses
  for status cascades — look at `applyStatusCascade` there for the shape.
- `interview.completed` fires **only on the false → true transition**. The store
  contract splits this the same way: `updateInterview` (general fields) vs.
  `markInterviewCompleted` (the only path that flips the flag). A redundant call
  on an already-completed interview is a no-op, not a re-fire.

Getting this wrong doesn't crash anything — it just means the Dashboard's
post-mortem reminder and stage-based panels fire on the wrong events later, which
is a quiet bug, not a loud one. Worth the extra care.

## Your work

### 1. Three repositories — every function throws `not implemented`

Plain CRUD, soft deletes only (`deleted_at`, never `DELETE`). One thing to note
per table:

- **`CompanyRepository.deleteCompany` does not cascade** to that company's
  applications — unlike Task's parent/child cascade, an application is a
  historical record of a real process, and losing it because a company row got
  cleaned up would destroy the funnel data the roadmap tracks (§11). If you want
  to *prevent* deleting a company with active applications, that's a UI
  confirmation, not a repository cascade.
- **`ApplicationRepository.updateApplication` must always bump `last_update_date`
  to today**, on any field change, not just stage changes. The Dashboard's
  "no update in >7 days" panel reads that column — a stale value hides an
  application that's actually being worked.
- `InterviewRepository` interviews are **real interviews tied to an application**.
  `PrepEntries` (Prep Tracker, `entry_type: "mock_interview"`) are practice reps in
  a different module. Don't let the UI or the data model drift the two together.

### 2. `useApplicationStore.ts` — every action throws `not implemented`

Same optimistic-update-then-rollback pattern as `useTaskStore` and `usePrepStore`.
The event-emission split described above is the main design constraint; otherwise
straightforward.

### 3. UI (yours)

- Pipeline/kanban-by-stage view (`researching` → ... → `offer`/`rejected`/
  `withdrawn`), similar shape to the Task board but driven by `stage` instead of
  `status`.
- Company form, application form, interview log form.
- A post-mortem prompt somewhere reachable when an interview has `completed: true`
  but no `postMortemNotes` yet — the roadmap wants that within 24 hours (§11.2),
  though the Dashboard is the eventual home for the reminder itself.

### 4. Tests

Unit tests for the repository/store wiring, **especially the emission-boundary
cases**: updating a non-stage field doesn't fire `application.stage_changed`;
updating stage to the same value doesn't fire it either; marking an
already-completed interview complete again doesn't re-fire `interview.completed`.

## Not yours

- The recursive-CTE migration for Task's `collectDescendantIds` — separate,
  unrelated cleanup, still Claude Code's.
- Daily Dashboard — depends on this module's events; comes after.
