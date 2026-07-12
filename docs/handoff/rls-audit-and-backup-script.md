# Handoff — Supabase query audit + backup script (Claude Code → Codex)

Two small, independent, mechanical tasks. Neither touches a published contract or
requires a schema decision, so both are safe to pick up whenever you have a gap
between the module work above.

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

## 2. Backup/export script

From `myhub_plan.md` §2.4: _"A 'dump everything to JSON/Markdown' script before
trusting the app with real data."_ Pure I/O, no schema decisions, safe to build
now even though most tables don't exist yet.

- A Node script (`scripts/export-data.ts` or similar — match whatever script
  runner convention `package.json` already uses, don't invent a new one) that
  connects with the Supabase client already in `src/lib/supabaseClient.ts` and
  dumps every module's active (non-`deleted_at`) rows to JSON, one file per table,
  into a gitignored `backups/<timestamp>/` directory.
- Only export tables that exist at the time you run it — don't hardcode a table
  list that breaks when Prep Tracker or Job CRM haven't been migrated in a given
  environment yet. Introspect or just try/catch per table and skip missing ones.
- Add an npm script (`"backup": "..."`) so it's a one-command habit, not a thing
  that has to be remembered as a raw command.
- No restore path needed yet — this is a safety net, not a migration tool.
