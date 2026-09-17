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

**All fourteen tracks are complete — 227 of 227 topics, the entire map:**

- **Distributed Systems** — 16 topics, 83 chapters
- **ML Systems & MLOps** — 16 topics, 48 chapters
- **LLMs & Frontier AI** — 18 topics, 19 chapters
- **Systems Design** — 18 topics, 18 chapters
- **Backend Engineering** — 21 topics, 22 chapters
- **Software Craft** — 20 topics, 20 chapters
- **Frontend Engineering** — 20 topics, 20 chapters
- **CS Foundations** — 18 topics, 28 chapters
- **Infrastructure & Ops** — 15 topics, 15 chapters
- **Security** — 11 topics, 11 chapters
- **Data Engineering** — 11 topics, 11 chapters
- **Engineering Practice** — 12 topics, 12 chapters
- **ML Foundations** — 17 topics, 17 chapters
- **Deep Learning** — 14 topics, 14 chapters

The first two run several chapters per topic; the ML spine, Systems Design,
Backend, Software Craft and Frontend run one long, dense chapter per topic.
CS Foundations is split: its first two topics (Programming Fundamentals,
Data Structures — written earliest, before the single-chapter convention
settled) run 6 chapters each; its other 16 run one chapter each, matching
everything written since. Both shapes are acceptable — the per-topic depth
differs, the per-chapter standard does not.

They are the worked examples of what a finished track looks like, and the standard
the rest should match: diagrams in every chapter, worked examples with real
intermediate values, named failure modes, and numbered takeaways that hand off to
the next chapter.

Systems Design is deliberately the thinnest per topic and the most cross-linked: it
is a track of worked interviews, and it leans on Distributed Systems for mechanisms
rather than restating them. Twelve of its eighteen topics are cases (feeds, chat,
storage, rate limiting, search, payments, ML, notifications, geo, video, metrics,
collaborative editing) sitting on six method topics.

Software Craft is language-and-framework-agnostic on purpose — it's the track
every other SWE-side track's code examples assume (clean naming, testing
strategy, error design), so it was written to stand alone rather than lean on
Backend or Frontend the way Systems Design leans on Distributed Systems.

Frontend leans on Software Craft directly and constantly (type design's
discriminated unions for a load-state, testing strategy's behavior-over-
implementation rule for `getByRole` queries, build tooling's tree-shaking for
bundlers) — it's the first track written after Craft that actually gets to
cash that decision in, rather than forward-referencing an unwritten chapter.

CS Foundations is the layer under every other track: several later chapters
across Backend, Frontend and Software Craft point DOWN into it (a struct's
cache-line behavior, a race condition's read-modify-write shape, why a
GC pause is user-visible) the same way Systems Design and Frontend point at
Distributed Systems and Software Craft. Completing it retroactively made
several of those earlier forward-references resolvable.

Infrastructure & Ops leans on both CS Foundations (a container is namespaces
and cgroups on the OS chapter's process model; the OOM killer is the memory-
management chapter's allocator meeting a cgroup limit) and Backend (a
connection pooler is the rate-limiting chapter's bulkhead pattern applied to
a database's connection cap; automatic failover is the Consensus chapter's
leader-election problem with a concrete blast radius). It also completes the
run/build/ship arc Backend and Software Craft started — CI/CD, SLOs, and
incident response are what happens to a service after it ships.

Security is the track everything else had already been citing by name
before it existed — least privilege, defense in depth, and the Security
Foundations chapter itself were referenced from Backend, Infra, and CS
Foundations chapters written months earlier. Its own chapters lean back
across nearly every prior track in turn: prompt injection restates Web
Application Security's SQL-injection shape with a harder sink; supply-chain
signing restates Applied Cryptography's signature mechanism applied to
distribution; automatic failover's split-brain risk (Infra) is the same
leader-election problem detection rules have to reason about here too.

Data Engineering is Backend's SQL and database-internals chapters turned
sideways, toward analytics instead of application state: a star schema's
deliberate denormalization is the opposite instinct from the SQL chapter's
normalization, on purpose, for a different read pattern; a table format's
atomic manifest swap is MVCC reimplemented at the filesystem level; CDC
reads the same write-ahead log the database-internals chapter introduced,
for a second purpose. Grain — what one fact row represents — is this
track's own load-bearing idea, the way trust boundaries are Security's.

Engineering Practice is the last track, and the register genuinely shifts:
less code, more judgment. It's also almost entirely retrospective in the
same way Security was — "the smallest reasonable extension," "ask, don't
decide, when a spec is ambiguous," this project's own architecture rules —
all get named explicitly here as instances of a general engineering
discipline (Product Sense's problem-first framing, Scoping's risk-first
sequencing) that earlier tracks had already been quietly practicing without
stopping to name.

339 chapters, ~375,000 words, ~104 hours of reading, across **227 of 227
topics — the full map, complete.** (`curriculumCatalog.ts`'s `t()` helper is
called exactly 227 times, one per topic; the `catalogCycles`/coverage script
in `curriculumLayout.ts` is the authoritative way to check this, not a
count typed into a doc — a stray earlier count of "228" in this file's own
history came from a regex matching a `.` argument inside the catalog's own
`id.split(".")[0]` helper code, not a topic, and was wrong for every commit
it appeared in. It's corrected here, at the finish line.)

`src/modules/curriculum/contentWidth.test.ts` fails the build on any fenced line
over 80 columns. It exists for generated content — chapters arrive from a model in
bulk and nobody will eyeball every fence.

The catalog holds 227 topics across 14 tracks. Adding a **topic** is a catalog edit; the unit suite will tell you if its
prereqs don't resolve.
