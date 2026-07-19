# Software Engineering Blueprint: MyHub

_(The Personal Master App — codename "MyHub". Suggested repo name: `myhub` or `my-hub`.)_

> **Pivot note (2026-07-12):** This plan was originally optimized for **learning surface
> area** — hands-on schema design and state management reps — over speed-to-daily-use. That
> priority has flipped. The goal now is finishing MyHub as fast as responsibly possible, because
> the human is shifting full bandwidth to an external Master's/job-search project. Implementation
> is now **fully delegated to Claude Code and Codex, with no human first-pass and no human
> line-by-line PR review**. Every "write this yourself" instruction from the original plan has
> been removed below; where it mattered functionally (not just as a learning device), it's been
> replaced with an automated substitute — see the Operating Model.

Since this is a multi-featured app for a single user, traditional enterprise constraints
(scaling, multi-tenant security) are replaced by a different constraint: **Developer Sanity** —
specifically, keeping a solo-directed, multi-agent build from drifting into inconsistent
architecture. Speed is the explicit priority; the modular-monolith discipline below exists to
keep two concurrent agents from producing an unmaintainable mess while moving fast, not to
manufacture learning exercises.

---

## Status at a Glance

| Wave                          | Status                                      | Scope                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wave 1 — MVP**              | ✅ **Done** — `98d3ed8`                     | Task Engine, Prep Tracker, Job Application CRM, Outreach Log, Daily Dashboard                                                                                                                                                          |
| **Wave 2 — Momentum**         | ✅ **Done** — all 8 phases shipped          | Shared AppShell, task completion timestamps, Prep depth (mock subtypes, resume deep-dive, §11.3 allocation), CRM depth (notes, rejection nudge, funnel), **streaks + achievements**, weekly review ritual, auth + RLS, offer evaluator |
| **Wave 3 — Frontend refresh** | ✅ **Done** — see `docs/visual-refresh.md`  | "Premium developer tool" visual system: zinc/indigo tokens, WCAG AA contrast, focus ring, hero type, motion, IA flip (data-first), presentational/container split, mobile nav, a11y sweep                                              |
| **Wave 4 — Frontend upgrade** | ✅ **Done** — see `docs/wave4.md`           | Design-system cleanup (single-source hue classes), selective shadcn adoption + `cn()` + lucide icons, motion polish, command-palette rebuild (fuzzy + recents), Knowledge Base link editor, global keyboard shortcuts                  |
| **Personal Finance**          | 📋 **Planned** — see `docs/finance-plan.md` | Net-new module (outside the job-search roadmap): expense/income ledger, recurring bills (rent/utilities), per-category budgets, and a job-search runway metric. Dashboard surfaces: bills due + month-to-date spend                    |

**Live state:** RLS enforcing (an unauthenticated client reads 0 rows), migrations `0001`–`0018`
applied, single-user auth working.

Wave 1's design is in **Part A**. Wave 2's phase-by-phase plan is in **Part B** — kept as the
record of what was built and why, not as a to-do list. Wave 3 (the frontend refresh), Wave 4 (the
frontend upgrade), and the planned Personal Finance module each have their own document:
`docs/visual-refresh.md`, `docs/wave4.md`, and `docs/finance-plan.md`.

---

## What's actually left

Everything planned is shipped. These are the known open items, in the order they'd bite:

**Resolved (2026-07-15):**

- `SUPABASE_SERVICE_ROLE_KEY` is set and verified — `npm run backup` confirmed
  it bypasses RLS and captures real rows, not a silent empty export.
- Test-data hygiene — checked `tasks` directly: only 2 rows exist, both real
  ("Finish Myhub", "Apply"), no junk rows matching `Codex debug create …` /
  `Codex ui verify …` remain. Whatever created them is already gone.
- Knowledge Base and Command Palette contracts are published (migration
  `0016_knowledge_base.sql`, `NoteRepository`/`useNoteStore`,
  `src/lib/commandPalette.ts`/`useCommandPaletteStore`) — see
  `docs/handoff/knowledge-base.md` and `docs/handoff/command-palette.md` for
  what's left (UI, the Cmd+K modal, per-module command registrations, E2E
  coverage).

**Not open, despite appearances:** the app is _not_ mobile-broken. An early audit claimed a
horizontal overflow at 375px; that was a measurement error, retracted, and `tests/ui/responsive.spec.ts`
now pins the real behaviour across all eight pages.

---

## Operating Model

The workflow, roles, and architecture rules below apply across **both** waves — they're
standing principles, not history tied to Wave 1 specifically.

### Architecture (Modular Monolith)

Do not build microservices. For a solo developer, build a **Modular Monolith**.

- **The Shell:** Core app (auth, navigation, global state).
- **The Modules:** Each feature is self-contained. The "Finance" module should not directly
  import internal components from the "Habit" module — same rule for every module pair.
- **The Event Bus Payload Contract:** Modules communicate only via a strict Event Bus, defined
  as a **discriminated union** in `src/lib/events.ts`, never `payload: unknown`. A generic
  `unknown` payload gives every agent an excuse to shape data however's convenient in the
  moment — a discriminated union makes TypeScript itself reject malformed events instead of
  relying on agents to self-police.
- **No God Tables:** Don't create one massive `Items` table. Polymorphic tagging (if ever
  needed) goes through a `Tags` + `EntityTags` join table, not bespoke tag columns per table.
- **Soft Deletes only:** every table gets `deleted_at`; nothing is ever hard-deleted from
  application code.
- **Repository pattern for all DB access:** no Supabase queries inline in components — route
  through a `*Repository.ts` file per module.
- **Migrations are agent-generated from spec.** Claude Code writes raw SQL DDL directly from
  the markdown schema plan for every module. Review migrations via the automated checks below,
  not a manual read-through.

**Tech stack:** Next.js (App Router), Zustand (**one store per module** — `useTaskStore`,
`usePrepStore`, etc., never a single global store), Supabase (PostgreSQL), Tailwind CSS +
semantic design tokens.

### AI Team Division of Labor

**1. You (The Lead Architect)**

- Responsibilities: writing specs, defining schemas, final call on tech-stack changes,
  deciding what's in-scope vs. deferred.
- Coding role: none by default — implementation is fully delegated. Jump in on a specific
  piece if you want to, but it's not the expected workflow.
- Review role: not line-by-line. The automated gate (lint/typecheck/tests + Playwright E2E) is
  what stands in for that. Spot checks before merging to `main` are optional, not the primary
  defense.

**2. Claude Code (The Architect/Senior Feature Dev)**

- Owns: migrations, the published TypeScript interface (Repository signatures, store shapes,
  Event Bus types) for every module, and correctness-critical domain logic (cascades, date
  math, rules engines) with vitest coverage — MVP included, no exceptions.
- Hand off well-scoped, multi-file tasks directly from spec. Publish the interface first so
  Codex can build against it without waiting for the real implementation.
- When NOT to use it: minor CSS tweaks or single-line bug fixes — too heavy for that, hand to
  Codex.

**3. Codex (The Implementer / Fast Typist)**

- Owns: UI components, forms, mechanical repository/store wiring behind Claude's published
  contract, unit tests for that wiring, and E2E tests. Builds against the published interface
  in parallel — does not wait for Claude's implementation to be finished, only for the
  interface to exist.
- When NOT to use it: architecting a new feature or reasoning about cross-store interactions —
  hand that to Claude Code.

**4. Antigravity (Narrow role: Edge-Case QA & Test Data)**

- Before logic-heavy code is written: edge-case lists. After code exists: dummy/test data.
  Kept deliberately narrow — revisit only if Claude/Codex keep shipping edge-case bugs the E2E
  suite isn't catching.

### The Agentic SDLC

- **`CLAUDE.md` and `AGENTS.md`**: root-level markdown files defining strict codebase rules per
  agent. Keep them in sync; if they ever conflict, `CLAUDE.md` wins since Claude Code owns
  architecture.
- **Plan before code:** for any multi-file task, a step-by-step plan and file-by-file diff
  outline first. With no human line-by-line review, the plan step is the real checkpoint.
- **Small commits:** one feature or fix per task, to keep diffs reviewable and avoid Claude
  Code and Codex colliding on the same files.

### Design Patterns in Use

- **Repository Pattern (data level):** isolates DB queries per module — Claude Code owns this
  for every module.
- **Observer/Pub-Sub (Event Bus):** decouples modules — Claude Code owns building it, from
  spec.

### QA & DevOps

- **Pre-commit hooks:** Husky + lint-staged (Prettier/ESLint/type-checks on every commit) —
  more important with agent-generated code than hand-written code, since agents won't
  self-enforce formatting discipline the way a human would out of habit.
- **Green CI is the real bar, not the minimum bar.** Lint/typecheck/format catch syntax-level
  mistakes but not an agent writing a perfectly-typed function that does the wrong thing (an
  off-by-one in a recursive query, a double-firing Event Bus handler). That gap is covered by
  an **expanded** Playwright E2E suite specifically covering cascade/cross-cutting logic — the
  behaviors that used to get a manual trace-against-spec now need a test that actually
  exercises them.
- **Testing:** unit test complex logic (Vitest); Playwright E2E for logic-heavy paths, not
  just "3-4 critical paths."
- **Version control:** `main` is production, branch per feature, green CI is the merge gate for
  both agents' work.

---

## PART A — Wave 1: MVP (DONE — commit `98d3ed8`)

### A.1 Brainstorm & Scope

**The "Second Brain" Modules (Full Brainstorm)**

**Core Workflow & Time Management**

- The Daily Dashboard: A landing page aggregating news, calendar events, and today's top priorities.
- Task Engine: "Inbox" for quick capture, Kanban boards for projects, recurring daily/weekly tasks.
- Calendar/Time Blocking: A visual grid of the week/month to schedule events and block out time.
- Focus/Pomodoro Timer: A client-side timer to force deep work, logging completed sessions.

**Knowledge & Content (Zettelkasten)**

- Personal Knowledge Base: Markdown-based notes with bi-directional linking (like Obsidian/Roam).
- Media/Blog CMS: A place to write, rate, and organize thoughts on movies, books, tech, etc.
- Job Application CRM: A pipeline tracker for job hunting (Applied → Interviewing → Offer). Built
  from scratch as its own module — intentionally not reusing the existing Applyze codebase.
- **Prep Tracker (added 2026-07-12):** Logs algorithm problems, system-design and
  ML-system-design case practice, mock interviews, and behavioral stories. Added specifically
  because `engineering_first_roadmap_v2.md` tracks these as hard numeric scorecards (Sections
  6.1, 15) and expects a post-mortem within 24 hours of every real interview (Section 11.2) — a
  generic task or note doesn't capture the structured fields (topic, time-to-solve, outcome)
  those targets need.

**Life & Tracking**

- Finance/Budget Ledger: Income/expense logging, monthly burn rate charts, subscription tracker.
- Habit Tracker: Daily checkboxes with visual "streak" counters.
- Daily Wrap-Up / Journal: An end-of-day prompt summarizing tasks completed + journal entry.

**System Level (The "Magic" Features)**

- Global Command Palette (Cmd+K): A universal shortcut to add tasks, search notes, or navigate
  anywhere instantly.

**Feature Triage (MVP vs. V2)**

> **Reprioritization note (2026-07-12):** The original MVP (Task Engine, Knowledge Base,
> Command Palette) was chosen for architectural learning value. That's no longer the filter.
> The filter became: **does this module materially help execute
> `engineering_first_roadmap_v2.md`?** Two modules survive that filter as-is (Task Engine), one
> gets promoted from V2 (Job Application CRM), one is new (Prep Tracker), and one is added
> specifically as a thin aggregation layer over the other three (Daily Dashboard). Knowledge
> Base and Command Palette are demoted to V2 — the roadmap explicitly treats a spreadsheet/
> Notion as an acceptable stand-in for the tracker (Section 6.5), so neither needed to exist
> before September applications ramp up.

**MVP (built, see A.2 for schemas):**

| Module                                                | Why it's in the MVP                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Task Engine** (+ minimal weekly recurrence)         | Baseline CRUD + state fundamentals. Recurrence exists because the roadmap's weekly schedule (Section 14) repeats identically Sep 2026–May 2027; without it you'd manually re-add the same Mon–Sun blocks for 9 months. Monthly "gates" (Section 6.5) are modeled as a parent task with checklist subtasks, reusing the existing 3-level nesting. |
| **Prep Tracker**                                      | Directly implements the roadmap's numeric scorecards (Section 15) and the 24-hour interview post-mortem habit (Section 11.2). Diagnostics start immediately (July), so this had the earliest real deadline.                                                                                                                                      |
| **Job Application CRM** (promoted from V2)            | Section 11 asks for a tracked funnel by company tier (reach/match/safety), applications/week, referral conversations, and rejection reviews. Applications ramp in September (Section 6.5).                                                                                                                                                       |
| **Outreach Log** (added 2026-07-13, fifth MVP module) | Section 11.2 budgets 2–3 outreach conversations/week as a distinct, trackable activity — separate from `Applications.referral_source`, since a conversation can happen before any application exists.                                                                                                                                            |
| **Daily Dashboard**                                   | A single read-only view: this week's schedule blocks, applications needing follow-up, running scorecard totals vs. targets, current month's gate checklist. Pure aggregation — the thing that makes the other modules function as a system instead of disconnected trackers.                                                                     |

**Build order:** Task Engine → Prep Tracker → Job Application CRM → Outreach Log → Daily
Dashboard. Prep Tracker, Job CRM, and Outreach Log share no tables or files with each other, so
they ran as parallel mini-tracks rather than strictly sequential. Dashboard came last since it
reads from the other four.

**V2 (deferred):**

- **Knowledge Base (with bi-directional linking)** — still valuable, but nothing in the roadmap
  requires a dedicated linked-notes app; markdown files or a plain notes tool cover this in the
  meantime.
- **Global Command Palette** — real daily-use value and a genuine architecture test, but a
  polish feature with no roadmap line item.
- Habit Tracker — mostly overlaps with Task Engine recurrence + Dashboard progress views.
- Calendar/Time Blocking, Focus/Pomodoro Timer, Media/Blog CMS, Journal.
- **Finance/Budget Ledger** — the roadmap explicitly assumes no income during the Master's year
  (Section 5); relevant post-graduation (Jun 2027+), not now.

**Optional stretch on Knowledge Base (once built):** add `pgvector` on Supabase for semantic
search over notes.

### A.2 Module Designs (as built)

**Database design principles:** avoid the "God Table"; polymorphic tagging via `Tags` +
`EntityTags` if ever needed; soft deletes (`deleted_at`) everywhere; migrations are hand-written
raw SQL DDL from the schema plan, reviewed via the automated CI gate, not a manual read-through.

**Task Engine — `Tasks` table:**

- `id` (uuid, pk), `title` (text, required), `description` (text, nullable), `status` (enum:
  `inbox` / `todo` / `in_progress` / `done`), `position` (numeric — ordering within a Kanban
  column; fractional, so dropping a card between two others is one write, not a reindex),
  `due_date` (date, nullable), `parent_task_id` (uuid, self-referencing FK, nullable — null means
  top-level task), `deleted_at` (timestamptz, nullable, default `NULL` — never default to
  `now()`), `created_at`/`updated_at` (timestamptz).
- **`inbox` is a real status, not a UI affordance.** Quick capture drops a task into `inbox`
  untriaged; it moves to `todo` once you decide to actually do it.
- **3-level nesting cap:** root → child → grandchild is the deepest allowed chain. Counting the
  root as level 1, a task's level must not exceed 3 (`MAX_TASK_DEPTH = 3` in `taskTree.ts`).
  Enforced in `TaskRepository.ts`, not just the UI.
- **Delete cascade:** soft-deleting a parent soft-deletes its descendants, resolved via a
  recursive CTE (not an application-side loop) — see migration 0005.
- **Completion cascade:** completing a task completes all of its descendants. When every subtask
  of a parent is `done`, the parent auto-completes — recursively, up the whole ancestor chain.
  Creating a new subtask under a `done` parent reverts that parent (and any `done` ancestors) to
  `todo`, since the work is no longer finished.
- **Optimistic UI:** Kanban drag updates `status` optimistically in `useTaskStore`; on a failed
  write, roll the task back to its pre-drag column.
- **Minimal weekly recurrence:** `recurs_weekly` (boolean) and `weekday` (smallint 0-6,
  nullable) on `Tasks`. A row with `recurs_weekly = true` is a **template**, not a work item —
  it never appears on the board and is never completed. Each week it generates an **instance**
  (an ordinary task carrying `recurrence_template_id` FK + `occurrence_date`) that's what you
  drag, complete, and see. Without this split, completing a recurring task would destroy the
  rule that regenerates it.
  - Regeneration is **check-on-load** (no cron): on `fetchTasks`, ensure an instance exists for
    the current Monday-start week — generates the whole week at once, not just the current day,
    so Monday shows the full week ahead (what the Dashboard's schedule panel reads).
  - Idempotency is enforced in the DB via a unique index on (`recurrence_template_id`,
    `occurrence_date`), not application logic.
  - Instances land in `todo`, not `inbox` — a fixed schedule block is already triaged.

**Prep Tracker — `PrepEntries` and `BehavioralStories`:**

- `PrepEntries`: `id`, `entry_type` (enum: `algorithm` / `system_design` / `ml_system_design` /
  `behavioral` / `mock_interview`), `topic` (text, nullable), `date`, `duration_min` (nullable),
  `time_to_solve_min` (nullable, algorithm only), `outcome` (enum, scoped per type: algorithm =
  `solved`/`partial`/`failed`, everything else = `pass`/`needs_work`), `notes`, `deleted_at`,
  `created_at`/`updated_at`.
- `BehavioralStories`: `id`, `title`, `theme`, `concise_version`, `extended_version`,
  `deleted_at`, `created_at`/`updated_at`.
- Fires `prep.logged` on every new entry so the Dashboard can update running totals without
  querying this module's table directly.
- No nesting, no self-joins — the simplest schema of the five MVP modules.
- **Roadmap checkpoint targets** (added once `engineering_first_roadmap_v2.md` landed): two
  cumulative-since-July checkpoints with unambiguous, schema-mappable numbers — December 2026
  (75–100 algorithm problems, 6+ system-design, 2+ ML-system-design, 14 combined mock
  interviews) and February 2027 (150+/10+/5+ plus 8 behavioral stories). Two roadmap numbers
  were deliberately **not** encoded because they don't map onto the schema as it stands: §11.3's
  interview-prep time-allocation percentages, and per-month mock-interview subtypes — both
  addressed in Wave 2 Part B, Phase 3.

**Job Application CRM — `Companies`, `Applications`, `Interviews`:**

- `Companies`: `id`, `name`, `tier` (enum: `reach`/`match`/`safety`), `notes`.
- `Applications`: `id`, `company_id` (FK), `role_title`, `resume_variant` (enum:
  `swe_backend`/`mle_ml_infra`), `stage` (enum: `researching`/`applied`/`oa`/`phone_screen`/
  `onsite`/`offer`/`rejected`/`withdrawn`), `applied_date`, `last_update_date`,
  `referral_source`, `follow_up_date`, `deleted_at`.
- `Interviews`: `id`, `application_id` (FK), `round_type` (enum: `coding`/`system_design`/
  `ml_system_design`/`behavioral`/`other`), `scheduled_at`, `completed` (boolean), `outcome`,
  `post_mortem_notes`, `deleted_at`.
- Fires `application.stage_changed` on every stage transition, and `interview.completed` when
  `completed` flips to `true` — the Dashboard uses the latter for "log a post-mortem" reminders.
- `Interviews` here are real interviews tied to an application; `PrepEntries` (entry_type
  `mock_interview`) are practice reps. Kept as separate tables on purpose — don't conflate a
  mock with a real interview round.

**Outreach Log — `OutreachLog`:**

- `id`, `contact_name` (nullable), `company_id` (FK, nullable — a conversation doesn't always
  map to a target company), `channel` (enum: `linkedin`/`email`/`alumni_network`/
  `professor_referral`/`other`), `date`, `notes`, `deleted_at`.
- Own table, own tiny store — small enough to look like it belongs inside Job CRM, but it isn't
  one: "No God Tables" means it doesn't get bolted onto `Applications` as an optional field.
- No Event Bus type — nothing downstream reacts to a logged conversation the way the Dashboard
  reacts to `interview.completed`; the Dashboard's weekly-cadence panel reads this table
  directly, the same "no new repository, aggregate via the others'" pattern the Dashboard
  already follows elsewhere.

**Daily Dashboard:**

- No new tables — pure read-aggregation. Subscribes to `task.completed`,
  `application.stage_changed`, `interview.completed`, and `prep.logged` to stay current without
  polling.
- Panels: this week's recurring schedule blocks, applications needing follow-up
  (`follow_up_date` today-or-earlier or no update in >7 days), running scorecard totals vs. the
  roadmap's monthly/checkpoint targets, current month's gate checklist (a parent Task with
  subtasks), and a **weekly-cadence panel** (applications/outreach/mock-interviews this week vs.
  §11.2's weekly targets — distinct from the monthly scorecard, since a week behind on cadence
  can still be on pace for the month).

**V2 — sketched so the shape exists when picked up, not part of the current build:**

- **Knowledge Base:** `Notes` (id, title, body markdown, soft-delete) + `NoteLinks`
  (self-referencing many-to-many join — a link is directional at the row level but
  bi-directional at the query level; self-links rejected at the repository layer).
- **Global Command Palette:** no dedicated table — a runtime, in-memory registry. Each module
  registers `{ id, label, keywords, action }` entries with a shell-level index on mount; `id`
  namespaced per module so two modules can't collide.
- **Finance Tracker:** `Ledger` table (`amount`, `category`, `date`, `type`).

### A.3 Roadmap-Derived Targets and Gaps

`engineering_first_roadmap_v2.md` landed in the repo root on 2026-07-13. This is what changed
once the actual document (not fragments quoted secondhand) was available.

**Scope boundary — read this first.** The roadmap's actual engineering substance is two
standalone projects: an independent RAG retrieval/evaluation system (§6.3, §7) and an RL sidecar
policy (§6.4, §7), each with its own repo and stack (not this one). **MyHub does not contain
either project.** MyHub's job is unchanged: track the schedule, prep reps, and job search that
surround them.

**What's already correctly covered, confirmed word-for-word against the source:**

- Task Engine's weekly recurrence → §14's weekly schedule.
- Prep Tracker's five `entry_type`s and post-mortem notes → §6.1/§11.2's diagnostics and the
  24-hour post-mortem habit.
- Job CRM's company tiers, pipeline stages, and interview tracking → §6.2/§11's reach/match/
  safety tiers and application funnel.
- The Dashboard's gate-checklist panel → §6.5's monthly gates.
- Finance Tracker staying V2 → §2/§5 explicitly assume no income and "preserve liquidity" during
  the Master's year; relevant at graduation (Jun 2027+), not now.

**Real gaps closed by Wave 1's Outreach Log + Dashboard weekly-cadence panel:**

1. Prep Tracker had no targets to compare against — now it does (checkpoint targets, A.2).
2. No weekly-cadence tracking existed — §11.2 sets three _weekly_, not monthly, targets
   (5–10 applications, 2–3 outreach, 1 mock interview) — now tracked.
3. No table tracked outreach/referral conversations — now the Outreach Log.
4. No bulk-seed path for the weekly schedule or gate checklists — `scripts/seedWeeklySchedule.ts`
   and `scripts/seedGateChecklists.ts` now exist.

**Explicitly not added, and why:**

- **No Quant/Finance tracking module.** §13 explicitly wants this activity _unstructured_ — "no
  scheduled study blocks, no project deliverables tied to it" — so instrumenting it would work
  against the roadmap's own intent.
- **No Blog/External-Credibility CMS module.** §6.5's March 2027 gate needs _one_ item completed
  — a single subtask under that month's gate checklist covers it.
- **No RAG/RL project code, dashboards, or experiment tracking inside MyHub** — see the scope
  boundary above.

### A.4 Additional Architecture Decisions

- **Sync/offline strategy** — never explicitly decided as a standalone question; what got built
  in practice is optimistic-update-plus-rollback (every store: apply the change locally, write
  to Supabase, roll back on failure). No Supabase realtime subscriptions in use.
- **Backup/export** — ✅ done. `scripts/exportData.ts` (`npm run backup`) dumps every module's
  active rows to JSON, one file per table, into a gitignored `backups/<timestamp>/` directory;
  skips tables that don't exist yet in a given environment rather than failing.
- **Notifications/reminders** — not in MVP scope; still not built.
- **Approved dependency list** — maintained in `CLAUDE.md` and `AGENTS.md`, kept in sync
  (updated together in the same commit whenever a new dependency is approved — `tsx` was added
  this way for the one-off setup scripts).

---

## PART B — Wave 2: Momentum, Rituals, and Roadmap Depth (✅ SHIPPED)

> **All eight phases are built, tested and merged.** What follows is the plan as written, kept as
> the design record — it is NOT a to-do list. Where the implementation diverged from the plan, the
> commit messages carry the reasoning.
>
> Notable corrections made during the build, worth knowing before touching this code:
>
> - **Streaks have a grace day.** `computeStreak` counts a run ending today _or yesterday_. Ending
>   it strictly at today flashes a demoralizing 0 every morning before you've had a chance to log.
> - **Timestamps convert via `format()`, never `.slice(0, 10)`.** The latter reads the UTC date, so
>   finishing a task at 9pm in UTC+7 would credit tomorrow and silently break the streak you earned.
>   This bug class recurred repeatedly; grep for it before adding date logic.
> - **Archiving is not deleting.** Deleting a completed task erases it from the streak; archiving
>   keeps `completed_at` alive. Delete used to be the only way to tidy the board, which meant
>   tidying silently rewrote your history (migration `0013`).
> - **Absence is never a number.** Rates return `null`, not `0`, when nothing has been sent — and
>   the UI renders that as "—". A card showing a zero or an em-dash must never be tinted; it
>   highlights _absence_. Three components made this mistake and were fixed.

### Context

Wave 2 makes MyHub **actively assist and motivate** the `engineering_first_roadmap_v2.md`
job-search journey rather than passively record it: gamification (streaks + achievements),
depth features mined from the roadmap's own targets, and single-user auth. Written so Claude
(architect: schema, contracts, correctness-critical domain logic) and Codex (implementer: UI,
wiring, mocks, E2E) can execute each phase without further design work.

**User decisions (locked):** streaks + achievements, **no** XP/levels · minimal single-user
Supabase Auth + RLS this wave · **both** prep schema extensions (mock_subtype +
resume_deep_dive).

**Out of scope:** XP/levels · confetti/animation libraries (CSS keyframes only) · Knowledge Base
· Command Palette · React Query · multi-user / `user_id` columns · stage-history table.

**Workflow:** contract-first, per the Operating Model above. Each phase lands with the full
gate green: `npm run lint && npm run typecheck && npm run test && npm run test:ui`, and gets a
`docs/handoff/<name>.md` brief when execution starts (established pattern — see the existing
briefs under `docs/handoff/`).

### Facts verified against the code during planning

- **No shared shell.** Only Task has `Sidebar.tsx` (`src/modules/task/components/Sidebar.tsx`);
  PrepTracker, JobApplicationCrm, OutreachLog, and DailyDashboard each duplicate an inline
  `<aside>` (e.g. `DailyDashboard.tsx:98`). No shared ProgressBar/StatCard/Badge — `ProgressBar`
  is a local function inside `DailyDashboard.tsx:17`.
- **No completion timestamps** on tasks or interviews. Clean per-day dates exist only on
  `prep_entries.date` and `outreach_log.date`; `applications` has `createdAt` (used by
  `weeklyCadence`).
- **`completed_at` on tasks touches five repo writes** in `TaskRepository.ts`:
  `updateTaskStatus` (331), `moveTask` (286), `completeDescendants` (381),
  `autoCompleteAncestors` (393), `revertAncestorsToIncomplete` (420) — **plus** the store's
  optimistic mirrors in `useTaskStore.ts`: `applyStatusCascade` (117), `completeDoneAncestors`
  (66), `completeTaskDescendants` (110), `revertDoneAncestors` (93).
- **Prep outcome CHECK already admits `resume_deep_dive`** (`0003_prep_tracker.sql:44` — the
  non-algorithm branch is `entry_type <> 'algorithm'`), so no constraint edit is needed for the
  new type, only the enum `ADD VALUE`.
- **`prepTargets.ts` already flags both Phase 3 features as deferred** (its scope note, lines
  10-24: §11.3 allocation and mock subtypes). Phase 3 resolves exactly what that note defers.
- **Playwright mocks intercept `**/rest/v1/**`.** Task specs route `**/rest/v1/tasks*` +
  `**/rest/v1/rpc/*`; prep/job mocks route per-table. Specs import `test` from
  `@playwright/test` directly — there is no shared fixture yet. `webServer` is `next dev` with
  no Supabase proxy, so **any unrouted `**/rest/v1/**` request hits a 404** (this is why Phase 5
  needs a baseline fixture — see below).
- **Event union members all carry `timestamp: number`** (`events.ts`) — `outreach.logged` must
  too. The dashboard store documents an "Accepted gap" (`useDashboardStore.ts:81`) that
  `outreach.logged` closes; the outreach store currently imports no `emit`.
- **Scripts use the anon key** (`supabaseClient.ts:4`); no `SERVICE_ROLE` anywhere yet.
- **Cross-module _pure-function_ imports are established precedent** — `dashboardSelectors.ts`
  imports `PrepEntry`/`Application`/`Interview`/`OutreachEntry` types and is designed to import
  `prepScorecard`/`prepTargets` pure logic (lines 84-90). Stores/components are not
  cross-imported. Momentum and Review follow this: repositories + pure logic only.
- **`ALTER TYPE ... ADD VALUE`** cannot be referenced in the same migration file that adds it —
  its file must contain nothing that reads the new value.

### Dependency shape

```
P1 AppShell + UI primitives ──┬─────────────────────────────┐
   (no migration)             │                             │
                              P2 completed_at (0007) ───┐    │
P3 Prep depth (0008) ─────────┤ (parallel with P4)      │    │
P4 CRM depth (0009) ──────────┴──────────┐              │    │
   (notes, timestamps, funnel)           │              │    │
                                         ▼              ▼    ▼
                              P5 Momentum (0010) ◄── needs P1+P2+P4
                                 streaks · achievements · fixtures.ts
                                         │
                              P6 Weekly Review (0011) ◄── needs P1
                                         │
                              P7 Auth + RLS (0012) ◄── extends P5's fixtures.ts
                                 (last-but-one: RLS over all 9 tables at once)
                                         │
                              P8 Offer evaluator (no migration, defer freely)
```

Migrations run **0007→0012 in order** in the Supabase SQL editor, each once (same procedure as
0002-0006). The two `ALTER TYPE` files (0008's `prep_entry_type`, and none other) must not be
wrapped with statements referencing the new value.

---

### Phase 1 — Shared AppShell + UI primitives (refactor, no migration)

Lands first so the Phase 5 streak indicator, Phase 7 sign-out, and Phase 5/6/8 nav links are
each a one-line change instead of five.

| File                                      | Owner  | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/appNav.ts` (new)          | Claude | `NavItem { href; label }` + `NAV_ITEMS`: Dashboard `/dashboard`, Task Engine `/`, Prep Tracker `/prep`, Job CRM `/applications`, Outreach Log `/outreach`. Later phases append here only.                                                                                                                                                                                                                                                                           |
| `src/components/AppShell.tsx` (new)       | Codex  | Client component, props `{ title; activeHref; children }`. Copy `Sidebar.tsx` markup/classes **verbatim**; render nav from `NAV_ITEMS` with `aria-current="page"` on the active link; ThemeToggle in the `lg:mt-auto` slot; a commented placeholder above ThemeToggle where Phase 5 mounts `StreakIndicator` and Phase 7 mounts sign-out. Shell→module imports are allowed (rule 1 governs module→module; mirror the boundary note from `useDashboardStore.ts:50`). |
| `src/components/ui/ProgressBar.tsx` (new) | Codex  | Lift the local `ProgressBar` out of `DailyDashboard.tsx:17` **unchanged**; re-import it there.                                                                                                                                                                                                                                                                                                                                                                      |
| `src/components/ui/StatCard.tsx` (new)    | Codex  | Extract the repeated stat-tile pattern (BoardHeader, PrepScorecard, cadence/target cards). Props `{ label; value; hint?; tone?: "default"                                                                                                                                                                                                                                                                                                                           | "accent" | "danger" }`. |
| `src/components/ui/Badge.tsx` (new)       | Codex  | Extract the pill pattern. Props `{ children; tone?: "neutral"                                                                                                                                                                                                                                                                                                                                                                                                       | "accent" | "danger"     | "success" }`. |
| Migrate 5 pages                           | Codex  | TaskBoard (then delete `Sidebar.tsx`), PrepTracker, JobApplicationCrm, OutreachLog, DailyDashboard each wrap content in `<AppShell>` and delete their inline `<aside>`.                                                                                                                                                                                                                                                                                             |

**Tests:** the existing 30 Playwright specs are the regression gate — must pass **unmodified**.
DOM stays structurally identical (same tags, same accessible names). `theme.spec.ts` queries the
`aside`/nav and the `role="group" name="Theme"` — do **not** "improve" visuals during
extraction. No new unit tests.

### Phase 2 — Task completion timestamps (Momentum foundation)

**Migration `0007_task_completed_at.sql` (Claude):** `alter table tasks add column completed_at
timestamptz;` + best-effort backfill `update tasks set completed_at = updated_at where status =
'done';` + partial index `(completed_at) where deleted_at is null and completed_at is not null`.

**Claude — one commit** (repo cascades and store mirrors must stay in lockstep):

- `types.ts`: `Task.completedAt: string | null`.
- `TaskRepository.ts`: `fromRow` maps `completed_at`; `updateTaskStatus`/`moveTask` set
  `completed_at: status === "done" ? now : null` whenever status changes; `completeDescendants`
  stamps `completed_at` **and** adds `.neq("status", "done")` so already-done descendants keep
  their original timestamps; `autoCompleteAncestors` stamps; `revertAncestorsToIncomplete` nulls.
- `useTaskStore.ts`: the four optimistic mirrors set/clear `completedAt` to match. Exact value
  need not equal the server's (refetch reconciles) but **null-ness must** match.
- Extend `useTaskStore.test.ts` / `TaskRepository.test.ts`: done→descendants stamped;
  leaving done→cleared; already-done descendant keeps its timestamp.

**Codex:** `tests/ui/supabaseTasksMock.ts` — add `completed_at` to `TaskRow` **and** the `row()`
defaults (its comment at line 27 already warns a missing column stringifies to `"undefined"` and
breaks `eq` filters); one E2E in `task-cascade.spec.ts` asserting PATCH bodies set/clear
`completed_at`.

### Phase 3 — Prep depth (mock subtypes + resume_deep_dive + §11.3 time allocation)

**Migration `0008_prep_subtypes.sql` (Claude):** `create type mock_subtype as enum ('coding',
'system_design', 'ml_system_design');` + nullable `prep_entries.mock_subtype` + CHECK
`mock_subtype is null or entry_type = 'mock_interview'`; **and** `alter type prep_entry_type add
value 'resume_deep_dive';`. Nothing in this file may reference the new enum value (Postgres
constraint). The existing outcome CHECK already covers `resume_deep_dive` (non-algorithm ⇒
pass/needs_work) — no edit needed.

**Claude — domain logic + tests:**

- `prep/types.ts`: add `resume_deep_dive` to `PrepEntryType`; `MockSubtype` type;
  `PrepEntry.mockSubtype: MockSubtype | null`.
- `prepScorecard.ts`: add `resume_deep_dive: 0` to `EMPTY_COUNTS` (typecheck ripples to every
  `CountsByType` consumer — that's the intended safety net).
- `prepTargets.ts`: `DECEMBER_2026_CHECKPOINT` gains `bySubtype: { coding: 6, system_design: 6,
ml_system_design: 2 }`; new `mockSubtypeProgress(entries, checkpoint)` returning per-subtype
  `TargetProgress` + an `unclassified` count. **Legacy NULL-subtype mocks count toward the
  combined `mockInterview.min` (14) and surface as `unclassified` — never silently credited to a
  subtype.** Tests include the legacy-NULL path.
- `prepAllocation.ts` (new, pure): `TARGET_ALLOCATION = { algorithm: .35, system_design: .25,
behavioral: .15, ml_system_design: .15, resume_deep_dive: .10 }`; `timeAllocation(entries,
fromDate?)` summing `durationMin` per area. **`mock_interview` entries are excluded from both
  numerator and denominator** (§11.3's table has no mock row); `actualPct` is `null` when the
  total is 0. Tests: date filter, mock exclusion, zero-denominator.

**Codex:** repo/store `mock_subtype` round-trip (`PrepRepository`, `usePrepStore`);
`PrepEntryForm` adds a "Resume deep-dive" type option + a subtype `<select>` shown only when
`type === "mock_interview"`; `TimeAllocationPanel` (per-area actual% vs target% with
`ProgressBar` + a "mock-interview time excluded (§11.3)" note); the December card shows x/6, x/6,
x/2 plus "n unclassified mocks" when `n > 0`; a subtype `Badge` in `PrepEntryList`; extend
`supabasePrepMock.ts` + `prep-tracker.spec.ts` (log a mock with a subtype; log a deep-dive;
allocation renders).

### Phase 4 — Job CRM depth (notes, rejection nudge, funnel stats, interview timestamps)

**Migration `0009_crm_notes_and_interview_timestamps.sql` (Claude):** `applications.notes text`;
`interviews.completed_at timestamptz`; `interviews.post_mortem_logged_at timestamptz` — with
best-effort backfills from `updated_at`. These make Phase 5's "post-mortem within 24h"
achievement computable from stored data rather than reconstructed.

**Claude:**

- `funnelStats.ts` (new, pure, tested): `byStage` counts; `pastApplied` (stage !==
  `researching`); `responseRate`/`interviewRate`/`offerRate`, all **`null` (never 0)** when
  `pastApplied === 0`. "Responded" = stage in `{oa, phone_screen, onsite, offer}` **OR** has ≥1
  interview — this catches rejected-after-response applications a current-stage-only read would
  misclassify as ghosted.
- `types.ts`: `Application.notes`; `Interview.completedAt` / `Interview.postMortemLoggedAt`;
  `UpdateInterviewInput` gains optional `completedAt` / `postMortemLoggedAt` (mapped in
  `toRow`). **The transition logic lives in `useApplicationStore.ts`, not the repository** — the
  store already observes `completed` false→true to emit `interview.completed`, so it also
  computes `completedAt = now()` on that flip (null on uncheck) and `postMortemLoggedAt = now()`
  when notes go empty→non-empty, **never overwritten once set**; the repository has no
  previous-state knowledge and stays a dumb writer. Publish this in the `InterviewRepository`/
  store contract.

**Codex:** notes + timestamp wiring; `ApplicationForm` notes `<textarea>`; **rejection nudge** —
when an application's stage moves to `rejected` and its notes lack a takeaway, an inline
dismissible prompt on that card ("§11.2: log one specific, actionable takeaway from this
rejection") that appends `Rejection takeaway: …` to notes and reappears while empty;
`FunnelPanel.tsx` above the pipeline (stage counts + three rate `StatCard`s rendering `—` for
null, **never "0%"**); extend `supabaseJobMock.ts` + `job-crm.spec.ts` (move to rejected → nudge
→ save → gone; funnel numbers on a seeded fixture).

### Phase 5 — Momentum module (streaks + achievements) ★ the centerpiece

New `src/modules/momentum/`. Depends on Phase 1 (shell slot), Phase 2 (`completedAt`), Phase 4
(`postMortemLoggedAt`). Reads other modules via **repositories only** (rule 1) and pure logic.

**Migration `0010_achievements.sql` (Claude):** `achievements` table (id, key text, unlocked_at,
deleted_at, created_at, updated_at) + **partial unique index on `(key) where deleted_at is
null`** (idempotency backstop that still honors soft deletes — same lesson as recurrence's
`tasks_one_instance_per_occurrence`) + `set_updated_at` trigger.

**Event bus (Claude):** add `{ type: "outreach.logged"; payload: { entryId: string };
timestamp: number }` to the `AppEvent` union (closes the `useDashboardStore.ts:81` accepted
gap). Codex emits it from `useOutreachStore.createEntry` (one `import` + one `emit` line). No
`achievement.unlocked` event — toasts are momentum-store state.

**Claude — pure date-math core, all vitest-covered:**

- `streaks.ts`: `activityDates({ prepEntries, tasks, applications, outreachEntries }) →
Set<yyyy-MM-dd>`. An active day = a prep entry dated that day OR a task completed OR an
  application created OR outreach logged. Prep/outreach `date` are used as-is;
  `completedAt`/`createdAt` timestamps convert via `format(new Date(ts), "yyyy-MM-dd")` (local
  wall clock, matching `weekBounds` — **not** `.slice(0,10)`, which is UTC; document the
  deliberate difference). `computeStreak(activeDays, today) → { current; longest; activeToday }`
  — `current` counts a streak ending **today or yesterday** (grace: the flame survives midnight
  until you've had a chance to log).
- `achievementCatalog.ts`: ~22 achievements, **every number traceable to the roadmap**, each
  `{ key; title; description; category: "prep"|"career"|"consistency" }`:
  `first_prep_entry` · `algorithms_10/50/75/100/150` (75-100 = §6.5 Dec, 150 = Feb) ·
  `system_design_6/10` · `ml_system_design_5` · `first_mock` · `mocks_14` ("Full Mock Slate";
  Dec 6+6+2, legacy-NULL counts) · `behavioral_stories_8` ("Story Bank") · `first_application` ·
  `applications_10/50` · `first_outreach` · `first_interview` · `post_mortem_24h` ("Fresh
  Post-Mortem": `postMortemLoggedAt − scheduledAt ≤ 24h`) · `perfect_cadence_week` ("Perfect
  Week": any **completed** Mon-Sun week — past weeks only, so it's stable — with ≥5 apps + ≥2
  outreach + ≥1 mock) · `gate_complete` ("Gate Cleared": a `Gate: <Month> <Year>` task done with
  ≥1 subtask, all done — **duplicate the tiny title predicate locally** with a comment; do not
  import `dashboardSelectors`, rule 1) · `streak_7/30/100` (longest ≥ N).
- `achievementEngine.ts`: `evaluateAchievements(snapshot) → AchievementKey[]` (pure) +
  `newUnlocks(earned, persistedSet)`. Exhaustive boundary tests: N−1/N per rule; perfect-week
  excludes the current week; NULL-subtype mocks count toward `mocks_14`; no re-emission.

**Claude — contracts + store idempotency core:**

- `MomentumRepository.ts`: `getUnlocks()`; `insertUnlocks(keys)` via `upsert(rows, { onConflict:
"key", ignoreDuplicates: true })` (DB-level backstop).
- `useMomentumStore.ts`: `{ streak; unlocked; pendingToasts; isLoading; error; refresh;
dismissToast; subscribeToUpdates }`. **Three-layer idempotency (Claude implements):** (a) an
  in-flight guard dropping re-entrant `refresh` calls; (b) the diff-set updated _synchronously_
  before the insert `await`, so a racing refresh can't double-queue a toast; (c) the DB
  ignore-duplicates upsert. `refresh` swallows errors per rule 6 (`console.error`, generic).
  `subscribeToUpdates` listens to `task.completed`, `prep.logged`, `application.stage_changed`,
  `interview.completed`, `outreach.logged`. Fetch pattern mirrors `useDashboardStore.fetchAll`
  (`Promise.all` across repositories).

**Codex — UI + tests:**

- `StreakIndicator.tsx`: compact "🔥 n-day streak" in the AppShell rail slot — accent-strong when
  `activeToday`, dimmed otherwise. **AppShell mounts the momentum store's `refresh` +
  `subscribeToUpdates` once** (it's the only always-mounted client component).
- `UnlockToaster.tsx`: fixed bottom-right stack of `pendingToasts`, auto-dismiss ~6s, slide-up +
  scale-pop entrance via a Tailwind keyframe added to `app/globals.css` (CSS only, no deps).
- `AchievementsPage.tsx` + `app/achievements/page.tsx` + a `NAV_ITEMS` entry: trophy grid grouped
  by category (unlocked = accent card with date; locked = dimmed with description); header
  `StatCard`s for current streak, longest streak, n/22 unlocked.
- **`tests/ui/fixtures.ts` (new — pulled forward from Phase 7 because AppShell now mounts
  the momentum store on _every_ page):** a Playwright `test` extended with an automatic
  before-each that installs a **baseline catch-all** `page.route("**/rest/v1/**", …)` returning
  `[]` for GET and success for POST/PATCH. Because fixture setup registers first and each spec's
  specific routes register later (last-registered wins in Playwright), specific table mocks still
  take precedence, while momentum's otherwise-unrouted fetches (prep_entries, applications,
  outreach_log, achievements) resolve to `[]` → streak 0, no toast → **existing specs pass
  unchanged in behavior**. Migrate all spec files to import `test` from `./fixtures` (~7 files,
  mechanical). Phase 7 extends this same fixture with auth.
- `tests/ui/supabaseMomentumMock.ts` (honoring ignore-duplicates upsert) + `momentum.spec.ts`:
  cross a threshold → toast once → one POST → trophy shows unlocked; reload → no duplicate toast.

### Phase 6 — Weekly Review ritual (§14 Sunday block + §15 quarterly questions)

**Migration `0011_weekly_reviews.sql` (Claude):** `weekly_reviews` (id, week_start date,
went_well/needs_work/next_week_fix text, quarterly_answers jsonb null, snapshot jsonb not null,
soft-delete + audit columns) + partial unique index on `(week_start) where deleted_at is null` +
trigger.

**Claude:** `src/modules/review/reviewLogic.ts` (pure, tested): `weekStartOf(today)` (Monday,
same convention as `weekBounds`); `isQuarterBoundaryWeek(weekStart)` (week contains the last day
of Mar/Jun/Sep/Dec — boundary tests incl. cross-quarter weeks); `QUARTERLY_QUESTIONS` (the five
§15 questions verbatim); typed `WeeklyReviewSnapshot { cadence; scorecard; checkpoint }` +
`buildSnapshot(...)` composing **existing** selectors (`weeklyCadence`, `scorecardFor`,
`progressTowardCheckpoint` — reuse, don't reimplement; cross-module pure imports follow the
dashboard→prep precedent). Publish `ReviewRepository` (`getReviews`, `getReviewForWeek`,
`upsertReview` with `onConflict: "week_start"`) + `useReviewStore` contracts.

**Codex:** wiring; `app/review/page.tsx` + `WeeklyReview.tsx` + `NAV_ITEMS` entry: (1) "This
week" actuals fetched via repositories (**not** `useDashboardStore`); (2) a reflection form —
three textareas (went well / needs work / one fix) plus the five quarterly questions **only on
boundary weeks**; save captures `buildSnapshot` at click time; (3) a past-reviews list showing
the frozen snapshot numbers (history survives later data edits). Mock + `weekly-review.spec.ts`
(save → listed; re-save → upsert not duplicate; quarterly questions hidden off-boundary).

### Phase 7 — Auth + RLS (deliberately last-but-one; touches every spec)

**Migration `0012_enable_rls.sql` (Claude):** enable RLS + a `for all to authenticated using
(true) with check (true)` policy on **all nine tables** (tasks, prep_entries,
behavioral_stories, companies, applications, interviews, outreach_log, achievements,
weekly_reviews). No `user_id` columns (single-user). Comment: `task_descendant_ids` RPC is
SECURITY INVOKER, so RLS applies through it.

**Claude:** `src/lib/auth.ts` — `getSession` / `signIn` / `signOut` / `onAuthChange` wrapping
`supabase.auth` (keeps auth calls out of components). Design the E2E auth-mock strategy below.

**Codex:**

- `app/login/page.tsx` + `LoginForm` (**not** in AppShell; generic error per rule 6; redirect to
  `/dashboard` on success); `AuthGate.tsx` mounted inside AppShell (`getSession` on mount → no
  session → `router.replace("/login")`; render children only with a session; `onAuthChange`
  handles sign-out redirect); sign-out button in the rail slot Phase 1 reserved.
- **E2E (same commit as AuthGate):** extend `tests/ui/fixtures.ts` (from Phase 5) — `mockAuth`
  seeds `localStorage["sb-<project-ref>-auth-token"]` (ref derived from
  `NEXT_PUBLIC_SUPABASE_URL`, not hardcoded) with a fake non-expired session **and** routes
  `**/auth/v1/**` to return it (so refresh attempts never hit the network). The fixture applies it
  automatically, so every migrated spec keeps passing. New `auth.spec.ts`: no session →
  `/login` redirect; failed login → generic message; assert `getSession()` resolves (pins the
  storage-key shape so a supabase-js upgrade fails loudly).
- Scripts: `scripts/exportData.ts` and the seed scripts build their client with
  `SUPABASE_SERVICE_ROLE_KEY` when present (anon fallback prints an RLS warning); document in
  README. Optional `scripts/createUser.ts` (service-role `auth.admin.createUser`) so the single
  account is one command.

### Phase 8 — Offer evaluator (§12.1, smallest, defer freely)

No migration/table/store. **Claude:** `src/modules/offers/offerScore.ts` contract —
`OFFER_FACTORS` (learning_rate 20, tc 20, equity_quality 15, scope 15, team 10, depth 10, brand 10) + `offerScore(ratings: Record<FactorKey, 1-10>)` weighted average. **Codex:** implementation

- vitest (weights sum to 100; boundaries), `OfferEvaluator` page + `NAV_ITEMS` entry — 2-3 offer
  columns of seven 1-10 selects, live score per column, highest highlighted with an accent
  `Badge`, "Don't choose on salary alone" as a muted footer. localStorage persistence optional.

---

### Sequencing & workload

| Phase                | Migration | Claude                                                                               | Codex                                                                      |
| -------------------- | --------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1 Shell + primitives | —         | `appNav` contract                                                                    | AppShell, 3 primitives, 5-page migration, regression run                   |
| 2 completed_at       | 0007      | migration + both cascade edits + tests                                               | mock `TaskRow`, E2E                                                        |
| 3 Prep depth         | 0008      | migration, targets/allocation logic + tests                                          | wiring, form, panels, mocks, E2E                                           |
| 4 CRM depth          | 0009      | migration, `funnelStats` + tests, store timestamp logic                              | wiring, nudge, funnel panel, E2E                                           |
| 5 Momentum           | 0010      | migration, `outreach.logged`, streaks/catalog/engine + tests, store idempotency core | wiring, StreakIndicator, Toaster, trophy page, **fixtures.ts**, mocks, E2E |
| 6 Weekly Review      | 0011      | migration, `reviewLogic` + tests, contracts                                          | wiring, `/review` page, mocks, E2E                                         |
| 7 Auth + RLS         | 0012      | migration, `auth.ts`, E2E-mock design                                                | `/login`, AuthGate, fixture auth extension, scripts, E2E                   |
| 8 Offers             | —         | `offerScore` contract                                                                | everything else                                                            |

**Phase 3 and Phase 4 are parallel-safe** (no shared files). **Phase 5 needs Phase 1+2+4.**
Phase 7 goes last-but-one so it lands RLS once over all nine tables and is the only phase after
Phase 5 that changes every spec's _auth_ posture (Phase 5 already migrated them to the shared
fixture).

### Verification (per phase + end-to-end)

1. Every phase: `npm run lint && npm run typecheck && npm run test && npm run test:ui` green.
2. **After Phase 2:** complete a parent task in the running app → its PATCH includes
   `completed_at`; drag it out of Done → `completed_at` nulled (check the network tab /
   Supabase row).
3. **After Phase 5 (the demo that matters):** log a prep entry in the running app → the streak
   flame updates in the rail; cross `first_prep_entry` → a toast appears **exactly once**, the
   trophy page shows it, and a reload produces **no** duplicate toast; the `achievements` row is
   visible in the Supabase table editor.
4. **After Phase 7:** open the app logged-out → `/login` redirect; log in once → everything
   works; `npm run backup` with `SUPABASE_SERVICE_ROLE_KEY` set → export succeeds; confirm in
   the Supabase dashboard that an anon-key REST request **without a session returns zero rows**.
5. Migrations 0007-0012 applied in the Supabase SQL editor in order, each run once (0008's
   `ALTER TYPE` file kept free of statements referencing the new value).

### Critical files (most-touched / highest-risk)

- `src/modules/task/TaskRepository.ts` + `useTaskStore.ts` — five repo writes + four store
  mirrors, all touched by Phase 2's `completed_at`.
- `src/lib/events.ts` — `outreach.logged` addition (Phase 5).
- `src/modules/dashboard/dashboardSelectors.ts` — `weekBounds`/`weeklyCadence` patterns reused
  (not imported) by streaks, the review snapshot, and perfect-week (Phase 5/6).
- `src/modules/prep/prepTargets.ts` — per-subtype December targets with legacy-NULL handling
  (Phase 3; its existing scope note is the spec for exactly this work).
- `tests/ui/fixtures.ts` (new in Phase 5) — the shared baseline+auth fixture every spec
  migrates to; the linchpin that keeps the always-mounted momentum store and Phase 7 auth from
  breaking all 30+ specs at once.
