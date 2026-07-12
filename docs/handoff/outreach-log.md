# Handoff — Outreach Log (Claude Code → Codex)

Published contract. Fifth MVP module, added 2026-07-13 once
`engineering_first_roadmap_v2.md` §11.1/§11.2 showed a weekly-tracked activity
nothing in the app captured: 2–3 outreach/referral conversations per week.

Simplest schema of the five MVP modules — simpler than Prep Tracker, even. No
nesting, no cascades, one optional FK.

## What's already landed

| File                                            | State                                     |
| ------------------------------------------------ | ------------------------------------------ |
| `supabase/migrations/0006_outreach_log.sql`     | Done — apply in the Supabase SQL editor   |
| `src/modules/outreach/types.ts`                 | Done — `OutreachEntry`, `OutreachChannel` |
| `src/modules/outreach/OutreachRepository.ts`    | **Stubs — yours**                         |
| `src/modules/outreach/useOutreachStore.ts`      | **Stubs — yours**                         |

No Event Bus type for this module — nothing downstream reacts to a logged
conversation. The Dashboard's weekly-cadence panel reads this table's entries
directly (same pattern the Dashboard already uses for the other three
modules), not through an event.

## Your work

### 1. `OutreachRepository.ts` — every function throws `not implemented`

Plain CRUD over `outreach_log`. Soft deletes only. Nothing unusual here —
simpler than any repository you've built so far for this app.

### 2. `useOutreachStore.ts` — every action throws `not implemented`

Same optimistic-update-then-rollback shape as every other store in this app.
No emission logic to worry about — this is the one module with no Event Bus
type at all.

### 3. UI (yours)

- A log form: contact name (optional), company (optional select, tied to Job
  CRM's `Companies` — reuse `CompanyRepository.getCompanies()` for the picker,
  don't duplicate company data here), channel, date, notes.
- A list view, probably grouped by week or just reverse-chronological — this
  page can be small; the roadmap only needs "how many this week," not a rich
  CRM view.
- Consider surfacing this as a panel/tab on the Job Applications page rather
  than a wholly separate nav item, since the two are related in practice even
  though they're separate modules architecturally. Your call on the UI
  grouping — the module boundary is a code-organization fact, not a UI
  requirement.

### 4. Tests

Standard repository/store unit tests, same shape as Prep Tracker's or Job
CRM's.

## Not yours

- The Dashboard's weekly-cadence panel (applications/outreach/mocks this week
  vs. targets) — that's a separate Claude Code contract on
  `useDashboardStore`, landing alongside this one. It reads this module's
  `getEntries()` the same way it reads the other three modules' repositories.
