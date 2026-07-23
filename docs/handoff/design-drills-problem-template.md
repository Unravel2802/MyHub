# Design Drills: problem authoring template

A fill-in-the-blanks reference for adding a new drill, so any contributor (human or agent) can
write a correct migration without reverse-engineering the schema from prior migrations. This is
not a changelog like the other `design-drills-*.md` handoff docs — it's the standing template.
Read `src/modules/designDrills/types.ts` and `src/modules/designDrills/solutionDetail.ts` for the
authoritative types/validation; this doc exists so you don't have to.

## 1. The `design_drills` row

One `insert into design_drills (...)` per new drill (see `supabase/migrations/0026_...sql` for a
full worked example). Required columns:

| Column              | Type                                    | Notes                                                                                                                                                                                                                                         |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`              | text, unique                            | URL-safe, kebab-case, used in `/design-drills/<slug>` and as the stable key every later migration targets with `where slug = '...'`. Never rename once shipped.                                                                               |
| `category`          | `'system_design' \| 'ml_system_design'` | See `DesignDrillCategory` in `types.ts`.                                                                                                                                                                                                      |
| `difficulty`        | `'warmup' \| 'core' \| 'advanced'`      | See `DesignDrillDifficulty`.                                                                                                                                                                                                                  |
| `title`             | text                                    | Display title, e.g. `'Distributed Unique ID Generator'`.                                                                                                                                                                                      |
| `prompt`            | markdown (`$$...$$` dollar-quoted)      | The full prompt: scale, constraints, functional asks — OA/onsite length. Rendered through the shared `<Markdown>` component, so GFM (tables, fenced code, etc.) all works.                                                                    |
| `rubric`            | `array[$r$...$r$, ...]` of text         | One bullet per array element — "what a strong answer hits." Revealed only after an attempt is submitted, so write it as a grading checklist, not more prompt.                                                                                 |
| `solution`          | text (`$sol$...$sol$`)                  | Legacy plain-text fallback, rendered `whitespace-pre-wrap`. Write a real worked answer here even if you're also authoring `solution_detail` (§2) in the same migration — `solution` is what renders if `solution_detail` ever fails to parse. |
| `estimated_minutes` | integer                                 | Target time for a timed attempt.                                                                                                                                                                                                              |
| `tags`              | `array['...', ...]` of text             | Free-text, shown as pills and searchable via `filterDesignDrills.ts`.                                                                                                                                                                         |

## 2. The structured editorial (`solution_detail` jsonb)

Optional but expected for any new drill — this is what actually renders as the LeetCode-style
editorial (`SolutionEditorial.tsx`). Shape (`DrillSolution` in `types.ts`):

```ts
{
  summary: string;        // markdown — the intuition thesis, shown up top
  sections: [
    { id: string; heading: string; body: string; codeExamples?: [...] },
    ...
  ],
  estimates: [
    { label: string; value: string; note?: string },
    ...
  ],
  references?: [{ label: string; url: string }],
}
```

Author it as a **separate migration** from the row insert (matches how every past drill has been
built: seed migration → later migration adds `solution_detail`), using
`jsonb_build_object`/`jsonb_build_array` with dollar-quoted string literals so markdown/code
content never needs manual quote-escaping:

```sql
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Two or three sentences: the core tension and what actually
resolves it.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'requirements', 'heading', 'Requirements', 'body', $md$
- Functional asks, one bullet each.
- Non-functional asks (scale, latency, consistency).
$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$
One or two sentences of context for the code below — what mechanism it shows and why it's the crux.
$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$
// 15-40 lines, idiomatic, the actual load-bearing mechanism
$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$
// same mechanism, idiomatic Java
$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$
# same mechanism, idiomatic Python
$py$)
    ))
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', 'Write throughput', 'value', '~1.2K rps', 'note', '100M writes/day, average')
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', 'Some reference', 'url', 'https://example.com')
  )
) where slug = 'your-new-slug';
```

Worked full examples to copy the SQL style from: `supabase/migrations/0027_design_drill_solution_detail.sql`
(the original 3 exemplars) and `0031_design_drill_solution_code_tabs.sql` (every drill's current
`codeExamples`, including the append-vs-replace pattern for adding a section to an
already-migrated row).

### Hard rules

Enforced by `solutionDetail.ts`'s parser — get these wrong and the section/field silently
vanishes, no error, just falls back:

- `sections[].id` must be a URL-safe, **unique-within-the-drill** slug (it's the anchor target
  for `#section` deep-links and the outline nav).
- If you include `codeExamples`, it must be **exactly** three entries, `language` exactly
  `"cpp"` / `"java"` / `"python"` (lowercase, nothing else accepted), `label` exactly `"C++"` /
  `"Java"` / `"Python3"` (this isn't parser-validated but must match to look right — LeetCode's
  own wording, not "Python"). All three should express the **same mechanism**, not three
  unrelated snippets — pick the single most load-bearing piece of the design (the thing an
  interviewer would actually want to see coded), not the whole system.
- `estimates[].label`/`.value` are required strings; `.note` is optional. These stand in for
  algorithmic Big-O in a system-design drill — throughput, latency, storage, cost — not code
  complexity.
- `references` is optional; a malformed URL (must parse as `http:`/`https:`) is silently dropped,
  not the whole editorial.

## 3. Sanity-check before committing

There's no live Postgres to test dollar-quote/paren balance against in this workflow — eyeball
it: every `$tag$...$tag$` you open must close with the same tag, and reused tags across a file
(e.g. `$md$` for every section's `body`) must still appear an even number of times in total. If
you're authoring many drills' `codeExamples` at once, pick one tag per language and reuse it
everywhere (`$cpp$`/`$java$`/`$py$`) rather than a unique tag per drill — makes the balance check
a single `grep -c` instead of eyeballing each block individually.

## 4. After the migration lands

- The app never needs a code change to pick up a new drill — `useDesignDrillsStore.ts` fetches
  the whole `design_drills` table and `filterDesignDrills.ts`/`DrillList.tsx` render whatever's
  there, numbered and paginated automatically.
- Don't forget: this is additive-only, matching every prior Design Drills migration's convention
  — re-running the same migration twice will double-apply it (append `codeExamples` twice, etc.),
  so it is not written to guard against re-running, the same as 0027/0028/0030/0031.
