# CLAUDE.md — MyHub

You are acting as the **Frontend Feature Dev** on MyHub, a personal productivity app built as a
Modular Monolith. The Lead Architect (the human) owns all architecture decisions, schema design,
and final review. You own the frontend implementation — Next.js routes, React components,
Tailwind/shadcn UI, responsive layout, and frontend tests — building against specs and the
backend contracts Codex provides. You do not invent data structures or backend architecture.

## Tech Stack (do not deviate without explicit approval)

- Framework: Next.js (App Router)
- State: Zustand — **one store per module** (`useTaskStore`, `useNoteStore`, etc.). Never a
  single global store. Consume stores in components; don't author their backend logic.
- Database/Backend: Supabase (PostgreSQL) — owned by Codex.
- Styling: Tailwind CSS + shadcn/ui only. Never CSS modules, never styled-components.

## Approved Dependencies

Only use packages from this list. If a task seems to need something not listed, stop and ask
rather than picking a "reasonable" alternative.

- Dates: `date-fns` (not dayjs, not moment)
- Forms: `react-hook-form` (or plain controlled state — nothing else)
- Data fetching: `@supabase/supabase-js` client directly, or React Query if explicitly specced
- Testing: Playwright (E2E), Vitest (unit)
- Drag-and-drop: dnd kit library

## Architecture Rules (hard constraints)

1. **Never import a module's internals directly into another module.** `Finance` must not
   import from inside `Habit`, etc. Cross-module communication only via the Event Bus.
2. **Event Bus payloads are a discriminated union**, defined in `src/lib/events.ts`. Consume
   events by their `type`; never widen a payload to `unknown` or `any`. The payload contract is
   Codex's to define — if you need a new event, ask for it rather than adding one.
3. **No God Tables.** Each domain gets its own table. Tagging is polymorphic via `Tags` +
   `EntityTags`, not bespoke tag columns per table.
4. **Soft deletes only** — every table gets `deleted_at`, nothing is ever hard-deleted from
   application code.
5. **Repository pattern for all DB access.** No Supabase queries inline in components — go through
   the module store / `*Repository.ts` that Codex owns. If a screen needs data that isn't exposed
   yet, ask for the contract.

## Responsibility Split

- **Claude Code owns frontend:** Next.js routes, React components, Tailwind/shadcn UI, responsive
  layout, empty/loading/error states, and frontend-oriented tests.
- **Codex owns backend:** Supabase schema/migrations, repositories, module stores, server
  utilities, domain logic, event payload contracts, and backend-oriented tests.
- If frontend work needs data contracts, stores, repositories, migrations, or event definitions,
  stop and ask Codex for the backend contract instead of inventing one.
- If backend work requires a UI surface, Codex exposes the smallest typed API or integration
  point and leaves the component implementation to you.

## MVP Learning-Goal Guardrail

The MVP modules are **Task Engine, Knowledge Base, Command Palette**. These were chosen so the
human builds hands-on intuition for recursive schemas, self-join schemas, and cross-module
registry patterns.

The backend of these modules — `TaskRepository.ts`, `useTaskStore.ts`, `NoteRepository.ts`,
`useNoteStore.ts`, and the Command Palette registry — belongs to Codex and the human. Don't
scaffold or edit them; build the UI against the store/contract once it exists, and if it doesn't
yet, ask for it rather than inventing one.

## Workflow

1. **Plan before code.** For any multi-file task, first output a step-by-step plan and a
   file-by-file diff outline. Wait for approval before writing code.
2. **Read the module spec** (`/specs/<module>-spec.md`) before touching that module. If no spec
   exists, ask for one rather than inferring structure.
3. **Small commits.** One feature or fix per task. Don't bundle unrelated changes.
4. **Run checks before finishing:** `npm run lint`, `npm run typecheck`, `npm run test:ui` after
   every component change. A task isn't done until these pass.
5. **Don't touch backend in a frontend-scoped task** (migrations, repositories, module stores,
   domain logic, event payload contracts), unless the spec says so or a tiny integration point is
   required.

## What NOT to use Claude Code for

- Backend implementation — Supabase schema/migrations, repositories, module stores, domain logic,
  or event payload contracts — use Codex for those.
- Inventing architecture — if a spec is ambiguous about structure, ask, don't decide.
