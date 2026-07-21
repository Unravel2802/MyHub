# Handoff — Design Drills: LeetCode-editorial solutions (Claude Code → Codex)

Published contract for the Design Drills "production study surface" upgrade. This
handoff covers **Phase 0 (markdown foundation)** and **Phase 1 (structured
editorial solution)** — the headline work. Later phases (deep-link routes,
bookmarks/search, progress + review queue, richer attempt history) get their own
contracts when scheduled; the full roadmap lives in the approved plan.

Claude owns: migrations, the TypeScript contract, the correctness-critical
defensive parser + its test, and the shared XSS-safe `<Markdown>` wrapper.
**Codex owns: the editorial UI, the wiring, the bulk solution content drafting,
and all tests.** Neither side touches the other's files.

Everything below is decided. If it's wrong or missing, **flag it — do not patch
around a stale contract.**

## What's already landed (Claude, branch `design-drills-editorial-contract`)

| File                                                        | State                                                                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                              | `react-markdown@^9`, `remark-gfm@^4`, `rehype-highlight@^7` added + approved in `CLAUDE.md`/`AGENTS.md`.                                                                         |
| `src/components/ui/Markdown.tsx`                            | Done — the **only** sanctioned markdown renderer. XSS-safe (no `rehype-raw`), GFM, `rehype-highlight`, elements mapped onto semantic tokens. Verified rendering in light + dark. |
| `app/globals.css`                                           | Done — `.md-content` highlight.js theme (built on the hue kit, so it re-themes automatically) + the inline-vs-fenced code reset.                                                 |
| `src/modules/designDrills/types.ts`                         | Done — new `DrillEstimate`, `DrillSolutionSection`, `DrillSolution`; `DesignDrill.solutionDetail: DrillSolution \| null` added.                                                  |
| `src/modules/designDrills/solutionDetail.ts`                | Done — `parseSolutionDetail(raw, slug)`: defensive jsonb → `DrillSolution \| null`, never throws, `console.error`s the reason.                                                   |
| `src/modules/designDrills/solutionDetail.test.ts`           | Done — 6 cases (valid, null, non-object, missing fields, malformed sections, estimate/reference filtering).                                                                      |
| `src/modules/designDrills/DesignDrillsRepository.ts`        | Done — `solution_detail: unknown` in the row, mapped via `parseSolutionDetail`. `getDrills` already `select("*")`, so it flows through. **No store change.**                     |
| `supabase/migrations/0027_design_drill_solution_detail.sql` | Done — adds `solution_detail jsonb` + **3 exemplars** (`url-shortener`, `rate-limiter`, `recommendation-system`).                                                                |

Verified: `tsc`, `eslint`, `npm test` (375) green; `npm run build` green (the new
deps bundle under Next 16 Turbopack). **Not yet run against a live Postgres** —
no local `psql`/`supabase` CLI and the Docker daemon was down this session. Apply
`0027` (and `0028`, below) on the dev Supabase stack and confirm the 3 exemplars
render before merging the UI.

## The contract you build against

```ts
interface DrillEstimate {
  label: string;
  value: string;
  note?: string;
}
interface DrillSolutionSection {
  id: string;
  heading: string;
  body: string;
} // body = GFM markdown
interface DrillSolution {
  summary: string; // intuition thesis (markdown)
  sections: DrillSolutionSection[]; // ordered editorial body
  estimates: DrillEstimate[]; // quantitative "scale, latency & cost" panel
  references?: { label: string; url: string }[];
}
// DesignDrill.solutionDetail: DrillSolution | null   (null ⇒ fall back to plain-text `solution`)
```

`<Markdown>` API: `<Markdown className?>{markdownString}</Markdown>`. Render every
section `body`, the `summary`, and (upgrade) the drill `prompt` through it. `id`
on a section is a URL-safe anchor slug — use it for the outline nav and
`#section` deep-links.

## Phase 1 — what Codex builds

1. **`src/modules/designDrills/components/SolutionEditorial.tsx`** — consumes a
   `DrillSolution`: intuition `summary` up top, an **outline nav** (jump to
   sections by `id`), the markdown `sections`, an **estimates panel** (chips or a
   small table of `label`/`value` + `note`), and optional `references`. Reuse
   `Badge`, `Panel`, `cn()`; hue via `DESIGN_DRILL_CATEGORY_HUES`.
2. **Wire into `DrillBrief.tsx`** — the Solution tab renders `<SolutionEditorial>`
   when `drill.solutionDetail` is non-null, else the existing `whitespace-pre-wrap`
   `solution` (fallback preserved). Keep the hand-rolled `role="tablist"` control
   — **no radix/shadcn Tabs.** Render the Prompt tab through `<Markdown>` too.
3. **Draft the remaining 22 `solution_detail` blobs** — restructure each existing
   plain-text `solution` (migrations 0025/0026) into the `DrillSolution` shape,
   following the 3 exemplars in `0027` as the quality bar. The content is mostly
   already there (requirements, API, key design, scale numbers); this is
   restructuring + light enrichment, not net-new authorship. Hand them to Claude
   as SQL (`jsonb_build_object`/`jsonb_build_array`, `$md$…$md$` bodies) or JSON —
   **Claude reviews and lands them in `0028_design_drill_solutions_backfill.sql`.**
   Do not create the migration file yourself (migrations are Claude's).
4. **Tests** — update `tests/ui/supabaseDesignDrillsMock.ts` (add `solution_detail`
   to the row type + `designDrillRow` factory) and `tests/ui/design-drills.spec.ts`:
   assert the editorial renders sections/estimates for a structured drill **and**
   the pre-wrap fallback still works for a legacy (null-`solutionDetail`) drill.
   The current spec asserts `whitespace-pre-wrap` on the solution panel — move
   that assertion onto the fallback-path drill.

## Hard constraints (do not re-litigate)

- **XSS**: render only through `<Markdown>`. Never add `rehype-raw`, never
  `dangerouslySetInnerHTML`, never render raw HTML from the DB.
- **No `@tailwindcss/typography`/`prose`** — it isn't installed; `<Markdown>` maps
  elements onto tokens by hand.
- **Solution stays always-viewable** (not gated behind finishing an attempt); the
  **rubric self-grade stays reveal-on-submit** — unchanged.
- **Soft-deletes, repository pattern, no God Tables**; cross-module only via the
  Event Bus (`drill.completed` already exists — no new event types this phase).
- Store errors: `console.error` the real error, return the generic user message.
