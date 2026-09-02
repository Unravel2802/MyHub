# Curriculum module — handoff

A software-engineering textbook you read end to end, laid out as a prerequisite
graph per track (the NeetCode roadmap picture, with progress bars). Route:
`/curriculum`, plus `/curriculum/[topicId]/[lessonId]` for a chapter.

## Where the three pieces live, and why

| Piece                               | Home                                          | Changes via |
| ----------------------------------- | --------------------------------------------- | ----------- |
| The graph (tracks, topics, prereqs) | `src/modules/curriculum/curriculumCatalog.ts` | a commit    |
| The prose (chapters)                | `content/curriculum/<topicId>/NN-slug.md`     | a commit    |
| Your progress (read, starred)       | `curriculum_progress` (migration 0043)        | a click     |

Same split as the Roadmap module: **only the part that is about you is data.**
The graph's shape is an editorial claim ("replication before consensus") and
belongs in review, not in a form.

The prose is on the **filesystem**, not in Postgres and not in a `.ts` array:

- A `.ts` array would ship every chapter to the browser to render a page that
  displays none of them.
- A table would put megabytes of markdown into every `scripts/exportData.ts`
  backup run.
- Files make the authoring loop right: drop a `.md` in, the topic gains a
  chapter.

## Traps, in the order they will bite

1. **`content.ts` is server-only.** It imports `node:fs`. Importing it from a
   `"use client"` file fails the build. `app/curriculum/page.tsx` is a server
   component whose only job is to call `loadCurriculumIndex()` and pass the
   result down — metadata only, never the bodies.

2. **The chapter files must be traced into the deployment.** The lesson route
   reads a file at request time from a path built at runtime, which Next's
   import-following trace cannot see. `next.config.ts` names the directory in
   `outputFileTracingIncludes`. Without it, every chapter 404s in production
   and works perfectly in dev.

3. **The upsert needs a PLAIN unique constraint, not a partial index.**
   Migration 0043 uses `unique (item_key)` deliberately, against the pattern
   most of this schema follows. PostgREST emits a bare
   `ON CONFLICT (item_key)`, and Postgres will only infer a partial index if
   the statement repeats its `WHERE` clause. This exact bug shipped once on
   `roadmap_progress` (migrations 0014 → 0015) and took a real database to
   find, because the E2E mock was faking the upsert.
   `tests/ui/supabaseCurriculumMock.ts` carries the same 42P10 guard that
   caught it.

4. **Grid items default to `min-width: auto`.** The graph's canvas has an
   explicit pixel width, so without `min-w-0` on the surrounding Panel it
   stretches the whole page instead of scrolling inside its own
   `overflow-x-auto` — and because the two Panels share a grid column, a wide
   one stretches BOTH. `tests/ui/responsive.spec.ts` covers both routes at
   390px.

5. **AppShell owns the page's `<h1>`.** The chapter reader's title is an `<h2>`,
   and `stripLeadingTitle` (`frontmatter.ts`) drops a body's opening `# Title`
   when it repeats the frontmatter title — otherwise every chapter renders its
   name twice and the page has two h1s.

## Layout

`curriculumLayout.ts` is longest-path layering (Kahn's algorithm) plus row
centring — no hand-placed coordinates, so a catalog edit can never leave a node
sitting on top of another. A prerequisite cycle strands nodes into a final row
rather than looping forever, and `catalogCycles` / `danglingPrereqs` turn either
mistake into a failing unit test.

Only **same-track** prereqs are drawn as edges. Cross-track ones are real and
are listed as text on the topic panel ("Also assumes: Linear Algebra for ML") —
drawing them would collapse thirteen readable graphs into one hairball.

## Adding material

See `docs/curriculum-authoring-prompt.md` for the generation prompt and
`content/curriculum/README.md` for the file format. Nothing else needs
touching: a new directory that matches a topic id appears on the map by itself.

## Content status

The **Distributed Systems track is complete** — all 16 topics, 83 chapters. It is
the worked example of what a finished track looks like, and the standard the rest
should match: diagrams in every chapter, worked examples with real intermediate
values, named failure modes, and numbered takeaways that hand off to the next
chapter.

Also written: Programming Fundamentals and Data Structures (CS Foundations), and
two chapters of Caching (Backend). Everything else is graph-only — the topic
appears on the map with a "no material yet" state, which is deliberate: the map is
complete from day one and the prose fills in behind it.

`src/modules/curriculum/contentWidth.test.ts` fails the build on any fenced line
over 80 columns. It exists for generated content — chapters arrive from a model in
bulk and nobody will eyeball every fence.

The catalog holds 227 topics across 14 tracks. Adding a **topic** is a catalog edit; the unit suite will tell you if its
prereqs don't resolve.
