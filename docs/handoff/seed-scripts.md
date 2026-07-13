# Handoff — one-time seed scripts (Claude Code → Codex)

**Done (2026-07-13).** Both runners are built, typechecked, and smoke-tested via
`--dry-run` (which validates every gate-checklist title round-trips through
`dashboardSelectors.gateChecklistTitleFor` with no typos — all 11 passed).
Nothing left to implement here; this doc is now a reference for what exists,
not a task list.

## What's landed

| File                              | What it does                                                            |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `scripts/seedData/weeklySchedule.ts` | Pure data — 13 entries, §14's sample week                                |
| `scripts/seedData/gateChecklists.ts` | Pure data — 11 months, July 2026 through May 2027, §6.5                  |
| `scripts/seedWeeklySchedule.ts`      | Runner — `npm run seed:schedule` (`-- --dry-run` to preview)              |
| `scripts/seedGateChecklists.ts`      | Runner — `npm run seed:gates` (`-- --dry-run` to preview)                 |

## Running these against a real project

Both are **run-once**. Neither has a dedup key: `seed:schedule` creates duplicate
recurring templates if run twice (migration 0002's unique index only dedups
generated *instances*, not templates); `seed:gates` creates duplicate parent
tasks with the same title, and `findGateChecklistTask` matches whichever one
it finds first, so a re-run risks the Dashboard silently reading an incomplete
duplicate. Always run with `-- --dry-run` first to confirm the list looks
right, then without it.

`seed:gates` validates every month's title round-trips through
`gateChecklistTitleFor` before creating anything (throws if a `monthLabel` in
`gateChecklists.ts` has a typo that would produce a title the Dashboard could
never match) — this check runs even in dry-run mode, so a dry run also
catches that class of bug before you touch the database.

## Script-running convention (for any future script)

Established by `scripts/exportData.ts` (see
`docs/handoff/rls-audit-and-backup-script.md`) and followed here: `tsx`,
`process.loadEnvFile(".env.local")`, dynamic `import()` inside `main()` rather
than static top-level imports, and `export {};` at the bottom of every file.
Follow this pattern rather than inventing a new one.
