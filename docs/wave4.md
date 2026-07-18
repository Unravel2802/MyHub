# Wave 4 — MyHub Frontend Upgrade

## Context

MyHub's first three waves are shipped: the full feature set (Task Engine, Prep,
Job CRM, Outreach, Dashboard, Momentum/streaks, Weekly Review, Roadmap, Offers,
Knowledge Base, Command Palette) plus a "premium developer tool" visual refresh
(`docs/visual-refresh.md`) and a per-module color layer (`docs/color-refresh.md`).
The design system is mature: semantic CSS-variable tokens, an 8-hue identity kit,
WCAG-AA enforced by an automated unit gate (`src/lib/palette.test.ts`), a
responsive AppShell, and hand-rolled UI primitives.

Because the obvious frontend work is already done, "upgrade" here means a
**quality-plus-features pass on four fronts** (per the user's decisions): tighten
the design system (A), modernize tooling with _selective_ shadcn adoption (B),
polish the visual language while **keeping the current indigo/zinc brand** (C), and
build net-new feature UI on top of the deferred-V2 contracts (D). Workstream A
lands first so B/C/D build on a clean base; B lands before C and D because both
consume its shadcn primitives and `cn()` helper.

## Non-negotiable constraints (inherited from the repo)

These rules are load-bearing across the codebase — the upgrade must preserve them:

- **Only `app/globals.css` names a raw color.** Components use semantic tokens
  (`bg-surface`, `text-hue-cyan`) or the hue-kit via inline `--hue`. A raw
  `bg-zinc-900`/`bg-sky-500` in a component is a bug (`src/components/moduleHues.ts`).
- **WCAG AA is measured, not assumed.** `src/lib/palette.test.ts` fails the unit
  suite if any text token drops below 4.5:1. Every new token must clear it.
- **Never tint absence.** Rates return `null`, render `—`, and stay untinted.
- **Both themes, always.** Every visual change ships light + dark.
- **`motion-reduce` on all animation** (already global in `globals.css`).
- **The Playwright specs are the regression gate** — `npm run test:ui` must stay
  green. Structural DOM changes require updating specs deliberately, not casually.
- **Claude owns contracts/tokens/pure-logic; Codex owns UI wiring** (~35/65 split,
  per `CLAUDE.md` / `AGENTS.md`). New shared primitives and token changes are
  Claude-owned; page-level application is Codex-owned.

## Workstream A — Design-system cleanup (do first; unblocks everything)

Foundational consistency pass. Small, high-confidence, no new deps.

1. **Migrate the one legacy raw-color file.** `src/modules/task/taskBoardConfig.ts`
   still uses `bg-sky-500 / bg-amber-500 / bg-teal-600 / bg-zinc-500` for column
   accents — the only file that never adopted the hue system. Replace the `accent`
   string with a `HueName` (or `null` for Done) and have `BoardColumn.tsx` resolve
   it through the existing `hueVar()` / hue-dot pattern already used in
   `AppShell.tsx:40-64`. Verify against `src/lib/palette.test.ts` conventions.
2. **Audit for other raw-color leaks.** `grep -rE "bg-(sky|amber|teal|zinc|rose|emerald|violet|blue|cyan|orange|fuchsia|indigo|slate|gray|neutral|stone)-[0-9]"`
   across `src/` and `app/` (excluding `globals.css`). Convert any hits to tokens.
3. **Consolidate the hue-map duplication.** `AppShell.tsx` inlines two full
   `Record<HueName, string>` maps (`hueDotClasses`, `activeClasses`). The same
   name→class mapping is re-derived in several primitives (`StatCard`, `Badge`,
   `ProgressBar`). Lift a single source of truth (e.g. `src/components/ui/hueClasses.ts`)
   exporting the static class strings so Tailwind's scanner still sees them, and
   import it everywhere. Reduces drift risk when a hue is added.
4. **Primitive coverage check.** Confirm every page routes chrome through the
   primitives (`PageHeader`, `Panel`, `StatCard`, `Badge`, `EmptyState`,
   `FormField`, `ProgressBar`); flag any bespoke re-implementations for folding in.

Critical files: `src/modules/task/taskBoardConfig.ts`,
`src/modules/task/components/BoardColumn.tsx`, `src/components/moduleHues.ts`,
`src/components/AppShell.tsx`, `src/components/ui/*`, `src/lib/palette.test.ts`.

## Workstream B — Tooling / framework upgrade

The docs mandate "Tailwind + shadcn/ui" but the app hand-rolled its primitives —
no Radix, CVA, clsx, tailwind-merge, or lucide. Two decisions here (see Open
Questions): shadcn adoption depth, and dependency version bumps.

- **shadcn/ui — selective adoption, token-preserving (confirmed).** Do **not** rip
  out the bespoke primitives or the token layer. Adopt shadcn/Radix only where
  accessible behavior is hard to hand-roll and the value is real: **Dialog**
  (Command Palette + any modal), **Popover/Command** (Cmd+K list), **Select**,
  **Tooltip**. Configure shadcn to emit into `src/components/ui/` and
  re-skin its generated classes onto the existing semantic tokens (shadcn's default
  `bg-background`/`bg-primary` → our `bg-surface`/`bg-accent`) so the two systems
  share one visual language. Add `clsx` + `tailwind-merge` (`cn()` helper) and
  `lucide-react` for icons (the app currently ships almost no iconography).
- **Dependency bumps.** Audit `npm outdated`; the stack is already current (Next
  16.2, React 19.2, Tailwind v4, Zustand v5, Vitest v4). Scope this to patch/minor
  security bumps + any shadcn peer deps, not a major-version migration.
- Update `AGENTS.md` / `CLAUDE.md` approved-dependency list to reflect the new deps
  (this is a stack change; the plan documents it rather than smuggling it in).

Critical files: `package.json`, new `components.json`, `src/lib/cn.ts` (new),
`src/components/ui/*`, `AGENTS.md`, `CLAUDE.md`.

## Workstream C — Visual / UX polish (keep current brand)

Refine the existing "premium dev tool" register — **no new brand identity**. The
indigo/zinc tokens and hue kit stay; this is polish, not a recolor. Token-first so
it applies app-wide from a small surface.

1. **Iconography.** Add `lucide-react` icons to nav items (`appNav.ts` gains an
   optional `icon` field), primitives, and empty states — the current UI is nearly
   text-only. Icons ride the existing per-module hue.
2. **Motion & depth polish.** Extend the existing `fade-up` / `hue-wash` /
   `hue-glow` utilities with tasteful page-transition and list entrance motion —
   still CSS keyframes, still `motion-reduce`-safe (no framer-motion; `AGENTS.md`
   forbids it).
3. **Density & hierarchy.** Optional compact/comfortable density driven by a token
   scale; revisit dashboard information hierarchy and card spacing.
4. **Consistency sweep.** With icons + shadcn primitives in place, walk every page
   in both themes and close the small gaps (alignment, empty states, focus rings).

Explicitly **not** doing: re-pointing `--accent` or the hue kit. The color system
stays as-is.

Critical files: `app/globals.css` (utilities only, not token values),
`src/components/appNav.ts`, `src/components/ui/*`, `src/components/AppShell.tsx`.

## Workstream D — Net-new frontend features

Both "deferred V2" modules (Knowledge Base `/notes`, Command Palette) already have
UI mounted, so this is enhancement built on shipped contracts, not greenfield. All
four items are in scope (user's choice):

1. **Command Palette upgrade** — rebuild on shadcn `Command` + `Dialog`
   (Workstream B): fuzzy search, grouped and recent commands, richer keyboard nav.
   Keep the existing `src/lib/commandPalette.ts` registry and per-module
   `register()`/`unregister()` contract; expand registrations per module.
2. **Knowledge Base upgrade** — richer note editor, bidirectional link-picker on a
   shadcn `Dialog` (handle `SelfLinkError`), a backlinks panel, and the open a11y
   item: fuchsia-vs-violet nav-dot distinguishability for color-blindness
   (`docs/handoff/knowledge-base.md`).
3. **Dashboard / Roadmap depth** — extend the existing SVG timeline, readiness
   radar, and `ActivityHeatmap` (`buildActivityGrid`) with new views; **extend, do
   not duplicate** the existing visualization code.
4. **Shortcuts + quick-add** — a global keyboard-shortcut layer and a `/` quick-add
   that hooks into the command-palette registry (reuse it, don't build a parallel
   dispatcher).

Follow the Claude/Codex split: any new store shape, migration, or pure logic is
Claude-owned and published as a contract before Codex wires the UI. Confirm none of
these need a schema change beyond what already shipped; if one does, flag it (per
`AGENTS.md`) rather than patching around it.

Critical files: `src/components/CommandPalette.tsx`, `src/lib/commandPalette.ts`,
`src/modules/knowledgeBase/*`, `src/modules/roadmap/*`, `src/modules/dashboard/*`.

## Work division (Claude Code ≈ 30% / Codex ≈ 70%)

Follows the repo's standing split: **Claude Code owns tokens, published TypeScript
contracts, correctness-critical pure logic, and any migration + its vitest; Codex
owns the majority — UI, wiring behind the contract, mocks, and E2E.** Target the
30/70 balance by code volume.

| Workstream            | Claude Code (~30%)                                                                                                                                           | Codex (~70%)                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Cleanup**       | Define the `HueName`-based `ColumnConfig` shape + the shared `hueClasses.ts` contract; run/adjust `palette.test.ts`                                          | Migrate `taskBoardConfig.ts` + `BoardColumn.tsx`, run the raw-color grep sweep and convert hits, fold bespoke chrome into primitives                     |
| **B — Tooling**       | Decide shadcn config + token re-skin mapping (shadcn vars → semantic tokens); author `cn()` helper; update `AGENTS.md`/`CLAUDE.md` approved-deps             | Run shadcn init, generate + re-skin Dialog/Command/Popover/Select/Tooltip into `src/components/ui/`, wire `lucide-react`, do the dependency bump PR      |
| **C — Visual polish** | Add any new `globals.css` utilities (motion/density tokens); extend the `appNav` type with the optional `icon` field                                         | Apply icons across nav/primitives/empty states, apply motion + density across pages, run the both-themes consistency sweep                               |
| **D — Features**      | Publish any new store/pure-logic contract (palette fuzzy-match ranking, KB backlink/`SelfLinkError` logic, shortcut-registry shape); flag any migration need | Build Command Palette on shadcn, KB editor + link-picker + backlinks UI, Dashboard/Roadmap visualizations, shortcut layer + `/` quick-add; write all E2E |

Constraint carried from `AGENTS.md`: Codex may not change a published interface,
design a schema, or write a migration — if a task appears to need one, flag it to
Claude Code rather than patching around it.

## Sequencing

1. **A first** — cleanup lands the single-source-of-truth hue classes and clears
   raw-color debt, so the rest builds on a clean base. (~small)
2. **B second** — introduces `cn()`, shadcn scaffolding, and icon dep; C and D
   both depend on its primitives.
3. **C and D in parallel** — C is token/primitive-level (broad, shallow) across all
   pages; D is module-level (narrow, deep). Minimal file overlap once B lands; the
   Command Palette touches `AppShell`/`CommandPalette.tsx`, which C's icon work also
   touches, so coordinate those two edits or land C's AppShell change first.

Run `npm run lint && npm run typecheck && npm run test && npm run test:ui` after
each workstream; keep the Playwright suite green throughout.

## Verification

- **Unit / token gate:** `npm run test` — includes `src/lib/palette.test.ts`; any
  new token failing 4.5:1 fails the build.
- **Types & lint:** `npm run typecheck` and `npm run lint`.
- **E2E regression:** `npm run test:ui` (Playwright) stays green; add specs for the
  new Command Palette, Knowledge Base link-picker, and shortcut behavior (Workstream D).
- **Manual, both themes:** run `npm run dev`, walk every module in light and dark,
  tab through with the keyboard to confirm focus rings, and check `prefers-reduced-motion`.
- **A11y spot-check:** color-blind check on nav hue dots (esp. fuchsia vs violet).

## Decisions locked

- shadcn adoption: **selective** (Dialog / Command / Popover / Select / Tooltip),
  re-skinned onto existing tokens; hand-rolled primitives kept.
- Brand: **refine current** indigo/zinc — no new identity, no token recolor.
- Net-new features: **all four** in Workstream D — Command Palette, Knowledge Base,
  Dashboard/Roadmap depth, and shortcuts + quick-add.
