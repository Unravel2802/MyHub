# Codex prompt — Design Drills `coding_design` UI follow-up

The contract, migrations and seed data for the `coding_design` category merged in #53
(`docs/handoff/design-drills-coding-design.md`), and the 8 drills are live in Supabase. These
UI changes are what's left.

---

```
Finish the UI for the Design Drills "coding_design" category. Read
docs/handoff/design-drills-coding-design.md first; it is the spec. Also read CLAUDE.md /
AGENTS.md for the project rules (Tailwind + semantic tokens only, shadcn/ui primitives as
already used, no new dependencies).

Context: DesignDrillCategory is now "system_design" | "ml_system_design" | "coding_design"
(src/modules/designDrills/types.ts). The contract, hues (designDrillHues.ts: coding_design is
"cyan") and coverage logic (progress.ts drillCoverage, which already returns a coding_design
bucket) are DONE. Do not change types.ts, src/lib/events.ts, progress.ts, designDrillHues.ts,
solutionDetail.ts, any repository/store file, or anything under supabase/migrations. If you
think one of them is wrong, stop and say so in your final message instead of editing it.

Build exactly these four things:

1. CATEGORY FILTER: src/modules/designDrills/components/DrillList.tsx
   The category <select> hard-codes two <option>s. Render the options from that file's
   existing `categoryLabels` map (Record<DesignDrillCategory, string>), keeping "All
   categories" first and keeping the current order: system design, ML system design,
   coding design. The point is that a future category can't be forgotten here.

2. COVERAGE PANEL: src/modules/designDrills/components/DrillProgressOverview.tsx
   "By category" maps over a hard-coded ["system_design", "ml_system_design"] tuple, so
   coding-design coverage never renders. Derive the list so all three categories render, and
   add coding_design: "Coding design" to this file's own categoryLabels (type it as
   Record<DesignDrillCategory, string> so the compiler catches the next omission).

3. ESTIMATES PANEL HEADING: src/modules/designDrills/components/SolutionEditorial.tsx
   The estimates table is always titled overline "Scale, latency & cost" with description
   "Back-of-the-envelope figures that shape the architecture." For coding_design drills those
   rows are per-operation Big-O, so use overline "Complexity" and description
   "Time and space per operation." Other categories keep the current copy exactly. Thread the
   drill's category into SolutionEditorial as a prop from wherever it's rendered (find the
   call sites). Do NOT change the DrillSolution data shape.

4. TESTS
   - Unit (Vitest + Testing Library, following existing component-test patterns in the repo):
     the filter lists all three categories and narrows to coding-design drills when picked;
     the coverage panel renders a "Coding design" row; SolutionEditorial shows "Complexity"
     for coding_design and "Scale, latency & cost" for system_design.
   - E2E (tests/ui/design-drills.spec.ts, following how that file already supplies drill
     data): add a coding_design drill fixture, then check that it shows the "Coding design"
     badge, that the category filter can select it, and that after submitting an attempt the
     revealed editorial's estimates panel is headed "Complexity".

Verify before finishing: npm run lint, npm run typecheck, npm test, and
npx prettier --check on every file you touched. Run the E2E file with
npx playwright test tests/ui/design-drills.spec.ts if your sandbox allows starting the dev
server; if it doesn't, say so plainly and don't claim E2E passed.

Do NOT commit. Leave the changes in the working tree; Claude reviews the diff and commits.
End with a short summary: files changed, what each test asserts, verification results.
```
