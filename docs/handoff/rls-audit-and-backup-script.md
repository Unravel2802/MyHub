# Handoff — Supabase query audit + backup script (Claude Code → Codex)

Two small, independent, mechanical tasks. Neither touches a published contract or
requires a schema decision, so both are safe to pick up whenever you have a gap
between the module work above.

**Update (2026-07-13): the backup script is done — see §2 below.** The query
audit (§1) is still open and still yours.

## 1. Query audit (read-only — report, don't fix silently)

There is currently **no Row Level Security** on any table, and no auth in the app
at all — the anon key is public read/write. Turning on RLS is an architecture
decision that needs the Lead Architect's sign-off (it requires deciding on an auth
story first, or every query starts returning zero rows), so **do not enable RLS**.
What's useful right now, ahead of that decision, is knowing exactly what's exposed
and whether the existing queries are already sloppy in ways that would make RLS
harder to retrofit later.

Audit every `*Repository.ts` file (`TaskRepository.ts`, `PrepRepository.ts` once
implemented, the three Job Application CRM repositories once implemented) for:

- Any `select` that doesn't filter `deleted_at is null` where it should (soft-
  deleted rows leaking into a UI list is a correctness bug independent of RLS).
- Any query that fetches more columns than the caller uses (`select("*")` where a
  narrower select would do) — not urgent, but worth listing.
- Any N+1 pattern — a loop issuing one query per row instead of a single `in()`
  filter. `TaskRepository`'s `autoCompleteAncestors`/`revertAncestorsToIncomplete`
  are known instances of this (they're the ancestor-walk cascades, out of scope to
  fix here since they're tested cascade logic) — don't re-flag those, but do flag
  anything similar you find elsewhere.

Output: a short markdown list (file, line, issue, one-line why) in
`docs/handoff/query-audit-findings.md`. No code changes from this task — just the
list. Claude Code will triage it against the eventual RLS/auth work.

## 2. Backup/export script — done (2026-07-13)

`npm run backup` → `scripts/exportData.ts`. Dumps every module's active
(non-`deleted_at`) rows to JSON, one file per table, into a gitignored
`backups/<timestamp>/` directory. Skips a table gracefully (`PGRST205`) rather
than failing the whole export if a migration hasn't been applied in a given
environment yet. Smoke-tested against the real Supabase project.

**Established, not "whatever convention already existed" — there wasn't one.**
This was the first script in the repo, so it set the convention the two seed
scripts (`docs/handoff/seed-scripts.md`) also use: `tsx` (added as a
devDependency — flagging this since it's new, not previously on the approved
list), `process.loadEnvFile(".env.local")` for env vars, dynamic `import()`
inside `main()` rather than static top-level imports (needed so the env file
loads *before* `src/lib/supabaseClient.ts` is evaluated — a static import
would be hoisted ahead of the `loadEnvFile` call), and `export {};` at the
bottom of every script file (otherwise TypeScript treats a file with no
top-level import/export as a global script, and multiple scripts' top-level
`main()` collide as duplicate global declarations). Follow this pattern for
any future script rather than picking something new.
