# Handoff — Design Drills: `coding_design` category (Claude → Codex)

Design Drills gains a third category, **coding design**: LeetCode-"Design"-tag-style
problems (implement a class whose operations hit stated complexities), the shape Google
SWE intern coding rounds use. Same bank / timed attempt / rubric / editorial machinery —
only the content differs, so this is a new enum label, not a new module.

## Already landed by Claude

| Piece                                                                | State                                                                                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/0044_design_drill_coding_design_category.sql`   | Adds the enum label. **Apply on its own, first** — Postgres won't use a new enum value in the transaction that adds it.                               |
| `supabase/migrations/0045_design_drills_coding_design_seed.sql`      | 8 drills (2 warmup, 5 core, 1 advanced). Apply after 0044.                                                                                            |
| `supabase/migrations/0046_design_drills_coding_design_solutions.sql` | Structured editorials, C++/Java/Python3 tabs. All three languages were differentially tested against each other before the SQL was generated.         |
| `DesignDrillCategory` (`types.ts`, `src/lib/events.ts`)              | Widened with `"coding_design"`. `drill.completed` has no subscribers today, so nothing downstream changes.                                            |
| `designDrillHues.ts`                                                 | `coding_design: "cyan"` — Prep Tracker's `algorithm` hue.                                                                                             |
| `progress.ts`                                                        | `CATEGORIES` includes it; `drillCoverage` test added.                                                                                                 |
| Label maps in `DrillDetail` / `DrillWorkspace` / `DrillList`         | One `coding_design: "Coding design"` entry each — only because they're `Record<DesignDrillCategory, …>` and the contract wouldn't compile without it. |

## What Codex builds

1. **Category filter** — `DrillList.tsx`'s category `<select>` hard-codes two
   `<option>`s. Add `coding_design` ("Coding design"). Better: render the options from
   the `categoryLabels` map so the next category can't be forgotten here.
2. **Coverage panel** — `DrillProgressOverview.tsx` maps over a hard-coded
   `["system_design", "ml_system_design"]` tuple, so coding-design coverage never shows.
   Add the category (same "derive from one list" suggestion), and add the missing
   `coding_design` key to its own `categoryLabels`.
3. **Estimates panel heading** — `SolutionEditorial.tsx` titles the estimates table
   "Scale, latency & cost / Back-of-the-envelope figures that shape the architecture."
   For a `coding_design` drill those rows are per-operation Big-O, so that copy is wrong.
   Make the overline/description depend on the drill's category — e.g. **"Complexity"** /
   "Time and space per operation." — which means threading `category` (or a pre-chosen
   heading) into `SolutionEditorial`. Don't change the `DrillSolution` shape.
4. **Tests** — unit: the filter narrows to coding-design drills; the coverage panel
   renders a coding-design row; the editorial heading switches by category. E2E: open a
   coding-design drill, confirm the "Coding design" badge, start an attempt, submit, and
   confirm the Complexity panel heading on the revealed editorial.

Not needed: a code-pad default language. The pad's language choice is already persisted
in localStorage, so picking Python once sticks.

## Don't

- Don't edit the seed SQL's code blocks one language at a time — they're a tested set.
  If one is wrong, flag it and Claude regenerates all three.
- Don't add a new column for complexity; `estimates` is the slot (see
  `design-drills-problem-template.md` §2).
