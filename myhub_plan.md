# Software Engineering Blueprint: MyHub

*(The Personal Master App — codename "MyHub". Suggested repo name: `myhub` or `my-hub`.)*

Since this is a multi-featured app for a single user, traditional enterprise constraints
(scaling, multi-tenant security) are replaced by a different constraint: **Developer Sanity**
— and in this case, **learning surface area**. This build is explicitly optimized for full-stack
hands-on practice (schema design, state management, and cross-module architecture), not
just speed-to-daily-use.

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
  from scratch as its own module — intentionally not reusing the existing Applyze codebase, since
  the goal here is the learning rep of designing this schema fresh, under modular-monolith constraints.

**Life & Tracking**
- Finance/Budget Ledger: Income/expense logging, monthly burn rate charts, subscription tracker.
- Habit Tracker: Daily checkboxes with visual "streak" counters.
- Daily Wrap-Up / Journal: An end-of-day prompt summarizing tasks completed + journal entry.

**System Level (The "Magic" Features)**
- Global Command Palette (Cmd+K): A universal shortcut to add tasks, search notes, or navigate
  anywhere instantly.

### 1.2 Feature Triage (MVP vs. V2)

**MVP — chosen for maximum learning surface, not maximum speed:**

| Module | Why it's in the MVP (skill-tree rationale) |
|---|---|
| **Task Engine** | Baseline CRUD + state fundamentals. `parent_task_id` self-referencing FK forces recursive-query thinking early. Optimistic UI on Kanban drag teaches rollback-on-failure state logic. |
| **Knowledge Base (with bi-directional linking)** | Harder schema: `NoteLinks` is a many-to-many self-join, a different shape than Tasks' recursion. Also the natural place to apply retrieval background. |
| **Global Command Palette** | Forces a registry/plugin pattern — each module "announces" searchable actions/entities to a shell-level index. A genuine cross-cutting concern that can't be solved by direct imports, so it's the real test of whether the modular-monolith boundary holds. |

**Build order:** Tasks → Notes/Links → Command Palette. The Palette needs the other two modules
to exist to be worth building; building it first would mean hardcoding against a schema that
doesn't exist yet.

> **⚠️ Learning-goal guardrail:** For these three MVP modules specifically, write the first pass
> of schema + store logic yourself before involving an agent. The whole reason these modules are
> in the MVP is the hands-on rep — if an agent scaffolds `TaskRepository.ts` and `useTaskStore.ts`
> from spec on day one, you skip the exact exercise you picked the module for. Agent involvement
> on these three should start at *review/refactor/extend-the-pattern-to-the-next-module*, not
> *initial scaffold*. Full spec-to-code delegation (see Phase 3) is fair game for V2 modules,
> where the goal really is speed.

**V2 (deferred):**
- Daily Dashboard, Habit Tracker — mostly read-aggregation over data the MVP modules already
  store, so cheap to add once Tasks/Notes exist.
- Calendar/Time Blocking, Focus/Pomodoro Timer
- Media/Blog CMS, Journal
- Finance/Budget Ledger — good future rep for aggregation queries + time-series charting once
  the MVP schema patterns are solid.
- Job Application CRM — rebuilt from scratch, deliberately not reusing Applyze.

**Optional stretch on Knowledge Base:** add `pgvector` on Supabase for semantic search over
notes — directly reuses hybrid retrieval (BM25 + dense + GraphRAG) background from work, and
turns bi-directional links + embeddings-based "related notes" into a genuinely useful feature.

---

## PHASE 2: System Design & Architecture (Architecting for Agents)

When working with AI agents, the architecture must be explicit, modular, and strictly
documented so the agent doesn't hallucinate structural decisions.

### 2.1 Architecture: The Modular Monolith

Do not build microservices. For a solo developer, build a **Modular Monolith**.

- **The Shell:** Core app (auth, navigation, global Command Palette, global state).
- **The Modules:** Each feature is self-contained. The "Finance" module should not directly
  import internal components from the "Habit" module.
- **The Event Bus Payload Contract:** Modules communicate only via a strict Event Bus.
  - Define the exact TypeScript shape *before* writing module code. Use a **discriminated
    union**, not `payload: unknown`:
    ```typescript
    type AppEvent =
      | { type: "task.completed"; payload: { taskId: string }; timestamp: number }
      | { type: "note.linked"; payload: { sourceId: string; targetId: string }; timestamp: number }
      | { type: "pomodoro.finished"; payload: { durationMin: number }; timestamp: number };
    ```
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
- **Write raw SQL migrations first:** Hand-writing the DDL forces you to truly understand
  constraints. AI agents are excellent at generating raw DDL from a markdown schema plan — but
  write the MVP modules' migrations yourself first (see learning-goal guardrail above), then
  let agents generate migrations for V2 modules from your spec.

### 2.3 Specific Module Designs

- **Knowledge Base / Notes:** `Notes` table and `NoteLinks` table (self-referencing many-to-many).
- **Task Engine:** `Tasks` table with `status`, `due_date`, `parent_task_id` (subtasks). Recurring
  tasks are a separate concern — scope explicitly as a `RecurrenceRule` table or generator job.
- **Finance Tracker (V2):** `Ledger` table (`amount`, `category`, `date`, `type`).
- **Job Application CRM (V2):** `Companies`, `Applications`, `Interviews`.

### 2.4 Additional Architecture Decisions

- **Sync/offline story — To-Do:** Decide on an offline strategy (optimistic-update-plus-
  conflict-on-write vs. Supabase realtime) before the Kanban is built.
- **Backup/export:** A "dump everything to JSON/Markdown" script before trusting the app with
  real data.
- **Notifications/reminders:** Not in MVP scope.
- **Approved dependency list — To-Do:** With multiple agents writing code, add an explicit
  allowed-packages section to `CLAUDE.md` (e.g. "date-fns, not dayjs *and* date-fns"; "React
  Hook Form or nothing"). Otherwise each tool will independently pick a "reasonable" library,
  and you'll end up with two competing date libraries by week three.

---

## PHASE 3: Implementation & Agentic Workflows

This is where the actual typing happens. Because Phase 1 and 2 are complete, you act as the
"Lead Architect" directing your AI team.

### 3.1 AI Team Division of Labor

> **Note on team size:** Running three code-capable tools (Claude Code, Codex, Antigravity)
> means real coordination overhead — keeping specs in sync, remembering who-does-what — for a
> solo project. Antigravity in particular is a full agent-first IDE that can autonomously plan,
> write, run, and browser-test code end-to-end, not just a research/QA tool, so its role below
> is a deliberately narrow slice of what it's capable of. Consider treating Claude Code + Codex
> as your primary two-tool team, and Antigravity as occasional-use only (edge-case brainstorming,
> dummy data) until the coordination cost is clearly worth it.

**1. You (The Lead Architect & Reviewer)**
- Responsibilities: Writing the strict markdown specifications for each module. Defining the
  database schemas. Making the final call on tech-stack changes.
- Coding role: Writing the "glue" code between complex systems (e.g., manually wiring the Event
  Bus). Writing the first pass of MVP-module logic yourself (learning-goal guardrail). Reviewing
  every PR/commit generated by Claude. You own the architecture.

**2. Claude Code (The Senior Feature Dev)**
- Strengths: Deep context window, complex reasoning, cross-file refactoring, understanding
  architectural constraints.
- How to use it: Handoff well-scoped, multi-file tasks — for V2 modules, from spec; for MVP
  modules, only after your own first pass exists.
- Prompt example: *"Read task-module-spec.md. Scaffold the TaskRepository.ts and the
  useTaskStore.ts according to our modular monolith rules. Do not touch the UI components yet."*
- When NOT to use it: Minor CSS tweaks or single-line bug fixes — too slow/heavy for that.

**3. Codex (The Junior Dev / Fast Typist)**
- Strengths: Speed, inline context, autocomplete, boilerplate generation.
- How to use it: Keep it running in the background in your IDE. Write a descriptive comment and
  let it write the function. Repetitive types, UI components, unit tests.
- Prompt example: `// Takes a task object and formats the due date relative to today using
  date-fns` (let Codex autocomplete the rest).
- When NOT to use it: Architecting a new feature or reasoning about cross-store interactions —
  it lacks the deep context.

**4. Antigravity (Narrow role: Research & Edge-Case QA)**
- Strengths: General reasoning, edge-case finding, writing, non-code generation.
- How to use it: Before coding, to harden specs. After coding, to generate test data.
- Prompt examples:
  - *"I am building a Kanban board with optimistic UI updates. What are 5 weird edge cases I
    might have forgotten?"*
  - *"Generate a JSON array of 50 dummy tasks, including nested sub-tasks, to test my UI."*
  - *"Research: what is the lightest-weight drag-and-drop library for React in 2026 that
    supports touch screens? Summarize the pros and cons."*

### 3.2 The Agentic SDLC (Software Development Lifecycle)

Do not let the AI "freestyle" your application. Use Spec-Driven Development.

- **Write a `CLAUDE.md`** (or `.cursorrules`): Root-level markdown file defining strict codebase
  rules — tech stack specifics ("Use Tailwind for all styling, never CSS modules"), the approved
  dependency list (2.4), testing instructions ("Run `npm run test:ui` after every component
  change"), architecture rules ("Never import a module directly into another module").
- **Ask for a plan first:** Always prompt: *"Before writing code, provide a step-by-step plan
  and file-by-file diff outline."* Review this plan before letting it execute.
- **Implement in small commits:** Limit each agent task to one specific feature or fix to keep
  diffs reviewable.

### 3.3 Design Patterns to Utilize

- **The Strategy Pattern (UI Level):** Base `Widget` interface for the dashboard.
- **The Repository Pattern (Data Level):** Isolate DB queries (e.g., `NoteRepository.js`).
- **The Observer/Pub-Sub Pattern:** The Event Bus decouples modules — build it yourself for the
  MVP modules (learning-goal guardrail); it's the pattern most likely to "click" only if you
  wire it by hand at least once.

### 3.4 QA & DevOps (Solo Dev Approach)

- **Pre-commit hooks:** Husky + lint-staged, forcing Prettier/ESLint/type-checks on every
  commit — more important with agent-generated code than hand-written code, since agents won't
  self-enforce formatting discipline the way you would out of habit.
- **Automate the boring checks:** Treat "green CI" (passing formatters, linters, type-checks) as
  the *minimum* bar before reviewing AI-generated code — not the whole review. CI catches
  syntax-level mistakes; it does not catch an agent writing a perfectly-typed function that does
  the wrong thing (an off-by-one in the recursive subtask query, a double-firing Event Bus
  handler). For any AI-generated PR touching business logic, manually trace the logic against
  the spec before merging.
- **Testing:** Skip UI tests. Unit test complex logic. Write 3-4 End-to-End (E2E) tests with
  Playwright for critical paths.
- **Version Control & CI/CD:** `main` branch is production. Branch per feature. Connect to
  Vercel/Netlify.
