# Software Engineering Blueprint: MyHub

_(The Personal Master App — codename "MyHub". Suggested repo name: `myhub` or `my-hub`.)_

> **Pivot note (2026-07-12):** This plan was originally optimized for **learning surface
> area** — hands-on schema design and state management reps — over speed-to-daily-use. That
> priority has flipped. The goal now is finishing MyHub as fast as responsibly possible, because
> the human is shifting full bandwidth to an external Master's/job-search project. Implementation
> is now **fully delegated to Claude Code and Codex, with no human first-pass and no human
> line-by-line PR review**. Every "write this yourself" instruction from the original plan has
> been removed below; where it mattered functionally (not just as a learning device), it's been
> replaced with an automated substitute — see Phase 3.4.

Since this is a multi-featured app for a single user, traditional enterprise constraints
(scaling, multi-tenant security) are replaced by a different constraint: **Developer Sanity** —
specifically, keeping a solo-directed, multi-agent build from drifting into inconsistent
architecture. Speed is now the explicit priority; the modular-monolith discipline below exists
to keep two concurrent agents from producing an unmaintainable mess while moving fast, not to
manufacture learning exercises.

To survive building a large app solo with the assistance of AI coding agents (Claude Code,
Codex, and others), the project is strictly separated into three lifecycles: Brainstorming,
Design, and Implementation.

---

## PHASE 1: Brainstorming & Scope Definition

The goal of this phase is to dump every idea onto paper, categorize them, and define the
Minimum Viable Product (MVP). No code is written here.

### 1.1 The "Second Brain" Modules (Full Brainstorm)

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
- **Prep Tracker (new, added 2026-07-12):** Logs algorithm problems, system-design and
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

### 1.2 Feature Triage (MVP vs. V2)

> **Reprioritization note (2026-07-12):** The original MVP (Task Engine, Knowledge Base,
> Command Palette) was chosen for architectural learning value — hardest schemas, hardest
> cross-cutting pattern. That's no longer the filter. The filter now is: **does this module
> materially help execute `engineering_first_roadmap_v2.md`?** Two modules survive that filter
> as-is (Task Engine), one gets promoted from V2 (Job Application CRM), one is new (Prep
> Tracker), and one is added specifically as a thin aggregation layer over the other three
> (Daily Dashboard). Knowledge Base and Command Palette are demoted to V2 — both are genuinely
> useful eventually, but neither has a direct line item in the roadmap the way an application
> tracker or a scorecard log does; the roadmap explicitly treats a spreadsheet/Notion as an
> acceptable stand-in for the tracker (Section 6.5), so there was no reason a personal wiki or a
> Cmd+K palette needed to exist before September applications ramp up.

**MVP:**

| Module                                                          | Why it's in the MVP now                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Task Engine** (+ minimal weekly recurrence, added 2026-07-12) | Baseline CRUD + state fundamentals, already underway. Recurrence is a new, deliberately small addition — the roadmap's weekly schedule (Section 14) repeats identically Sep 2026–May 2027; without recurrence you'd be manually re-adding the same Mon–Sun blocks every week for 9 months. Monthly "gates" (Section 6.5) can be modeled as a parent task with checklist subtasks, reusing the existing 3-level nesting — no new module needed for that. |
| **Prep Tracker (new)**                                          | Directly implements the roadmap's numeric scorecards (Section 15: coding problems solved, system-design cases, ML-system-design cases; Section 6.1's July diagnostics: solve rate, average time, weakest topics) and the 24-hour interview post-mortem habit (Section 11.2). Diagnostics start immediately (July), so this has the earliest real deadline of anything on this list.                                                                     |
| **Job Application CRM** (promoted from V2)                      | Section 11 asks for a tracked funnel by company tier (reach/match/safety), applications/week, referral conversations, and rejection reviews. Applications ramp in September (Section 6.5), so this needs to exist before then, not be built reactively.                                                                                                                                                                                                 |
| **Daily Dashboard** (promoted from V2)                          | A single read-only view: this week's schedule blocks (from Task Engine), applications needing follow-up (from Job CRM), running scorecard totals vs. this month's target (from Prep Tracker), current month's gate checklist. Cheap to build — pure aggregation, no new write logic — and it's the thing that actually makes the other three modules function as a system instead of three disconnected trackers.                                       |

**Build order:** Task Engine (in progress) → Prep Tracker → Job Application CRM → Daily
Dashboard. Prep Tracker and Job Application CRM have no shared tables or files, so they can run
as two simultaneous mini-tracks instead of strictly sequential if you want it faster — see
Phase 3.5. Dashboard has to come last since it reads from the other three.

> **Full delegation (as of 2026-07-12):** All MVP modules use spec-to-code delegation — Claude
> Code and Codex build from spec directly, in parallel, per the concurrent task board in
> Phase 3.5. There is no human first-pass requirement.

**V2 (deferred):**

- **Knowledge Base (with bi-directional linking)** — demoted 2026-07-12. Still valuable
  (storing study notes, design docs, weak-area writeups), but nothing in the roadmap requires a
  dedicated linked-notes app specifically; markdown files in the flagship project's own repo or
  any plain notes tool cover this in the meantime. Revisit once the roadmap-critical four are
  done.
- **Global Command Palette** — demoted 2026-07-12. Real daily-use value and a genuine
  architecture test, but it's a polish feature, not something with a line item in the roadmap.
  Needs the other modules to exist first anyway.
- Habit Tracker — mostly overlaps with Task Engine recurrence + Dashboard progress views once
  those exist; a separate streak-counter module is marginal on top of that.
- Calendar/Time Blocking, Focus/Pomodoro Timer
- Media/Blog CMS — relevant later for the roadmap's "technical blog post" external-credibility
  item (Section 16, March 2027), but that's ~8 months out.
- Journal
- Finance/Budget Ledger — the roadmap explicitly assumes no income during the Master's year
  (Section 5); this becomes relevant post-graduation (Jun 2027+), not now.
- Job Application CRM's original V2 placement is superseded — see MVP above.

**Optional stretch on Knowledge Base (once it's built):** add `pgvector` on Supabase for
semantic search over notes — directly reuses hybrid retrieval (BM25 + dense + GraphRAG)
background from work. Still a true stretch, now doubly so since KB itself is V2.

---

## PHASE 2: System Design & Architecture (Architecting for Agents)

When working with AI agents, the architecture must be explicit, modular, and strictly
documented so the agent doesn't hallucinate structural decisions. This matters _more_, not
less, now that no human is reading every diff.

### 2.1 Architecture: The Modular Monolith

Do not build microservices. For a solo developer, build a **Modular Monolith**.

- **The Shell:** Core app (auth, navigation, global Command Palette, global state).
- **The Modules:** Each feature is self-contained. The "Finance" module should not directly
  import internal components from the "Habit" module.
- **The Event Bus Payload Contract:** Modules communicate only via a strict Event Bus.
  - Define the exact TypeScript shape _before_ writing module code. Use a **discriminated
    union**, not `payload: unknown`:
    ```typescript
    type AppEvent =
      | {
          type: "task.completed";
          payload: { taskId: string };
          timestamp: number;
        }
      | {
          type: "note.linked";
          payload: { sourceId: string; targetId: string };
          timestamp: number;
        }
      | {
          type: "pomodoro.finished";
          payload: { durationMin: number };
          timestamp: number;
        }
      | {
          type: "application.stage_changed";
          payload: {
            applicationId: string;
            fromStage: string;
            toStage: string;
          };
          timestamp: number;
        }
      | {
          type: "interview.completed";
          payload: { interviewId: string; applicationId: string };
          timestamp: number;
        }
      | {
          type: "prep.logged";
          payload: {
            entryId: string;
            prepType:
              | "algorithm"
              | "system_design"
              | "ml_system_design"
              | "behavioral"
              | "mock_interview";
          };
          timestamp: number;
        };
    ```
    The last three were added 2026-07-12 for the Dashboard: it needs to react to stage changes,
    completed interviews (to prompt a post-mortem), and new prep entries (to update running
    scorecard totals) without importing Job CRM's or Prep Tracker's internals directly.
    A generic `unknown` payload gives every agent an excuse to shape data however's convenient
    in the moment — a discriminated union makes TypeScript itself reject malformed events
    instead of relying on agents to self-police.

**Recommended Tech Stack:**

- Framework: Next.js (App Router) or Vite + React.
- State Management: Zustand — split into **per-module stores** (`useTaskStore`, `useNoteStore`).
- Database/Backend: Supabase (PostgreSQL).
- Styling: Tailwind CSS + shadcn/ui.

### 2.2 Database Design Principles (Entity-Relationship)

- **Avoid the "God Table":** Don't create one massive `Items` table.
- **Polymorphic Tagging:** Universal tagging system (`Tags` table, `EntityTags` join table).
  Index `entity_type + entity_id` on the join table from day one.
- **Soft Deletes:** Implement a `deleted_at` timestamp column.
- **Migrations are agent-generated from spec.** Claude Code writes raw SQL DDL directly from
  the markdown schema plan for every module, MVP included — this is no longer a human
  hand-writing exercise. Review migrations via the automated checks in Phase 3.4, not a manual
  read-through.

### 2.3 Specific Module Designs

> **This section is the spec.** `CLAUDE.md` points Claude Code here directly instead of a
> separate `/specs/` folder, since no one is available to write per-module spec files by hand.
> Where a detail below is underspecified, Claude Code should extend it minimally and consistently
> with the architecture rules (Repository pattern, soft deletes, discriminated-union events, no
> God Tables) rather than pausing to ask — see `CLAUDE.md` Workflow, item 2.

**Task Engine — `Tasks` table:**

- `id` (uuid, pk), `title` (text, required), `description` (text, nullable), `status` (enum:
  `todo` / `in_progress` / `done`), `due_date` (timestamptz, nullable), `parent_task_id`
  (uuid, self-referencing FK, nullable — null means top-level task), `deleted_at` (timestamptz,
  nullable, default `NULL` — never default to `now()`), `created_at`/`updated_at` (timestamptz).
- **3-level nesting cap:** a task's depth (root = 0) must not exceed 2 (i.e. root → child →
  grandchild is the deepest allowed chain). Enforce in `TaskRepository.ts`, not just in the UI.
- **Cascade behavior:** soft-deleting a parent soft-deletes its descendants. Use a recursive CTE
  to resolve the descendant set; don't loop application-side.
- **Optimistic UI:** Kanban drag updates `status` optimistically in `useTaskStore`; on a failed
  write, roll the task back to its pre-drag column rather than leaving it in the optimistic
  state.
- **Minimal weekly recurrence (added 2026-07-12, MVP — not the same as V2's deferred
  `RecurrenceRule` idea):** add `recurs_weekly` (boolean, default `false`) and `weekday`
  (smallint 0-6, nullable) to `Tasks`. A scheduled job (or a check-on-load query — implementer's
  choice, keep it simple) regenerates a fresh instance of any `recurs_weekly` task at the start
  of its `weekday` each week. No custom intervals, no skip/pause logic, no exceptions-to-the-rule
  handling — that richer version is still V2. This exists solely so the fixed Mon–Sun roadmap
  schedule doesn't have to be re-entered by hand every week for nine months.

**Prep Tracker — `PrepEntries` and `BehavioralStories` tables (new, 2026-07-12):**

- `PrepEntries`: `id` (uuid, pk), `entry_type` (enum: `algorithm` / `system_design` /
  `ml_system_design` / `behavioral` / `mock_interview`), `topic` (text, nullable — e.g. "graphs",
  "rate limiter"), `date` (date), `duration_min` (int, nullable), `time_to_solve_min` (int,
  nullable — algorithm entries only), `outcome` (enum: `solved` / `partial` / `failed` for
  algorithm entries, or `pass` / `needs_work` for mocks — store as free-form text if a fixed enum
  is too rigid across entry types), `notes` (text — the post-mortem/reflection),
  `deleted_at` (timestamptz, nullable, default `NULL`), `created_at`.
- `BehavioralStories`: `id` (uuid, pk), `title` (text), `theme` (text — e.g. "technical
  leadership", "conflict/tradeoff"), `concise_version` (text), `extended_version` (text),
  `deleted_at` (timestamptz, nullable, default `NULL`).
- Fire `prep.logged` on every new `PrepEntries` row so the Dashboard can update running totals
  without querying this module's table directly.
- No nesting, no self-joins — this is the simplest schema of the four MVP modules.

**Job Application CRM — `Companies`, `Applications`, `Interviews` tables (promoted to MVP,
2026-07-12):**

- `Companies`: `id` (uuid, pk), `name` (text), `tier` (enum: `reach` / `match` / `safety`),
  `notes` (text, nullable).
- `Applications`: `id` (uuid, pk), `company_id` (FK → Companies), `role_title` (text),
  `resume_variant` (enum: `swe_backend` / `mle_ml_infra` — mirrors the roadmap's two resume
  tracks), `stage` (enum: `researching` / `applied` / `oa` / `phone_screen` / `onsite` /
  `offer` / `rejected` / `withdrawn`), `applied_date` (date, nullable), `last_update_date`
  (date), `referral_source` (text, nullable), `follow_up_date` (date, nullable), `deleted_at`
  (timestamptz, nullable, default `NULL`).
- `Interviews`: `id` (uuid, pk), `application_id` (FK → Applications), `round_type` (enum:
  `coding` / `system_design` / `ml_system_design` / `behavioral` / `other`), `scheduled_at`
  (timestamptz), `completed` (boolean, default `false`), `outcome` (text, nullable),
  `post_mortem_notes` (text, nullable), `deleted_at` (timestamptz, nullable, default `NULL`).
- Fire `application.stage_changed` on every `Applications.stage` transition, and
  `interview.completed` when an `Interviews` row's `completed` flips to `true` — the Dashboard
  uses the latter to surface "log a post-mortem" reminders (roadmap Section 11.2's 24-hour
  post-mortem habit).
- `Interviews` here are real interviews tied to a specific application; `PrepEntries` (Prep
  Tracker, entry_type `mock_interview`) are practice reps. Keep the two tables separate — don't
  conflate a mock with a real interview round.

**Daily Dashboard (promoted to MVP, 2026-07-12):**

- No new tables — pure read-aggregation, per the original V2 rationale ("cheap to add once the
  other modules exist"). Subscribes to `task.completed`, `application.stage_changed`,
  `interview.completed`, and `prep.logged` to keep its view current without polling.
- Panels: this week's recurring schedule blocks (Task Engine), applications with a
  `follow_up_date` today-or-earlier or no update in >7 days (Job CRM), running totals for the
  current month vs. the roadmap's monthly targets from Section 15 (Prep Tracker), current
  month's "gate" checklist — modeled as a parent Task with subtasks, per Task Engine above.
- Build this last among the four MVP modules; it has nothing to aggregate until the other three
  have real data.

---

The following two are **V2 — sketched below so the shape exists when you build them, but they
are not part of the current build.**

**Knowledge Base — `Notes` and `NoteLinks` tables:**

- `Notes`: `id` (uuid, pk), `title` (text), `body` (text, markdown), `deleted_at` (timestamptz,
  nullable, default `NULL`), `created_at`/`updated_at`.
- `NoteLinks`: `id` (uuid, pk), `source_note_id` (uuid, FK → Notes), `target_note_id` (uuid, FK →
  Notes) — a self-referencing many-to-many join, not a column on `Notes`. A link is directional
  at the row level, but bi-directional at the UI/query level: querying a note's links must
  return both rows where it's the source and rows where it's the target.
- Self-links (`source_note_id == target_note_id`) are invalid — reject at the repository layer.

**Global Command Palette — registry pattern:**

- No dedicated table; this is a runtime, in-memory registry. Each module registers a list of
  `{ id, label, keywords, action }` entries with a shell-level index on mount.
- `id` must be namespaced per module (e.g. `task:create`, `note:open:<uuid>`) so two modules
  can't collide on the same id — treat a duplicate `id` registration as a bug to surface loudly,
  not silently overwrite.

**Finance Tracker (V2):** `Ledger` table (`amount`, `category`, `date`, `type`).

### 2.4 Additional Architecture Decisions

- **Sync/offline story — To-Do:** Decide on an offline strategy (optimistic-update-plus-
  conflict-on-write vs. Supabase realtime) before the Kanban is built.
- **Backup/export:** A "dump everything to JSON/Markdown" script before trusting the app with
  real data.
- **Notifications/reminders:** Not in MVP scope.
- **Approved dependency list — To-Do:** With multiple agents writing code, add an explicit
  allowed-packages section to `CLAUDE.md` and `AGENTS.md` (e.g. "date-fns, not dayjs _and_
  date-fns"; "React Hook Form or nothing"). Keep both files in sync — otherwise each tool will
  independently pick a "reasonable" library, and you'll end up with two competing date libraries
  by week three.

---

## PHASE 3: Implementation & Agentic Workflows

This is where the actual typing happens. Because Phase 1 and 2 are complete, you act as the
"Lead Architect" directing your AI team — but no longer as an implementer or line-by-line
reviewer.

### 3.1 AI Team Division of Labor

> **Note on team size:** Running three code-capable tools (Claude Code, Codex, Antigravity)
> means real coordination overhead for a solo project — that overhead is unrelated to the
> learning-vs-speed question and still applies now. Claude Code + Codex remain the primary
> concurrent pair (see Phase 3.5 for exactly how they split work without colliding). Antigravity
> stays in its narrow, async role below — it doesn't need to be a third full-time collaborator
> to be useful; it's specifically valuable right now for the one thing that got weaker when
> human review left the loop: **catching edge cases before code is written**, and generating
> test/dummy data after.

**1. You (The Lead Architect)**

- Responsibilities: Writing the strict markdown specifications for each module. Defining the
  database schemas. Making the final call on tech-stack changes. Deciding what's MVP vs. V2.
- Coding role: **None by default.** You are not writing glue code, not wiring the Event Bus by
  hand, and not writing first-pass module logic. If you want to jump in on a specific piece
  anyway, that's your call, but it's no longer the expected workflow.
- Review role: You are not reading every PR line-by-line. The automated gate in Phase 3.4
  (lint/typecheck/tests + expanded Playwright E2E coverage) is what stands in for that now. Spot
  checks are still worthwhile before merging anything into `main`, but treat them as optional
  spot checks, not the primary defense.

**2. Claude Code (The Senior Feature Dev)**

- Strengths: Deep context window, complex reasoning, cross-file refactoring, understanding
  architectural constraints.
- How to use it: Hand off well-scoped, multi-file tasks directly from spec — for every module,
  MVP included. Claude Code also owns publishing the TypeScript interfaces (Repository
  signatures, store shapes, Event Bus types) that Codex builds against, so the two can work
  concurrently. See Phase 3.5 for the exact per-module split.
- Prompt example: _"Read task-module-spec.md. Scaffold the TaskRepository.ts and the
  useTaskStore.ts according to our modular monolith rules. Do not touch the UI components yet."_
- When NOT to use it: Minor CSS tweaks or single-line bug fixes — too slow/heavy for that, hand
  those to Codex.

**3. Codex (The Junior Dev / Fast Typist)**

- Strengths: Speed, inline context, autocomplete, boilerplate generation.
- How to use it: Keep it running in the background in your IDE. Once Claude Code publishes a
  module's interface, Codex builds the UI components, forms, and unit tests against that
  interface in parallel — it does not wait for Claude Code's implementation to be finished, only
  for the interface to exist. See `AGENTS.md` for its full instruction set.
- Prompt example: `// Takes a task object and formats the due date relative to today using
date-fns` (let Codex autocomplete the rest).
- When NOT to use it: Architecting a new feature or reasoning about cross-store interactions —
  it lacks the deep context; hand that to Claude Code.

**4. Antigravity (Narrow role: Edge-Case QA & Test Data)**

- Strengths: General reasoning, edge-case finding, writing, non-code generation.
- How to use it: **Before** Claude Code writes the logic-heavy piece of each module (recursive
  cascade, bi-directional links, registry conflicts), ask Antigravity for edge cases — this is
  the step that most directly compensates for the removed human-review step. **After** code
  exists, use it to generate dummy/test data.
- Prompt examples:
  - _"I'm building a self-referencing task hierarchy with a 3-level nesting cap and optimistic
    UI updates. What are 5 weird edge cases I might have forgotten?"_
  - _"Generate a JSON array of 50 dummy tasks, including nested sub-tasks, to test my UI."_
  - _"Research: what is the lightest-weight drag-and-drop library for React in 2026 that
    supports touch screens? Summarize the pros and cons."_
- Do you need more from it than this? Probably not yet. The narrow role is intentional — it
  keeps coordination overhead low while covering the specific gap (pre-implementation edge
  cases) that matters most now that no human is reviewing logic. Revisit only if Claude
  Code/Codex keep shipping edge-case bugs the E2E suite isn't catching.

### 3.2 The Agentic SDLC (Software Development Lifecycle)

Do not let the AI "freestyle" your application. Use Spec-Driven Development.

- **`CLAUDE.md` and `AGENTS.md`**: Root-level markdown files defining strict codebase rules for
  each agent — tech stack specifics ("Use Tailwind for all styling, never CSS modules"), the
  approved dependency list (2.4), testing instructions ("Run `npm run test:ui` after every
  component change"), architecture rules ("Never import a module directly into another
  module"). Keep them in sync; if they ever conflict, `CLAUDE.md` is the source of truth since
  Claude Code owns architecture.
- **Ask for a plan first:** Always prompt: _"Before writing code, provide a step-by-step plan
  and file-by-file diff outline."_ Since there's no human line-by-line review, use this plan
  step as your actual checkpoint — read the plan, not necessarily the full diff.
- **Implement in small commits:** Limit each agent task to one specific feature or fix to keep
  diffs reviewable and to avoid Claude Code and Codex colliding on the same files.

### 3.3 Design Patterns to Utilize

- **The Strategy Pattern (UI Level):** Base `Widget` interface for the dashboard.
- **The Repository Pattern (Data Level):** Isolate DB queries (e.g., `NoteRepository.js`).
  Claude Code owns this for every module.
- **The Observer/Pub-Sub Pattern:** The Event Bus decouples modules. Claude Code owns building
  it, from spec, same as everything else now.

### 3.4 QA & DevOps (Solo Dev Approach) — the substitute for human review

- **Pre-commit hooks:** Husky + lint-staged, forcing Prettier/ESLint/type-checks on every
  commit — more important with agent-generated code than hand-written code, since agents won't
  self-enforce formatting discipline the way you would out of habit.
- **Green CI is now the real bar, not the minimum bar.** With the human review step removed,
  lint/typecheck/format catch syntax-level mistakes but not an agent writing a perfectly-typed
  function that does the wrong thing (an off-by-one in the recursive subtask query, a
  double-firing Event Bus handler). That gap is now covered by:
  1. Antigravity edge-case lists gathered _before_ the logic-heavy code is written (3.1).
  2. An **expanded** Playwright E2E suite — not just "3-4 critical paths" but specifically
     covering cascade delete, the 3-level nesting cap, optimistic-rollback-on-failure, and
     bi-directional link resolution. These are the exact behaviors that used to get a manual
     trace-against-spec; now they need a test that actually exercises them.
- **Testing:** Unit test complex logic (Vitest). Playwright E2E for the logic-heavy paths above,
  expanded beyond the original "critical paths only" scope given in 3.4.
- **Version Control & CI/CD:** `main` branch is production. Branch per feature. Connect to
  Vercel/Netlify. Treat CI passing as the merge gate for both agents' PRs.

### 3.5 Concurrent Task Board

Contract-first split so Claude Code and Codex work in parallel without touching the same files.
Claude Code publishes the module's TypeScript interface first (small standalone diff); Codex
builds against it immediately without waiting for the real implementation.

**Active board (current MVP, reprioritized 2026-07-12):**

| Module                  | Claude Code                                                                                                                                                                                 | Codex                                                                                                              | Antigravity                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Task Engine**         | `TaskRepository.ts` (recursive CTE for cascade, 3-level nesting cap, weekly-recurrence regeneration), `useTaskStore.ts` (optimistic update + rollback-on-failure), `task.*` Event Bus types | Kanban board UI, quick-capture inbox form, task card components, unit tests for the published interface            | Edge cases for nesting cap + optimistic UI before build; dummy nested-task JSON after                                        |
| **Prep Tracker**        | `PrepRepository.ts`, `useprepStore.ts` (or similarly named), `prep.logged` Event Bus type                                                                                                   | Entry-logging forms (per `entry_type`), behavioral-story editor, scorecard-progress display components, unit tests | Edge cases for outcome/enum handling across entry types before build; dummy prep-log data after                              |
| **Job Application CRM** | `ApplicationRepository.ts` / `CompanyRepository.ts` / `InterviewRepository.ts`, `useApplicationStore.ts`, `application.stage_changed` + `interview.completed` Event Bus types               | Pipeline/kanban-by-stage UI, company/application forms, interview log UI, unit tests                               | Edge cases for stage transitions (e.g. re-opening a rejected application) before build; dummy company/application data after |
| **Daily Dashboard**     | Aggregation queries/hooks subscribing to the four Event Bus types above — no new repository, this reads from the others                                                                     | Dashboard layout, panel components (schedule, follow-ups, scorecard progress, gate checklist)                      | Not needed — no new logic to edge-case here                                                                                  |

Task Engine and Prep Tracker have no shared files, and Job Application CRM has no shared files
with either — so once Task Engine's interface is published, Claude Code can start on Prep
Tracker's or Job CRM's interface next rather than waiting on Codex to finish Task Engine's UI.
Dashboard is last regardless, since it depends on data from the other three.

**V2 board (not active — build after the above is done):** Knowledge Base and Command Palette
keep the split described in earlier drafts of this plan (Repository/Store/registry-core with
Claude Code, UI/tests with Codex) — nothing about that division changes, it's just not
scheduled yet.
