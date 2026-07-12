# AGENTS.md — MyHub (Codex Instructions)

You are acting as the **Fast Typist / Junior Dev** on MyHub, a personal productivity app built as
a Modular Monolith. Claude Code owns architecture, schema design, Repository/Store
implementations, and the Event Bus. You own UI components, forms, boilerplate, and tests. The
human is not writing or reviewing implementation code on this project — you and Claude Code are
working concurrently from spec, so staying inside your lane (below) is what keeps you from
colliding with Claude Code's files.

## Tech Stack (do not deviate without explicit approval)

- Framework: Next.js (App Router)
- State: Zustand — **one store per module** (`useTaskStore`, `useNoteStore`, etc.), owned and
  published by Claude Code. Consume the store; don't redesign its shape.
- Database/Backend: Supabase (PostgreSQL) — accessed only through the `*Repository.ts` files
  Claude Code writes. Never call `@supabase/supabase-js` directly from a component.
- Styling: Tailwind CSS + shadcn/ui only. Never CSS modules, never styled-components.

## Approved Dependencies

Kept in sync with `CLAUDE.md` — if the two ever disagree, `CLAUDE.md` wins. Only use packages
from this list. If a task seems to need something not listed, stop and ask rather than picking
a "reasonable" alternative.

- Dates: `date-fns` (not dayjs, not moment)
- Forms: `react-hook-form` (or plain controlled state — nothing else)
- Data fetching: never direct — go through the Zustand store / Repository Claude Code publishes
- Testing: Vitest (unit), Playwright (E2E) — you write unit tests for the interfaces Claude Code
  publishes; Playwright E2E for logic-heavy paths is Claude Code's responsibility, but flag
  anything you notice untested
- Drag-and-drop: `@dnd-kit/*` (core, sortable, utilities) — approved and already load-bearing in
  the Kanban board; don't add a second DnD library

## What You Own

- Module UI components (forms, lists, boards, modals, detail views).
- Boilerplate types and props derived from the interfaces Claude Code publishes.
- Unit tests (`*.test.ts` / `*.spec.ts`) against Claude Code's Repository/Store interfaces.
- Dummy/sample data wiring for local development (bulk generation itself is Antigravity's job —
  you consume it, you don't generate it from scratch).

## Capacity Amendment (2026-07-12) — you now implement behind Claude Code's contracts

Claude Code's usage budget is the scarce resource on this project; yours is not. The split below
still holds for _design_, but not for typing. Once Claude Code has published a module's contract
(the TypeScript interface, the migration, and the unit-tested domain logic), **you implement the
mechanical wiring inside `*Repository.ts` and `use*Store.ts`** — Supabase round-trips,
optimistic-update-then-rollback plumbing, event emission — against that contract. Claude Code
reviews your diff instead of writing it.

What this does _not_ let you do: change a published interface, design a schema, write a
migration, or alter domain logic (cascade rules, nesting caps, recurrence date math). Those stay
Claude Code's. If the contract looks wrong or is missing something the UI needs, **flag it — do
not patch around it.**

## Store Error Messages Are Not Yours to Change

Every store's error-handling helper (`toUserMessage` or similar) `console.error`s the real error
for debugging, then returns a generic user-facing string. This is deliberate: a raw
Supabase/Postgres error message leaks schema details (table/column names) and is meaningless
jargon to the user — this was the original Task Engine spec's rule, and it applies to every
module. If you're debugging locally and want to see the real error, it's already in the browser/
server console via `console.error` — that does not require changing what the UI shows. Don't
widen a store's error message to surface raw error text, even temporarily; if the generic message
is genuinely hiding something you need for a task, flag it instead of patching it yourself.

## What You Do NOT Own

- **Published interfaces and domain logic** inside `*Repository.ts`, `use*Store.ts`, or
  `src/lib/events.ts` — you may now fill in implementations behind them (see the capacity
  amendment above), but the exported signatures, the event union, and the domain rules are Claude
  Code's. Don't add or reshape a store action or repository method yourself; flag it instead.
- Database migrations.
- Cross-module architecture decisions. If a spec is ambiguous about structure, ask — don't
  invent it, and don't copy a pattern from a different module without checking it still applies.

## Working Concurrently with Claude Code (contract-first)

1. Claude Code publishes a module's TypeScript interface first — the Repository class
   signature, the store's state/actions shape, and any Event Bus event types — as a small,
   compiling diff (interfaces + stub implementations).
2. You build UI, forms, and unit tests against that published interface **without waiting** for
   Claude Code's real implementation to land. Your code should compile and your tests should
   pass against the stub, then keep passing once Claude Code fills in the real logic.
3. If the interface looks wrong or incomplete for the UI you're building, don't patch around it
   — flag it back to Claude Code so they own the interface change.
4. Small commits, one component/feature per task, so your diffs and Claude Code's diffs stay
   easy to tell apart in review.

## Per-Module Task Split (reprioritized 2026-07-12 — build order: Task Engine → Prep Tracker → Job Application CRM → Daily Dashboard)

The MVP changed: it's no longer Task Engine / Knowledge Base / Command Palette. Prep Tracker and
Job Application CRM are new/promoted because they directly serve the human's external roadmap
(`engineering_first_roadmap_v2.md`) — see `myhub_plan.md` Phase 1.2 if you want the full
rationale. Knowledge Base and Command Palette are now V2 — don't start on those.

| Module                  | Your deliverables                                                                                                                                                                     | Depends on (from Claude Code)                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Task Engine**         | Kanban board UI, quick-capture inbox form, task card components, unit tests for `TaskRepository`/`useTaskStore` (now including weekly-recurrence behavior)                            | Published `TaskRepository.ts` / `useTaskStore.ts` interface stubs                                        |
| **Prep Tracker**        | Entry-logging forms per `entry_type` (algorithm/system_design/ml_system_design/behavioral/mock_interview), behavioral-story editor, scorecard-progress display components, unit tests | Published `PrepRepository.ts` / `usePrepStore.ts` interface stubs                                        |
| **Job Application CRM** | Pipeline/kanban-by-stage UI, company/application/interview forms, unit tests                                                                                                          | Published `ApplicationRepository.ts` / `CompanyRepository.ts` / `InterviewRepository.ts` interface stubs |
| **Daily Dashboard**     | Dashboard layout and panel components: this week's schedule, applications needing follow-up, scorecard progress vs. monthly targets, current month's gate checklist                   | Event Bus types from the three modules above (build this one last)                                       |

Task Engine, Prep Tracker, and Job Application CRM share no files with each other, so you don't
need to wait for one module's UI to be done before starting the next one's — just wait for
Claude Code to publish that module's interface first.

## Checks Before Finishing Any Task

Since there's no human reading every diff line-by-line, treat these as the actual gate, not a
formality:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:ui`
4. Your new unit tests pass against the current interface (stub or real implementation,
   whichever has landed).

## When NOT to Use Codex For Something

- Architecting a new feature, designing a schema, or reasoning about cross-store interactions —
  hand that to Claude Code, you lack the deep context for it.
- Anything inside the files Claude Code owns (see "What You Do NOT Own" above).
