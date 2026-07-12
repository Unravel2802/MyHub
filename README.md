# MyHub

MyHub is a personal productivity app built as a modular monolith with Next.js, Zustand, and Supabase. The current MVP implementation contains the Task Engine; the Knowledge Base and Command Palette are planned next.

## Current Scope

- Task board with inbox, todo, in-progress, and done states
- Nested subtasks with a maximum depth of three levels
- Optimistic task creation, updates, movement, reordering, and soft deletion
- Typed task events for future cross-module communication
- Supabase repository boundary for task persistence

The product direction is documented in [`myhub_plan.md`](./myhub_plan.md). Task behavior and backend contracts live in [`specs/task-module-spec.md`](./specs/task-module-spec.md) and [`specs/task-backend-contract.md`](./specs/task-backend-contract.md).

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a Supabase project, then apply the SQL migration in:

```text
supabase/migrations/0001_create_tasks.sql
```

You can run the migration through the Supabase SQL editor. This repository does not currently include a local Supabase CLI configuration.

Copy the environment template and provide the project URL and anonymous key:

```bash
cp .env.local.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not commit `.env.local` or service-role credentials.

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

Run the backend quality checks before finishing a change:

```bash
npm run lint
npm run typecheck
npm run test
```

Run the Playwright UI smoke test separately:

```bash
npm run test:ui
```

The UI test starts the application through the Playwright configuration and requires valid Supabase environment values for database-backed behavior.

## Architecture

Each domain owns its database table, repository, Zustand store, domain logic, and tests under `src/modules/<module>`. Database access must go through a module repository; components do not query Supabase directly.

Modules do not import one another's internals. Cross-module communication uses the typed event bus in [`src/lib/events.ts`](./src/lib/events.ts), whose payloads are defined as a discriminated union.

Application records use soft deletion through `deleted_at`. Application code must not hard-delete domain records.

```text
app/                         Next.js routes and app shell
specs/                       Approved module specifications and contracts
src/lib/                     Shared infrastructure, including events and Supabase
src/modules/task/            Task domain, repository, store, helpers, and UI
supabase/migrations/         Ordered PostgreSQL migrations
tests/ui/                    Playwright end-to-end tests
```

## Contribution Workflow

- The Lead Architect owns architecture decisions, schema design, and final review.
- Codex owns backend and data work: migrations, repositories, module stores, domain logic, event contracts, and backend tests.
- Claude Code owns frontend implementation unless a backend task requires a small integration point.
- Read the relevant file in `specs/` before modifying a module. If no specification exists, define and approve one first.
- Keep changes focused and run lint, type checking, and unit tests after every backend change.

The complete agent constraints and MVP learning guardrails are in [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md).
