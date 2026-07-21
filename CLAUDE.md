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
- UI primitives: shadcn/ui components generated into `src/components/ui/`, built on
  `@radix-ui/*` (Dialog, Popover, Select, Tooltip) + `cmdk` (Command). Selective adoption,
  re-skinned onto existing semantic tokens; the hand-rolled primitives are retained, not replaced.
- Class utilities: `clsx` + `tailwind-merge` via the `cn()` helper (`src/lib/cn.ts`);
  `class-variance-authority` (CVA), used by generated shadcn components.
- Icons: `lucide-react`.
- Markdown rendering: `react-markdown` + `remark-gfm` + `rehype-highlight` — added 2026-07-21 for
  the Design Drills LeetCode-editorial solutions. This reverses the earlier "no markdown renderer"
  call (migration 0025's comment), which the Lead Architect approved. Render **only** through the
  shared `src/components/ui/Markdown.tsx` wrapper — never add `rehype-raw` or otherwise render raw
  HTML from the DB, and don't reach for `@tailwindcss/typography`/`prose` (not installed; the
  wrapper maps elements onto the semantic tokens by hand).
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

## MVP Status — Wave 1 Complete (2026-07-13), Wave 2 Next

**Wave 1 is done.** All five MVP modules — Task Engine, Prep Tracker, Job Application CRM,
Outreach Log, and Daily Dashboard — have published contracts, working implementations, and UI
merged to `main` (commit `98d3ed8`; 136 unit / 30 E2E tests green). They exist because they
directly serve `engineering_first_roadmap_v2.md` — see `myhub_plan.md` Part A §A.1 for the full
"why these five modules" rationale and Part A §A.3 for what changed once the actual roadmap file
(not fragments) landed. Knowledge Base and Command Palette remain V2 — don't start those.

**What's next is Wave 2** ("Momentum, Rituals, and Roadmap Depth" — `myhub_plan.md` Part B): an
8-phase plan covering a shared UI shell, task completion timestamps, Prep/CRM depth features,
a streaks-and-achievements module, a weekly review ritual, single-user auth + RLS, and an offer
evaluator. Part B has its own per-phase Claude/Codex split and sequencing table — don't
duplicate that split here; read it there.

## Working Concurrently with Codex

The split is **contract-first**, and applies to every wave, not just Wave 1:

1. **You publish the interface before either of you writes the feature.** For each module (or
   phase, in Wave 2), your first deliverable is the TypeScript surface Codex will build against:
   the Repository class signature, the Zustand store's state/actions shape, migrations, and any
   new Event Bus event types. Commit this as a small, standalone diff (interfaces + stub
   implementations that throw `not implemented`, plus correctness-critical domain logic with
   tests) so it compiles immediately.
2. **Codex builds UI, forms, and unit tests against that published interface**, in parallel with
   you filling in anything you didn't already finish. Neither of you touches the other's files.
3. **You own:** migrations, `*Repository.ts` / `use*Store.ts` published interfaces,
   `src/lib/events.ts`, and correctness-critical domain logic (cascades, date math, rules
   engines).
   **Codex owns:** UI components, mechanical repository/store wiring behind your published
   contract, and unit/E2E tests.

   **Capacity amendment (2026-07-12):** Claude Code's usage budget is the scarce resource on this
   project; Codex's is not. So ownership of the files above means _design_ ownership, not a
   monopoly on typing. Spend your budget on the parts only you can do — the schema, the published
   TypeScript contract, the correctness-critical domain logic, and review. Once those are
   published and unit-tested, **Codex may implement the mechanical wiring inside
   `*Repository.ts` and `use*Store.ts`** — Supabase round-trips, optimistic-set-then-rollback
   plumbing, event emission — against your contract, and you review the diff rather than writing
   it. Codex still may not change a published interface, invent a schema, or alter domain logic:
   if the contract looks wrong, it flags, you fix.

   **Ratio amendment (2026-07-15):** target roughly **35% Claude / 65% Codex by code**, and treat
   that as a discipline, not a nice-to-have. You are the tech lead — your leverage is in deciding
   _what_ and guarding _correctness_, not in typing application code. The 35% you keep is the part
   that can't be safely delegated: migrations, published contracts, correctness-critical domain
   logic (cascades, date math, rules engines), and the automated test gates that protect them
   (e.g. `palette.test.ts` failing CI on a contrast regression). Everything else — UI, per-page
   application, and even small "app knowledge" constants the plan already specifies precisely (a
   `funnel-stage → hue` map, a `prep-type → hue` map) — goes to Codex, and you **review** it rather
   than write it. When you catch yourself picking up a component or a spelled-out mapping, stop and
   hand it over; if it needs a contract Codex is missing, write _that one contract_ and hand it
   back, don't take over the surface. The ratio then falls out on its own — holding the line is the
   work, the number takes care of itself.

4. If a module's interface needs to change mid-build, you own the change — update the interface
   file and flag it, don't let Codex patch around a stale contract.

**Wave 1's per-module split table lived here; it's now stale (everything in it shipped) and has
been removed rather than left as dead reference.** Wave 2's per-phase split lives in
`myhub_plan.md` Part B's "Sequencing & workload" table — read it there when starting a Wave 2
phase, don't recreate it here.

Knowledge Base and Command Palette are V2 — same contract-first split once they're scheduled,
but don't start either until Wave 2 is done.

## Workflow

1. **Plan before code.** For any multi-file task, first output a step-by-step plan and a
   file-by-file diff outline. Wait for approval before writing code — but "approval" may now be
   the automated check gate below rather than a human reading the diff line by line.
2. **The spec source is `myhub_plan.md`** — Part A §A.2 ("Module Designs (as built)") for
   Wave 1's shipped schemas, Part B for Wave 2's phase-by-phase plan — plus the architecture
   rules in this file. There is no separate `/specs/` folder, and no one is available to write
   one. Read the relevant section before touching a module. If a detail you need isn't covered
   there, don't stop and ask a human — apply the architecture rules above (Repository pattern,
   soft deletes, discriminated-union events, no God Tables) and make the smallest reasonable
   extension consistent with the rest of the plan, then note the assumption in your commit
   message so it's visible later.
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
