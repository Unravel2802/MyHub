# Handoff — one-time seed scripts (Claude Code → Codex)

Two small setup scripts, not app features. Both consume pure data files already written; your
job is the script that reads the data and calls the repository, run once by the human (or you,
once) against their real Supabase project — not part of the app's runtime UI.

## What's already landed

| File                                  | State                                              |
| -------------------------------------- | ----------------------------------------------------- |
| `scripts/seedData/weeklySchedule.ts`  | Done — 13 entries, §14's sample week                 |
| `scripts/seedData/gateChecklists.ts`  | Done — 11 months, July 2026 through May 2027, §6.5   |

Both are pure data (no imports beyond their own types) — nothing to implement in them, just
consume.

## 1. Weekly schedule seed

`WEEKLY_SCHEDULE_SEED` is a flat list of `{ weekday, title, description }`. For each entry, call:

```ts
TaskRepository.createTask({
  title: entry.title,
  description: entry.description,
  recursWeekly: true,
  weekday: entry.weekday,
});
```

Run once. If run twice, you'll get duplicate recurring templates — there's no dedup key for
templates the way there is for generated instances (migration 0002's unique index is on
`recurrence_template_id` + `occurrence_date`, which only applies to instances, not templates
themselves). A `--dry-run` flag that just logs what would be created is worth adding, given that.

## 2. Gate checklist seed

`GATE_CHECKLIST_SEED` is one entry per month: `{ monthLabel, subtasks: string[] }`. For each
month, in order:

```ts
const parent = await TaskRepository.createTask({
  title: `Gate: ${entry.monthLabel}`, // matches dashboardSelectors.gateChecklistTitleFor exactly
  recursWeekly: false,
});

for (const subtaskTitle of entry.subtasks) {
  await TaskRepository.createTask({
    title: subtaskTitle,
    parentTaskId: parent.id,
  });
}
```

The parent must exist before its subtasks (subtasks reference `parentTaskId`), so this can't be
parallelized across a single month — run it sequentially per month. Across months it doesn't
matter.

**Verify the title matches exactly.** `dashboardSelectors.findGateChecklistTask` does a
case-insensitive match on `"Gate: <Month> <Year>"` — if the generated title drifts from that
(extra whitespace, different capitalization is fine since the match is case-insensitive, but a
different format like "July Gate 2026" is not), the Dashboard's gate-checklist panel silently
finds nothing for that month. Worth a quick manual check after running.

## Where to put the runner

Match whatever script-running convention the rest of `package.json` uses — a `tsx` or `ts-node`
script under `scripts/`, with an npm script entry (`"seed:schedule"`, `"seed:gates"`) so these are
one-command actions, not raw commands someone has to remember. No UI needed; these are setup
scripts, not app features.
