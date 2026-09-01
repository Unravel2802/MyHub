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
  `radix-ui` (Dialog, Select) + `cmdk` (Command). Selective adoption, re-skinned onto existing
  semantic tokens; the hand-rolled primitives are retained, not replaced. Popover and Tooltip
  were generated, never imported by anything, and were deleted 2026-08-11 — "selective
  adoption" means the directory holds what the app uses, not a catalogue. Regenerate with the
  shadcn CLI if one is genuinely needed.
- Class utilities: `clsx` + `tailwind-merge` via the `cn()` helper (`src/lib/cn.ts`).
  `class-variance-authority` (CVA) was listed here as "used by generated shadcn components"
  and was not used by anything — removed 2026-08-11 after a dead-code sweep found zero `cva(`
  call sites. The re-skinned primitives express variants with plain props and `cn()`, so if a
  component ever genuinely needs CVA, re-approve it here rather than assuming it is still
  installed.
- Icons: `lucide-react`.
- Animation: `motion` (import from `motion/react`, never the deprecated `framer-motion` package
  name) — approved 2026-08-09 for the Home hub's orbital view: spring-physics hover on the
  workspace nodes, `AnimatePresence` for the info panel's hover/idle crossfade, and the center
  hub's pulse rings. The orbit's own position/depth/occlusion math stays outside it — a
  `requestAnimationFrame` loop mutating `ref`-held DOM nodes directly, with zero React
  re-renders per frame — `motion` only owns the parts that are naturally spring/exit
  animations. Don't reach for it as a general replacement for the CSS transitions and
  `@keyframes` used everywhere else in the app; those still apply.
- Markdown rendering: `react-markdown` + `remark-gfm` + `rehype-highlight` — added 2026-07-21 for
  the Design Drills LeetCode-editorial solutions. This reverses the earlier "no markdown renderer"
  call (migration 0025's comment), which the Lead Architect approved. Render **only** through the
  shared `src/components/ui/Markdown.tsx` wrapper — never add `rehype-raw` or otherwise render raw
  HTML from the DB, and don't reach for `@tailwindcss/typography`/`prose` (not installed; the
  wrapper maps elements onto the semantic tokens by hand).
- Syntax highlighting (editor): `highlight.js` — added 2026-07-22 for the Design Drills code pad's
  live highlighting. It was already on disk transitively (via `rehype-highlight`); this declares
  it directly so its version isn't governed by someone else's transitive range. Import from
  `highlight.js/lib/core` and `registerLanguage` only the grammars actually offered — a bare
  `import hljs from "highlight.js"` pulls all 384. Rendering its output via
  `dangerouslySetInnerHTML` is allowed **only** for the user's own scratchpad text (highlight.js
  HTML-escapes what it highlights); this is not a licence to relax the markdown rule above —
  `Markdown.tsx` still never renders raw HTML from the DB.
- PDF rendering: `pdfjs-dist` (Mozilla's PDF.js) — approved 2026-08-11 for the Reader module
  (migration 0042). Chosen over `react-pdf` because that's a wrapper around this same engine and
  its component API constrains the annotation overlay; the browser's native `<embed>` viewer was
  ruled out because it exposes no text coordinates, which makes highlighting impossible. Import
  from `pdfjs-dist` and set `GlobalWorkerOptions.workerSrc` to a worker copied into `public/` —
  never a CDN URL. Its text layer is what makes select-to-highlight work; the geometry that
  turns a selection into storable coordinates lives in
  `src/modules/reader/annotationGeometry.ts` and is unit-tested — don't reimplement it in a
  component.
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

## Project Status — everything planned is shipped (last verified 2026-08-11)

**All four waves and every later addition are done and merged to `main`**, with migrations
`0001`–`0043` applied and 1400 unit / 147 E2E tests green:

- **Wave 1** — Task Engine, Prep Tracker, Job Application CRM, Outreach Log, Daily Dashboard
- **Wave 2** — shared AppShell, task completion timestamps, Prep/CRM depth, Momentum
  (streaks + achievements), weekly review, auth + RLS, offer evaluator
- **Waves 3 & 4** — the visual system and the frontend upgrade (`docs/visual-refresh.md`,
  `docs/wave4.md`)
- **Later, each outside the original plan** — Personal Finance, Roadmap, Design Drills, LeetCode
  Tracker, Trading Journal, Knowledge Base UI, Command Palette, the Home orbital hub

**Knowledge Base and Command Palette are no longer V2** — both shipped. Any instruction elsewhere
to "not start those" is spent.

**The Curriculum shipped 2026-09-01** (migration 0043) — a software-engineering + ML textbook
laid out as a per-track prerequisite graph, NeetCode-style, at `/curriculum`. Read
`docs/handoff/curriculum.md` before touching it: it records five traps, including that
`content.ts` is server-only, that the chapter files need naming in `outputFileTracingIncludes`
or every chapter 404s in production while working in dev, and that its upsert needs a PLAIN
unique constraint rather than this schema's usual partial index (the 0014 → 0015 bug again).
The topic GRAPH is code (`curriculumCatalog.ts`) and the chapter PROSE is markdown files under
`content/curriculum/`; only progress is a table. New chapters are generated with
`docs/curriculum-authoring-prompt.md` and need no code change.

**The Reader shipped 2026-08-11** (PDF viewer + select-to-highlight annotation), so there is
now no unbuilt feature. Read `docs/handoff/reader.md` before touching it — it records two traps
that cost real debugging: pdfjs must be imported DYNAMICALLY (it touches `DOMMatrix` at module
scope, which throws during server render even from a `"use client"` component), and the text
layer's per-span CSS must actually apply or highlights anchor tens of pixels off the words —
a failure the E2E assertions could not see, because the coordinates were still validly 0-1.

`myhub_plan.md`'s Part A and Part B are now a RECORD of what was built and why, not a to-do list.
Read them for rationale; don't work through Part B's phases as if they're pending.

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

**The per-wave split tables that lived here have been removed rather than left as dead
reference** — every wave they described has shipped. Part B's "Sequencing & workload" table in
`myhub_plan.md` is likewise a record, not an assignment sheet.

For new work the split above still applies verbatim: publish the contract, hand the UI to Codex.
The Reader (`docs/handoff/reader.md`) is the live example — its contract is published and its
UI is Codex's.

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
