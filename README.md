# MyHub

MyHub is a personal productivity app built as a modular monolith with Next.js, Zustand, and
Supabase, purpose-built to support `engineering_first_roadmap_v2.md` — a job-search/engineering
roadmap. See [`myhub_plan.md`](./myhub_plan.md) for the full design history and current plan.

## Status

**Wave 1 (MVP) is complete.** Five modules, each with its own database table(s), repository,
Zustand store, domain logic, and UI:

- **Task Engine** — Kanban board (inbox/todo/in-progress/done), nested subtasks (3-level cap)
  with completion/delete cascades, weekly-recurring task templates.
- **Prep Tracker** — logs algorithm/system-design/ML-system-design/behavioral/mock-interview
  reps, tracks progress against the roadmap's monthly checkpoint targets.
- **Job Application CRM** — companies (reach/match/safety tiers), an 8-stage application
  pipeline, interview scheduling with post-mortem notes.
- **Outreach Log** — networking/referral conversations, tracked against the roadmap's weekly
  cadence target.
- **Daily Dashboard** — read-only aggregation across the other four: this week's schedule,
  applications needing follow-up, scorecard progress vs. targets, weekly cadence, gate checklist.

**Wave 2 (Momentum) is next** — see `myhub_plan.md` Part B for the full 8-phase plan (shared UI
shell, task completion timestamps, prep/CRM depth, a streaks-and-achievements module, a weekly
review ritual, single-user auth + RLS, an offer evaluator).

Knowledge Base and a global Command Palette are designed but deferred (V2) — see `myhub_plan.md`
Part A for their sketch.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a Supabase project, then apply every migration in `supabase/migrations/`, **in order**,
through the Supabase SQL editor (this repo has no local Supabase CLI configuration):

```text
supabase/migrations/0001_create_tasks.sql
supabase/migrations/0002_task_recurrence.sql
supabase/migrations/0003_prep_tracker.sql
supabase/migrations/0004_job_application_crm.sql
supabase/migrations/0005_task_descendant_ids_cte.sql
supabase/migrations/0006_outreach_log.sql
```

Run each file once. Wave 2 will add `0007` onward — apply new migrations the same way, in
order, as they land.

Copy the environment template and provide the project URL and anonymous key:

```bash
cp .env.local.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Optional for backup/seed scripts once RLS is enabled. Keep this in .env.local only.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not commit `.env.local` or service-role credentials. The app requires authentication; apply
`supabase/migrations/0012_enable_rls.sql` only after confirming login works locally. Backup and
seed scripts use `SUPABASE_SERVICE_ROLE_KEY` when present and print a warning when falling back
to the anon key.

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. One-time setup scripts (optional)

```bash
npm run seed:schedule -- --dry-run   # preview, then run without --dry-run to create
npm run seed:gates -- --dry-run      # preview, then run without --dry-run to create
npm run backup                       # dumps all tables to backups/<timestamp>/ as JSON
```

The two seed scripts populate the roadmap's weekly schedule and monthly gate checklists as Task
Engine data — see `scripts/seedData/` and `docs/handoff/seed-scripts.md`. Both are run-once;
re-running creates duplicates (no dedup key on templates/parent tasks).

## Validation

Run before finishing any change:

```bash
npm run lint
npm run typecheck
npm run test
```

Run the Playwright E2E suite separately (requires valid Supabase environment values — tests
mock the REST layer, so no real database calls are made, but the app still needs the env vars
to boot):

```bash
npm run test:ui
```

## Architecture

Each domain owns its database table(s), repository, Zustand store, domain logic, and tests
under `src/modules/<module>`. Database access must go through a module's repository;
components never query Supabase directly. Modules do not import one another's internals —
cross-module communication uses the typed event bus in
[`src/lib/events.ts`](./src/lib/events.ts) (a discriminated union) or, for pure logic only, a
direct function import (e.g. the Dashboard reading `prepScorecard.ts`). Soft deletion via
`deleted_at` everywhere — application code never hard-deletes.

```text
app/                          Next.js routes (one per module: /, /prep, /applications, /outreach, /dashboard)
docs/handoff/                 Per-module/feature briefs handed from Claude Code to Codex
scripts/                      One-off setup scripts (seed data, backups) — see their own docs/handoff brief
src/lib/                      Shared infrastructure: Supabase client, the event bus, theme
src/modules/<module>/         Domain: repository, store, domain logic, components, tests
supabase/migrations/          Ordered PostgreSQL migrations (0001 onward)
tests/ui/                     Playwright end-to-end tests, one spec file (+ Supabase mock) per module
```

## Contribution Workflow

- The Lead Architect (the human) owns spec-writing, schema decisions, and final architecture
  calls, but does not write or review implementation code — everything below is fully
  delegated.
- **Claude Code** owns architecture: migrations, published Repository/Store TypeScript
  interfaces, the event bus, and correctness-critical domain logic (cascades, date math, rules
  engines) — with unit test coverage for all of it.
- **Codex** owns implementation: UI components, mechanical repository/store wiring behind
  Claude Code's published contract, and unit/E2E tests.
- The spec source is [`myhub_plan.md`](./myhub_plan.md) — Part A for what's built (Wave 1),
  Part B for what's next (Wave 2). There is no separate `/specs/` folder.
- Keep changes focused (small, single-purpose commits) and run lint/typecheck/tests after every
  change — green CI is the merge gate, not a formality, since no one reviews diffs line-by-line.

The complete agent instructions are in [`CLAUDE.md`](./CLAUDE.md) (Claude Code) and
[`AGENTS.md`](./AGENTS.md) (Codex).
