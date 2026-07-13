# Handoff — Job CRM depth: notes, rejection nudge, funnel stats (Claude Code → Codex)

Published contract. Wave 2, Phase 4 (`myhub_plan.md` Part B).

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0009_crm_notes_and_interview_timestamps.sql` | Done — `applications.notes`, `interviews.completed_at`, `interviews.post_mortem_logged_at`, with best-effort backfills |
| `src/modules/jobApplications/types.ts` | Done — `Application.notes`, `Interview.completedAt`, `Interview.postMortemLoggedAt` |
| `src/modules/jobApplications/funnelStats.ts` (new) | Done + fully tested — `funnelStats(applications, interviews) → FunnelStats` |
| `src/modules/jobApplications/interviewTimestamps.ts` (new) | Done + fully tested — `postMortemLoggedAtFor()`, the write-once rule |
| `ApplicationRepository.ts` / `InterviewRepository.ts` | Done — all three columns round-trip; `UpdateApplicationInput.notes`, `UpdateInterviewInput.completedAt`/`.postMortemLoggedAt` |
| `useApplicationStore.ts` | Done — `markInterviewCompleted` stamps `completedAt`; `updateInterview` stamps `postMortemLoggedAt` on the post-mortem's first write; new `funnel()` selector on the store |

Full gate green: typecheck, lint, 188 unit, 32 E2E.

## Contract notes you need before writing UI

**Rates are `null`, not `0`, before anything has been sent.** `responseRate` /
`interviewRate` / `offerRate` are `number | null`. Render `null` as `—`, **never as "0%"** —
"I haven't applied anywhere" and "I've applied to 40 places and heard nothing" are completely
different situations and must not look identical. A real zero (applied to things, no responses)
IS `0` and should render as "0%".

**Don't set the interview timestamps from the UI.** `completedAt` and `postMortemLoggedAt` are
computed in the store, which is the only layer that knows the previous state. Just call
`markInterviewCompleted(id)` and `updateInterview(id, { postMortemNotes })` as you already do —
the timestamps take care of themselves. `postMortemLoggedAt` is deliberately write-once: a later
edit to the notes must not move it.

## Your work

### 1. `ApplicationForm` — notes textarea

Add a `notes` `<textarea>` wired to `UpdateApplicationInput.notes` / `CreateApplicationInput.notes`.

### 2. Rejection nudge (§11.2)

When an application's stage moves to `rejected` and its `notes` don't yet contain a takeaway,
show an inline, dismissible prompt on that application's card:

> §11.2: log one specific, actionable takeaway from this rejection.

Submitting it appends `Rejection takeaway: <text>` to the application's `notes` (via
`updateApplication`). The nudge reappears on reload while no takeaway is present — dismissing it
is a per-session "not now", not a permanent suppression. Detect "has a takeaway" by looking for
the `Rejection takeaway:` prefix in `notes`; keep that string in one exported constant rather
than duplicating the literal at both the write and the check.

### 3. `FunnelPanel.tsx` — above the pipeline

Stage counts (from `funnel().byStage`) plus three rate `StatCard`s (response / interview /
offer), each rendering `—` for `null`. Use the Phase 1 `StatCard` / `ProgressBar` primitives.

### 4. Tests

Extend `tests/ui/supabaseJobMock.ts` with the three new columns (`notes`, `completed_at`,
`post_mortem_logged_at`) in the row shapes and defaults. Extend `tests/ui/job-crm.spec.ts`:
move an application to `rejected` → the nudge appears → save a takeaway → it's gone; and assert
the funnel numbers on a seeded fixture. All 32 existing specs must keep passing.

## Not yours

- `funnelStats.ts` and `interviewTimestamps.ts` — domain logic, already done and tested. If a
  rule looks wrong, flag it; don't patch around it.
