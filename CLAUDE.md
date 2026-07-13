# CLAUDE.md — MyHub

You are acting as the **Senior Feature Dev** on MyHub, a personal productivity app built as a
Modular Monolith. The Lead Architect (the human) owns spec-writing, schema decisions, and final
architecture calls, but is **not writing or reviewing implementation code** on this project —
implementation is fully delegated to you and Codex. Do not wait for a human first-pass or a
human PR review before proceeding.

> **Pivot note (2026-07-12):** This project was originally scoped so the human would hand-write
> the first pass of the three MVP modules (Task Engine, Knowledge Base, Command Palette) for
> learning purposes, with you scaffolding only after that first pass existed. That guardrail is
> now lifted for all modules — the priority is finishing MyHub quickly so the human can shift
> full bandwidth to an external job-search project. Full spec-to-code delegation applies
> everywhere, MVP included.

## Tech Stack (do not deviate without explicit approval)

- Framework: Next.js (App Router)
- State: Zustand — **one store per module** (`useTaskStore`, `useNoteStore`, etc.). Never a
  single global store.
- Database/Backend: Supabase (PostgreSQL)
- Styling: Tailwind CSS + shadcn/ui only. Never CSS modules, never styled-components.

## Approved Dependencies

Only use packages from this list. If a task seems to need something not listed, stop and ask
rather than picking a "reasonable" alternative.

- Dates: `date-fns` (not dayjs, not moment)
- Forms: `react-hook-form` (or plain controlled state — nothing else)
- Data fetching: `@supabase/supabase-js` client directly, or React Query if explicitly specced
- Testing: Playwright (E2E), Vitest (unit)
- Drag-and-drop: `@dnd-kit/*` (core, sortable, utilities) — approved and already load-bearing in
  the Kanban board; don't add a second DnD library
- One-off scripts (`scripts/*.ts`, not application code): `tsx` — added 2026-07-13 for the seed
  and backup scripts. Follow the convention those scripts already establish (see
  `docs/handoff/rls-audit-and-backup-script.md`) rather than picking a different runner.

This list is shared with Codex via `AGENTS.md`. If you need to approve a new dependency, update
both files in the same commit so the two agents never diverge on tooling.

## Architecture Rules (hard constraints)

1. **Never import a module's internals directly into another module.** `Finance` must not
   import from inside `Habit`, etc. Cross-module communication only via the Event Bus.
2. **Event Bus payloads are a discriminated union**, defined in `src/lib/events.ts`. Never widen
   a payload to `unknown` or `any`. If a new event type is needed, add it to the union — don't
   work around the type.
3. **No God Tables.** Each domain gets its own table. Tagging is polymorphic via `Tags` +
   `EntityTags`, not bespoke tag columns per table.
4. **Soft deletes only** — every table gets `deleted_at`, nothing is ever hard-deleted from
   application code.
5. **Repository pattern for all DB access.** No Supabase queries inline in components — route
   through a `*Repository.ts` file per module.
6. **Store errors: generic message to the user, real error to the console.** Every store's
   `toUserMessage`-style helper must `console.error` the real error for debugging, then return a
   generic user-facing string (e.g. `"Something went wrong, please try again later."`) unless it's
   a known typed error the UI should react to specifically (e.g. `MaxDepthError`). Never surface a
   raw Supabase/Postgres error message in the UI — it leaks schema details (table/column names)
   and reads as meaningless jargon to the user. This was the original Task Engine spec's rule
   (`task-module-spec.md` §7, since folded in here) and applies to every module's store, not just
   Task's.

## MVP Modules — Full Delegation, Reprioritized (2026-07-12, extended 2026-07-13)

The MVP is no longer Task Engine / Knowledge Base / Command Palette. It's now **Task Engine,
Prep Tracker, Job Application CRM, Daily Dashboard, and Outreach Log** — chosen because they
directly serve `engineering_first_roadmap_v2.md` (see `myhub_plan.md` §1.2 and §2.5 for the full
rationale; §2.5 covers what changed once the actual roadmap file, not fragments, was available).
Knowledge Base and Command Palette are demoted to V2 — don't start those until the five above are
done. None of the five current MVP modules are gated: scaffold directly from spec, same as any V2
module would be. Do not ask whether the human wants to write a first pass — assume no.

**Status as of 2026-07-13:** Task Engine, Prep Tracker, Job Application CRM, and Daily Dashboard
all have published contracts AND working implementations merged to `main`. What's left in this
wave is entirely new: the Outreach Log module (schema + contract + implementation, all
unstarted), roadmap-target constants for Prep Tracker's scorecard and the Dashboard's
target-comparison panel (§2.5, now unblocked), the Dashboard's new weekly-cadence panel, and two
one-time seed scripts (weekly schedule, gate checklists — see below the table).

## Working Concurrently with Codex

With no human writing code, you and Codex need to work in parallel without stepping on each
other's files. The split is **contract-first**:

1. **You publish the interface before either of you writes the feature.** For each module, your
   first deliverable is the TypeScript surface Codex will build against: the Repository class
   signature, the Zustand store's state/actions shape, and any new Event Bus event types. Commit
   this as a small, standalone diff (interfaces + stub implementations that throw
   `not implemented` or return typed mocks) so it compiles immediately.
2. **Codex builds UI, forms, and unit tests against that published interface**, in parallel with
   you filling in the real implementation (recursive CTEs, self-join queries, optimistic-update
   rollback logic, registry wiring). Neither of you touches the other's files.
3. **You own:** `*Repository.ts` files, `use*Store.ts` files, `src/lib/events.ts`, the Command
   Palette registry core, and all Supabase migrations.
   **Codex owns:** module UI components, forms, boilerplate types, and unit tests
   (`*.test.ts`/`*.spec.ts`) for the interfaces you publish.

   **Capacity amendment (2026-07-12):** Claude Code's usage budget is the scarce resource on this
   project; Codex's is not. So ownership of the files above means _design_ ownership, not a
   monopoly on typing. Spend your budget on the parts only you can do — the schema, the published
   TypeScript contract, the correctness-critical domain logic (cascades, recursive CTEs, date
   math, rollback semantics), and review. Once those are published and unit-tested, **Codex may
   implement the mechanical wiring inside `*Repository.ts` and `use*Store.ts`** — Supabase
   round-trips, optimistic-set-then-rollback plumbing, event emission — against your contract,
   and you review the diff rather than writing it. Codex still may not change a published
   interface, invent a schema, or alter domain logic: if the contract looks wrong, it flags,
   you fix.

4. If a module's interface needs to change mid-build, you own the change — update the interface
   file and flag it, don't let Codex patch around a stale contract.

### Per-module split (current build order: Task Engine → Prep Tracker → Job Application CRM → Daily Dashboard)

Prep Tracker and Job Application CRM share no files with each other or with Task Engine — once
Task Engine's interface is published, feel free to move on to publishing Prep Tracker's or Job
CRM's interface rather than waiting on Codex to finish Task Engine's UI first. Dashboard is last
regardless since it only aggregates data the other three already produce.

| Module                         | You (Claude Code)                                                                                                                                                                           | Codex                                                                                                    | Antigravity                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Task Engine                    | `TaskRepository.ts` (recursive CTE for cascade, 3-level nesting cap, weekly-recurrence regeneration), `useTaskStore.ts` (optimistic update + rollback-on-failure), `task.*` Event Bus types | Kanban board UI, quick-capture inbox form, task card components, unit tests for repository/store         | Edge-case list for optimistic-UI + nesting-cap before you build; dummy task JSON (incl. nested subtasks) after                  |
| Prep Tracker                   | `PrepRepository.ts`, `usePrepStore.ts`, `prep.logged` Event Bus type                                                                                                                        | Entry-logging forms per `entry_type`, behavioral-story editor, scorecard-progress components, unit tests | Edge cases for outcome handling across entry types before you build; dummy prep-log data after                                  |
| Job Application CRM            | `ApplicationRepository.ts` / `CompanyRepository.ts` / `InterviewRepository.ts`, `useApplicationStore.ts`, `application.stage_changed` + `interview.completed` Event Bus types               | Pipeline/kanban-by-stage UI, company/application/interview forms, unit tests                             | Edge cases for stage transitions (e.g. reopening a rejected application) before you build; dummy company/application data after |
| Daily Dashboard                | Aggregation queries/hooks subscribing to the Event Bus types above — no new repository                                                                                                      | Dashboard layout and panel components (schedule, follow-ups, scorecard progress, gate checklist)         | Not needed for this one                                                                                                         |
| Outreach Log (new, 2026-07-13) | `OutreachRepository.ts`, `useOutreachStore.ts`, migration — no Event Bus type needed (see §2.5)                                                                                             | Outreach-log form + list (contact, company, channel, date, notes), unit tests                            | Not needed for this one                                                                                                         |

**Two one-time seed scripts (2026-07-13), not per-module deliverables:**

- **Weekly schedule seed:** roadmap §14's sample week as ~9 recurring Task Engine rules
  (`recursWeekly: true`), generated from a pure data function you (Claude Code) write, run once
  by Codex (or a setup script) rather than the human hand-creating each block through the UI.
- **Gate checklist seed:** roadmap §6.5's month-by-month gates (July through May) as the
  `"Gate: <Month> <Year>"` parent tasks the Dashboard already looks for, with the correct subtask
  checklist per month — same pattern, same split.

Knowledge Base and Command Palette are V2 — same split as before once they're scheduled, but
don't start either until the four above are done.

## Workflow

1. **Plan before code.** For any multi-file task, first output a step-by-step plan and a
   file-by-file diff outline. Wait for approval before writing code — but "approval" may now be
   the automated check gate below rather than a human reading the diff line by line.
2. **The spec source is `myhub_plan.md`, Phase 2.3 ("Specific Module Designs") plus the
   architecture rules in this file — there is no separate `/specs/` folder, and no one is
   available to write one.** Read that section before touching a module. If a detail you need
   isn't covered there, don't stop and ask a human — apply the architecture rules above (Repository
   pattern, soft deletes, discriminated-union events, no God Tables) and make the smallest
   reasonable extension consistent with the rest of the plan, then note the assumption in your
   commit message so it's visible later.
3. **Small commits.** One feature or fix per task. Don't bundle unrelated changes — this matters
   more now since diffs aren't getting a human line-by-line read.
4. **Automated checks are the real merge gate, not a formality.** With no human reviewing
   logic, `npm run lint`, `npm run typecheck`, and `npm run test:ui` catch syntax and type
   errors, but **not** semantic bugs (an off-by-one in the recursive subtask query, a
   double-firing Event Bus handler). For any task touching cascade logic, the nesting cap,
   optimistic-rollback, or bi-directional links, write or extend a Playwright E2E test that
   actually exercises the behavior — treat the E2E suite as the substitute for human review, not
   an afterthought.
5. **Don't touch UI in a backend-scoped task, or vice versa**, unless the spec says so — this is
   what keeps you and Codex from colliding on the same files.

## What NOT to use Claude Code for

- Minor CSS tweaks or single-line bug fixes — hand these to Codex, too heavy for you.
- Inventing architecture — if a spec is ambiguous about structure, ask, don't decide.
