# Curriculum exercises, chapter openers, and the enrichment pass — handoff (Codex)

**Why.** Reading the curriculum feels flat. The reader can already show
diagrams, charts, callouts, check-yourself questions and widgets
(`curriculum-reader-redesign.md`), but only Systems Design and Distributed
Systems DS1–DS2 use them: **276 of 338 chapters are still plain prose.** This
brief adds three things and then applies them to every chapter:

1. **Exercises** at the end of every chapter: three graded problems with
   hint and solution reveals.
2. **A chapter opener**: a "Why this matters" box and a "By the end you'll be
   able to…" list before the first section.
3. **Reading counts toward the Momentum streak**: marking a chapter read makes
   that day an active day.

Then **the enrichment pass** brings every remaining track up to the
Systems Design standard and adds exercises and openers everywhere, so each
chapter is edited and reviewed once.

Read `docs/handoff/curriculum.md` (five traps) and
`docs/handoff/curriculum-reader-redesign.md` (the callout machinery, the
content gates, PR D's prompt) first. Everything there still applies.

**Ownership.** Codex builds all of it: components, the pure helpers, their
unit tests, E2E specs and the content batches. Claude owns this contract and
reviews each PR, including re-deriving every exercise solution. If the
contract looks wrong mid-build, flag it; don't patch around it.

**Decided 2026-11-06 (Lead Architect):** exercise results are NOT stored.
Hint and solution are reveal-only, with no table, no migration, no
`localStorage` and no "Got it / Revisit" buttons. Self-graded tracking with a
review queue may come later as its own decision; don't build toward it.

**PRs, in order.** Each leaves `main` green.

| PR  | What                                                 | Branch                       |
| --- | ---------------------------------------------------- | ---------------------------- |
| X1  | Exercises: syntax, helpers, rendering, gates, seed   | `curriculum-exercises`       |
| X2  | Chapter opener: `[!WHY]` and `[!GOALS]`              | `curriculum-opener`          |
| X3  | Momentum: reading days count toward the streak       | `momentum-curriculum-streak` |
| X4+ | Enrichment pass, one batch per branch (table in §X4) | `curriculum-enrich-<batch>`  |

X1–X3 are independent and can be built in any order. X4 batches need X1 and
X2 merged.

---

## X1 — Exercises

### X1.1 Syntax

A chapter's **last** h2 is `## Exercises`, directly after
`## What to take away` (and after that section's closing "Next: …" line, if
it has one). It holds exactly three exercise blockquotes, in this order:

```markdown
## Exercises

> [!EXERCISE recall] Name the four calculations, and say what design decision
> each one informs.
>
> **Solution:** QPS decides how many servers …

> [!EXERCISE apply] A URL shortener has 10M DAU …
>
> **Hint:** Use 86,400 ≈ 10⁵ …
>
> **Solution:** …

> [!EXERCISE stretch] …
>
> **Hint:** …
>
> **Solution:** …
```

Inside one blockquote:

- **Prompt:** every block before the first `**Hint:**` or `**Solution:**`
  paragraph. It may span several paragraphs, a list, a table or a fenced
  block.
- **Hint:** optional. It starts at a paragraph whose first child is
  `<strong>Hint:</strong>` and runs until the Solution paragraph.
- **Solution:** required. It starts at a paragraph whose first child is
  `<strong>Solution:</strong>` and runs to the end of the blockquote.

The `Hint:`/`Solution:` labels are stripped when rendered, since the
disclosure's summary already says it. Detect them on the hast node, not with
a regex over the source, the same as the callout markers.

The three levels:

| Level     | Label   | What it asks                                                                                                                 |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `recall`  | Recall  | Restate or explain a core idea in your own words. Answerable from the chapter's text alone.                                  |
| `apply`   | Apply   | A worked problem with **new numbers or a new scenario**, solved the chapter's way. Solution shows working.                   |
| `stretch` | Stretch | Open-ended: a design call, a trade-off, a sanity check. The solution is a model answer and says what a weaker answer misses. |

### X1.2 Pure helpers

In `src/modules/curriculum/chapterStructure.ts`, next to `splitTakeaways`
and with the same shape and fenced-block awareness:

```ts
// `exercises` is the `## Exercises` section's body WITHOUT its heading, up to
// the next "## " or EOF; `main` is everything else, unchanged. No heading →
// exercises null. Matches the heading case-insensitively, like splitTakeaways.
export function splitExercises(body: string): {
  main: string;
  exercises: string | null;
};
```

`LessonReader` calls `splitExercises` **first** and then `splitTakeaways` on
its `main`. Otherwise `splitTakeaways` returns the Exercises section as part
of `main`, and it renders inside the body.

In `src/modules/curriculum/callout.ts`:

```ts
export const CALLOUT_KINDS = [
  "KEY",
  "PITFALL",
  "INTERVIEW",
  "CHECK",
  "EXERCISE",
  "WHY",
  "GOALS",
] as const;
export const EXERCISE_LEVELS = ["recall", "apply", "stretch"] as const;
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number];

// Extended: EXERCISE carries a level. `[!EXERCISE]` with no level, or an
// unknown one, returns null, so it renders as a plain quotation (and the
// content gate fails it).
export function calloutMarker(
  node: Element | undefined,
): { kind: CalloutKind; prefix: string; level?: ExerciseLevel } | null;
```

`isKeyRule` already excludes any `[!…]` marker, so nothing changes there.

### X1.3 Rendering

On the page, in order: body → recap card ("What to take away") → **exercises
section** → finish card.

- The section's h2 is "Exercises". It appears in the TOC and is numbered like
  the recap's h2. `ReadingProgress`'s time-left estimate includes it, since it
  is body text.
- Each exercise is a card with the same frame as the recap card (`--surface`,
  `--border`, 14px radius). Its header is a mono label "Exercise 1/2/3" plus a
  level pill:
  - Recall: `--track-surface` / `--track`
  - Apply: `--hue-amber-*`
  - Stretch: `--hue-violet-*`

  Use the same tokens as the PITFALL and INTERVIEW callouts. Add no new colour
  tokens.

- The prompt renders through the shared `Markdown` with the curriculum's
  overrides, so charts, code and tables work inside a prompt.
- **Hint** and **Solution** are two independent native `<details>`, with
  summaries "Hint" and "Show solution", following B2's check-yourself
  pattern. Opening the solution does not require opening the hint first. No
  state persists: a reload closes them.
- An `[!EXERCISE …]` blockquote **outside** `## Exercises` renders as a plain
  quotation. The gate below keeps that from shipping.

### X1.4 Content gates (extend `visualContent.test.tsx`)

For every chapter that has `## Exercises`:

- it is the last h2, and the h2 before it is "What to take away";
- it contains exactly three `[!EXERCISE …]` blockquotes, in the order recall,
  apply, stretch, and nothing else except blank lines;
- each one has a non-empty prompt and a non-empty Solution;
- no `[!EXERCISE …]` appears anywhere else in the file.

Coverage gate: add `EXERCISE_TRACKS: string[]` (topic-id prefixes, e.g.
`"systems-design."`), and assert that every chapter under those prefixes has
`## Exercises`. It starts as `["systems-design.estimation"]` (the seed) and
each X4 batch appends its prefixes, the same way the track-driven E2E gate
grows.

### X1.5 Seed

Add the Appendix A content to
`content/curriculum/systems-design.estimation/01-back-of-envelope.md`
exactly as written, after "What to take away", changing nothing else.

E2E (extend `curriculum-charts.spec.ts` or a new `curriculum-exercises.spec.ts`):

- the chapter shows three exercise cards with labels Recall, Apply and
  Stretch;
- "Exercises" is in the TOC;
- the solution is hidden by default (its text is not visible), and opening it
  shows the text;
- the hint opens independently of the solution;
- at 390px there is no page-level horizontal scroll.

---

## X2 — Chapter opener

### X2.1 Syntax

Two new callout kinds. Both are optional, each may appear at most once, and
both go **before the chapter's first `## ` heading**, WHY first. They usually
come after the chapter's existing opening paragraph(s), which are never
rewritten.

```markdown
> [!WHY] Two to four sentences: a concrete moment where this topic decides the
> outcome. Name the situation, not the concept.

> [!GOALS]
>
> - Compute …
> - Explain …
> - Choose …
```

The blank `>` line after `[!GOALS]` is **required**: without it the marker
paragraph and the list merge in some edge cases, and `calloutMarker` needs a
`<p>` first child. Goals are 3–4 items, each starting with an observable verb
(compute, explain, choose, spot, design). Avoid "understand" and "learn".

### X2.2 Rendering

- `[!WHY]`: label "Why this matters", using the KEY callout's frame but with
  the label in `--track` and body text one step larger than other callouts.
  It is the chapter's hook, so make it the most prominent box above the fold.
- `[!GOALS]`: label "By the end you'll be able to". The list items get a
  small `lucide-react` `Target` (or `CircleCheck`) icon in `--track` instead
  of bullets. Same frame tokens as above. No checkboxes, because these don't
  track state.
- Neither enters the TOC.

### X2.3 Gates

At most one of each per chapter, both before the first `## `, and WHY before
GOALS when both are present. GOALS holds exactly one list of 3–4 items.
Unknown-kind and marker-placement checks follow the existing pattern.
Coverage uses the same `EXERCISE_TRACKS` list as X1.4, since the pass adds
openers and exercises together: every covered chapter has both.

Seed: Appendix A's WHY and GOALS, in the same estimation chapter, after its
opening paragraph. E2E: both boxes render above the first section heading,
and neither appears in the TOC.

---

## X3 — Momentum counts reading days

The contract is already published: `src/lib/events.ts` has
`curriculum.lesson_completed` and `curriculum.lesson_uncompleted`, with
payload `{ lessonKey }`.

- **Emit** in `useCurriculumStore.setCompleted`, inside the `try` and after
  `await CurriculumRepository.setCompleted(...)` resolves: `completed` when
  `next` is true, `uncompleted` when it is false. Never emit in the `catch`
  (rollback) path.
- **Momentum store:** `refresh()` also fetches
  `CurriculumRepository.getProgress()`, following its existing pattern of
  reading each module through that module's repository. `subscribeToUpdates`
  adds both new event types to the refresh `case` list.
- **`streaks.ts`:** `ActivitySnapshot` gains
  `curriculumProgress: LessonProgress[]` (type imported from
  `@/src/modules/curriculum/types`, like the other sources). `activityDates`
  and `activityCounts` add `safeDayKey(entry.completedAt)` for each entry,
  skipping null. A cleared mark has `completedAt: null`, so un-marking
  removes the day with no special case.
- **Unit tests** (`streaks.test.ts`): a completion counts its local day; a
  null `completedAt` adds nothing; a completion and a task on the same day
  count once in `activityDates` and twice in `activityCounts`; a malformed
  timestamp is skipped, not thrown.
- **E2E:** marking a chapter read with no other activity today turns the
  streak's "active today" state on; un-marking turns it off.

**Out of scope: achievements.** `achievementCatalog.ts` requires every
threshold to trace to the roadmap (`source`). Curriculum achievements ("first
track complete") need that justification from the Lead Architect first, so
don't add any here.

---

## X4 — The enrichment pass

### X4.1 Which prompt each chapter gets

| Chapters                                               | Visuals                                               | Opener + exercises |
| ------------------------------------------------------ | ----------------------------------------------------- | ------------------ |
| Systems Design, DS1, DS2 (already enriched)            | none, already done                                    | add                |
| DS3, DS4 (`curriculum-reader-redesign.md`'s DS plan)   | the DS quotas, unchanged                              | add                |
| Every other track, topic with **one** chapter          | PR D's quotas (3 CHECKs)                              | add                |
| Every other track, topic with **two or more** chapters | the DS quotas (2 CHECKs, per-topic PITFALL/INTERVIEW) | add                |

PR D's prompt applies as written for visuals (TB flowcharts, a chart only for
numbers the chapter states, KEY conversions keep wording, every fenced line ≤ 76
columns, no `widget` blocks). Append the following to it:

```text
ALSO ADD, for every chapter:

5. An opener, before the first "## " heading and after the chapter's existing
   opening paragraph(s), which you must not change:
     > [!WHY] 2–4 sentences. A concrete moment — an incident, a design review,
     > an interview question, a bill — where this chapter's idea decides the
     > outcome. Specific nouns and numbers; no "In this chapter we will".

     > [!GOALS]
     >
     > - 3–4 items, each starting with an observable verb (compute, explain,
     >   choose, spot, design, trace). Never "understand" or "learn".
     >   Every goal must be something the chapter actually teaches.

6. A final section, after "## What to take away" and its closing line:
     ## Exercises
   containing exactly three blockquotes, in this order:
     > [!EXERCISE recall] — restate or explain a core idea. Answerable from the
       chapter's text alone.
     > [!EXERCISE apply] — a NEW worked problem (new numbers or a new scenario,
       never the chapter's own example re-skinned), solved the chapter's way.
     > [!EXERCISE stretch] — open-ended: a design call, a trade-off, or a sanity
       check of someone else's claim.
   Each: the prompt; then, after a blank ">" line, an optional paragraph
   starting "**Hint:**"; then, after a blank ">" line, a paragraph starting
   "**Solution:**". Apply solutions show every intermediate value. Stretch
   solutions give a model answer AND name what a weaker answer misses.
   No exercise may repeat a > [!CHECK] question in the same chapter.
   Exercises may lean on prerequisite chapters but must be solvable without
   any source outside this curriculum.
```

For already-enriched chapters, send only items 5–6, prefaced with the same
"do not rewrite, reorder or delete" instruction.

### X4.2 Batches

One branch per batch, each reviewed by Claude before the next starts.
Prerequisite order, so later chapters' exercises can lean on earlier ones.

| Batch | Scope                                                     | Chapters |
| ----- | --------------------------------------------------------- | -------- |
| E0    | Systems Design (opener + exercises only)                  | 18       |
| E1    | DS1 topics (opener + exercises only)                      | 23       |
| E2    | DS2 topics (opener + exercises only)                      | 21       |
| DS3   | As planned, plus opener + exercises                       | 21       |
| DS4   | As planned, plus opener + exercises                       | 18       |
| F1    | CS Foundations: programming fundamentals, data structures | 12       |
| F2    | CS Foundations: the other 16 topics                       | 16       |
| C     | Software Craft                                            | 20       |
| B     | Backend Engineering                                       | 22       |
| FE    | Frontend Engineering                                      | 20       |
| I     | Infrastructure & Ops                                      | 15       |
| S     | Security                                                  | 11       |
| D     | Data Engineering                                          | 11       |
| EP    | Engineering Practice                                      | 12       |
| MF    | ML Foundations                                            | 17       |
| DL    | Deep Learning                                             | 14       |
| MS1   | ML Systems, first 8 topics in prerequisite order          | ~24      |
| MS2   | ML Systems, last 8 topics                                 | ~24      |
| L     | LLMs & Frontier AI                                        | 19       |

Each batch:

1. Append its topic prefixes to `EXERCISE_TRACKS` (X1.4) and to the
   track-driven E2E gate.
2. Run `npm run test:ui -- content` and the track E2E gate. Open every
   chapter once in dev, because Mermaid syntax errors only show when a
   diagram renders.
3. Check that every original prose line survives (the DS1 review's diff
   check).
4. Make one commit per topic, with the message
   `content(curriculum): enrich <topic id>`.

**Claude's review per batch** (as in the DS1 review): quotas; that every
chart value is stated in its chapter; **every CHECK answer and exercise
solution re-derived**; that every goal is actually taught; and the hyphen-wrap
gate.

### X4.3 Done when

- X1–X3 merged, with lint, typecheck, unit and E2E green.
- `EXERCISE_TRACKS` covers all fourteen tracks: all 338 chapters have an
  opener and three exercises, and every chapter passes the visual quotas for
  its row in X4.1.
- `docs/handoff/curriculum.md`'s "Adding material" and
  `docs/curriculum-authoring-prompt.md` require openers and exercises in new
  chapters (append X4.1's items 5–6 to the authoring prompt).
- The status line below is current.

**Status:** X1–X3 merged 2026-11-11. X4: E0 merged 2026-11-11; E1 approved 2026-11-11 (see the E1 reviews at the end); E2 is next.

---

## Appendix A — seed content (exact)

For `content/curriculum/systems-design.estimation/01-back-of-envelope.md`.

**Opener**, inserted after the opening paragraph ("Estimation is how you find
out…") and before `## The numbers to memorise`:

```markdown
> [!WHY] Ten minutes into a design review, someone proposes sharding the
> database. Whether that is essential or premature comes down to one number you
> can work out on a napkin: peak writes per second against what one primary
> handles. This chapter is how you get that number before anyone draws a box.

> [!GOALS]
>
> - Compute peak QPS, storage, bandwidth and cache size from a few stated
>   assumptions
> - Recall the latency, size and capacity numbers well enough to round with
>   confidence
> - Turn each number into a verdict — partition, cache, CDN — rather than
>   leaving it as arithmetic
> - Spot the two costs most estimates forget: media storage and egress
```

**Exercises**, appended after the final line ("Next: choosing where the data
lives."):

```markdown
## Exercises

> [!EXERCISE recall] Name the four calculations, and for each one say what
> design decision it informs.
>
> **Solution:** QPS decides how many servers you need, and whether one
> database primary can take the writes. Storage decides whether the data fits
> on one machine or must be partitioned, and whether bulky data belongs in
> object storage. Bandwidth decides network capacity and whether a CDN is
> needed to keep egress affordable. Cache memory decides whether the hot
> working set fits in RAM, which with the 80/20 rule usually means caching
> the hottest 20% of the data.

> [!EXERCISE apply] A URL shortener has 10M DAU. Each user creates 1 short
> link and follows 20 links a day. Peak is 5× average. Each link record is
> 500 B, kept for 5 years, with 3× replication and 1.3× index overhead. Work
> out peak writes/s, peak reads/s and total storage, and say what each number
> rules in or out.
>
> **Hint:** Use 86,400 ≈ 10⁵ seconds a day, and do reads and writes
> separately. Storage is records/day × size × days × replication × overhead.
>
> **Solution:** Writes: 10M a day ÷ 10⁵ ≈ 100/s average, × 5 ≈ **500/s at
> peak**. That is far below one Postgres primary's 20k–50k, so writes force
> nothing. Reads: 200M a day ÷ 10⁵ ≈ 2,000/s average, × 5 ≈ **10,000/s at
> peak**. One server could just about serve that, but at a 20:1 read:write
> ratio the right move is a cache in front, and since popular links are
> heavily skewed, a small hot set gives a high hit rate. Storage:
> 10M × 500 B = 5 GB a day, × 365 × 5 ≈ 9 TB, × 3 replication ≈ 27 TB,
> × 1.3 ≈ **35 TB**, about 12 TB per replica. That fits comfortably in one
> NVMe server's 10–100 TB, so storage doesn't force partitioning either. The
> design is one primary, replicas and a cache, and you've shown why.

> [!EXERCISE stretch] A colleague's estimate says a video-upload service
> needs 3 PB of storage a year. Without redoing their whole model, how would
> you sanity-check that figure, and which assumption would you challenge
> first?
>
> **Hint:** Work backwards from 3 PB to minutes of video per day, once with
> replication and overhead and once without.
>
> **Solution:** 3 PB a year ÷ 365 ≈ 8 TB a day. If that already includes 3×
> replication and 1.3× overhead, the raw upload is about 8 ÷ 3.9 ≈ 2 TB a
> day, or at 50 MB per 1080p minute, about 40,000 minutes (~700 hours) of
> video a day. If it doesn't include them, it's about 160,000 minutes a day,
> and the true storage bill is roughly 4× higher at about 12 PB. So the
> first question is whether replication and overhead are in or out, because
> that one assumption moves the answer 4×. The next is whether the uploads
> per day match the product's real scale, judged against a known system. A
> weaker answer redoes the multiplication with the same inputs. That checks
> the arithmetic, not the assumptions, and the assumptions are where
> estimates go wrong.
```

Arithmetic check (for the reviewer): 10M ÷ 86,400 = 116 → ×5 = 579 writes/s;
200M ÷ 86,400 = 2,315 → ×5 = 11,574 reads/s (rounded to "500" and "10,000"
via 10⁵, as the chapter teaches). 5 GB × 1,825 = 9.1 TB → ×3 = 27.4 TB →
×1.3 = 35.6 TB. 3 PB ÷ 365 = 8.2 TB/day; ÷ 3.9 = 2.1 TB/day ÷ 50 MB = 42,000
min; 8.2 TB ÷ 50 MB = 164,000 min; 8.2 × 3.9 × 365 ≈ 11.7 PB.

---

## X1–X3 review — 2026-11-10 (Claude)

Read all three diffs against this brief. On each branch, lint, typecheck and
the unit suite pass (1,645 / 1,651 / 1,647 tests). E2E: 252 of 252 pass on each branch, against the production build.

### X3 `momentum-curriculum-streak` — approved, merge first

Matches the contract. The emit happens only after the repository write
resolves, never on rollback. The snapshot field, both `activityDates` and
`activityCounts`, the refresh cases, the unit tests and the E2E are all as
specified. Keeping `curriculumProgress: []` in `achievementEngine` is right:
reading must not move achievement inputs (see X3's out-of-scope note). It
touches no file that X1 or X2 touch.

### X2 `curriculum-opener` — approved, merge second

Matches X2.1–X2.3. Its `calloutMarker` follows X1.2 exactly (a missing or
unknown EXERCISE level returns `null`; a level on a non-EXERCISE kind returns
`null`). The gate has negative tests for misplaced, duplicated and reversed
openers and for malformed GOALS lists.

### X1 `curriculum-exercises` — changes requested, rebase onto main after X2

1. **Bug: Hint and Solution render only their first block.**
   `LessonReader.tsx` renders `stripLabel(blocks[hintAt])` and
   `stripLabel(blocks[solutionAt])`, a single element each. X1.1 says the
   hint runs up to the Solution paragraph and the solution runs to the end of
   the blockquote. Any solution with a second paragraph, a list, a table or a
   fenced block silently loses everything after its first paragraph. The seed
   only has one-paragraph solutions, so no test catches it, but X4's Apply
   solutions ("show every intermediate value") will routinely span several
   blocks. Fix: hint = `blocks.slice(hintAt, solutionAt >= 0 ? solutionAt :
blocks.length)`, solution = `blocks.slice(solutionAt)`, stripping the label
   from the first block of each. Add a unit or E2E case where a solution has
   two paragraphs and a list, and assert the last item is visible once the
   solution is opened.

2. **Bug: the "Exercise N" counter is a side effect in render.**
   `let exerciseNumber = 0` lives in the `curriculumComponents` closure and the
   `blockquote` override does `exerciseNumber += 1`. react-markdown 9 renders
   overrides as React components (`hast-util-to-jsx-runtime` →
   `jsx(type, props)`), and component renders must be pure. In `next dev`,
   Strict Mode renders twice, so the cards read "Exercise 2/4/6". In
   production, any re-render or retry of the same element tree can drift the
   same way. E2E runs against a production build and doesn't assert the
   number, so it can't see this. Fix: derive the number from the node, e.g.
   pass the exercise blockquotes' start lines (from the
   `## Exercises\n\n${exercises}` source) into the components factory, and
   use `index of node.position.start.line + 1`. Add an assertion that the
   three cards read "Exercise 1", "Exercise 2" and "Exercise 3".

3. **Contract drift: `calloutMarker` returns `{ level: null }` for an unknown
   level** instead of `null` (X1.2), so a typo such as `[!EXERCISE aply]`
   renders as an exercise card labelled "Unknown" rather than a plain
   quotation. Take X2's `calloutMarker` when resolving the conflict, and drop
   the `"Unknown"` branch and the `| null` from the return type.

4. **Gate has no negative tests.** X2 tests its gate against bad input; X1
   doesn't. Since these gates are the review for 338 generated chapters, add
   fixtures that must fail: levels out of order, only two exercises, an
   EXERCISE outside `## Exercises`, a missing Solution, `## Exercises` not
   last, and stray prose inside the section.

**Conflicts.** X1 and X2 both edit `callout.ts`, `visualContent.test.tsx` and
`CurriculumQuote.tsx`; a trial merge conflicts on the first two. Resolve on X1
after rebasing onto `main` with X2 merged:

- `callout.ts`: keep X2's version.
- `CurriculumQuote.tsx`: drop X1's plain-quote fallback for WHY/GOALS. Keep
  it for EXERCISE only, which is the outside-the-section case.
- `visualContent.test.tsx`: keep both sets of checks, define
  `EXERCISE_TRACKS` once, and union the error-key lists.

**Housekeeping.** Three `git stash` entries from this build remain
(`stash@{0..2}`, "preserve concurrent X1/X3 work"), along with a worktree at
`/private/tmp/myhub-curriculum-exercises`. The shared checkout was left on
`curriculum-opener`; it's back on `main`. Once X1 merges, check the stashes
hold nothing unmerged, then drop them and remove the worktree.

**Status:** X3 and X2 approved; X1 needs fixes 1–4 and the conflict
resolution. X4 batches can start once X1 merges.

### X1 re-review — 2026-11-11 (Claude): approved, merged

All four fixes landed and the rebase kept X2's `calloutMarker` unchanged.
Hint and Solution now take every block up to the next label or the end of
the quote, and the seed's Apply solution exercises that with two paragraphs
and a list. Exercise numbers come from each blockquote's source line, not a
render-time counter. The gate rejects every malformed case listed in fix 4.
Lint, typecheck, 1,661 unit tests and 254 E2E tests pass.

Two non-blocking notes for whoever touches this next:

- `exerciseBlockquoteStartLines` only matches a `>` in column 0, so an
  indented exercise would read "Exercise 0". The gate's format makes this
  unreachable today; tighten the gate or the matcher if that changes.
- The negative gate tests assert that some exercise error is raised, not
  which one.

The leftover worktrees, the duplicate review branch and the X1/X3 stashes
were removed after the merge. X4 batches can start.

### E0 review — 2026-11-11 (Claude): changes requested

Branch `curriculum-e0` (0be6361, 3609697). 17 chapters gained an opener and
three exercises; `systems-design.estimation` already had them, so all 18
Systems Design chapters are covered. No chapter prose changed, which matches
E0's "opener + exercises only" row. `EXERCISE_TRACKS` now includes
`"systems-design"` and `curriculum-tracks.spec.ts` asserts the opener and
three cards on every Systems Design chapter. Lint, typecheck and 1,661 unit
tests pass. E2E: 254/254 against the production build.

I re-derived every Apply calculation and checked each Stretch against its
chapter. 15 of 17 chapters are correct; every GOALS bullet is taught in its
chapter body. Fix these three before merge:

1. **`systems-design.case-collab`, Apply: the arithmetic contradicts the
   prompt.** The prompt says 240 editors, "each producing 40 document
   updates per second", but the solution computes 40 × 239 = 9,560, which
   treats 40 as the document's total rate. With 40 per editor the answer is
   240 × 40 × 239 = 2,294,400 deliveries/s. 40 per editor also contradicts
   the chapter's own figure ("~10 edits/second per active editor"). Change
   the prompt to 10 updates/s per editor, and the solution to: 240 × 10 =
   2,400 updates/s, × 239 peers = **573,600 deliveries/s**. That number is
   the reason the chapter batches and coalesces updates; say so in one
   sentence.

2. **`systems-design.tradeoffs`, Apply: the creator is below the chapter's
   own threshold.** The chapter's worked threshold is 10,000 followers
   (its KEY and CHECK), but the exercise's creator has 7,500 and the
   solution moves them to read-time assembly anyway. Make the creator
   7.5 million followers: one post is then **7,500,000 writes**, about 26
   seconds of the whole ordinary fan-out (7,500,000 ÷ 288,000 ≈ 26), which
   is why it goes to fan-out on read above the 10,000 threshold. Replace
   "Depending on the write-capacity threshold" with the stated threshold;
   the GOALS bullet promises "from a stated threshold".

3. **`systems-design.case-search`, Apply: hedging at the deadline is too
   late.** "At 160 ms it can hedge the slow shard request to a replica"
   sends the hedge when the budget is already spent. A hedge goes out
   early, once the shard passes its usual latency (for example its p95,
   well before 160 ms); partial results are what you return AT 160 ms.
   Reword the solution to give each strategy its own trigger.

Non-blocking: the added prose is one line per paragraph, while chapter
bodies wrap at ~80 columns. It renders identically and can't trip the
hyphen-wrap gate, so leave it; just keep later batches consistent with
whichever style E0 merges with.

**Status:** E0 needs fixes 1–3 (content only, no code). E1 can start from
main once E0 merges.

### E0 re-review — 2026-11-11 (Claude): approved

Codex's 62a0bf9 applies fixes 1–3 correctly: collab is 240 × 10 = 2,400
updates/s × 239 = 573,600 deliveries/s; the trade-offs creator has 7.5M
followers (7,500,000 ÷ 288,000 ≈ 26 s of ordinary fan-out, above the
chapter's 10,000 threshold); search hedges early and returns partial results
at the deadline. One correction was the reviewer's own: fix 1 asked for
"the chapter batches and coalesces updates", which the chapter never
teaches. 5ac003a (Claude) replaces it with the chapter's actual remedy, a
cap on concurrent editors or a pub/sub-sharded relay. Lint, typecheck, 1,661
unit tests and 254/254 E2E pass. Lesson for later reviews: check a
requested sentence against the chapter, too.

### E1 review — 2026-11-11 (Claude): changes requested

Branch `curriculum-e1` (b482c61, f93a281), in Codex's own worktree and based
on main. All 22 DS1 chapters (fundamentals, rpc, time, replication) gained an
opener and three exercises; the batch table's "23" was a miscount (the
directories hold 22 files). No original prose changed. Lint, typecheck and 1,661 unit tests pass. E2E: 253 passed and 1 flaky (`systems-design.case-video`, not an E1 file; the tracks spec then passed 64/64 on a re-run). Codex's worktree can't build for E2E: it has no `.env.local`, so prerender fails with "supabaseUrl is required"; copy it in, or run E2E from the main checkout.

I re-derived every calculation: HLC send/receive ((103,0), (103,1)), the
vector merge ({A:3,B:1,C:6}), the length-prefix reassembly, 50 ppm drift
(4.32 s/day, 129.6 s/30 days), M/M/1 at ρ = 0.95 (20×, 80 ms), backoff
ceilings, failover stages (28 s of 30), topology links (10/5/4), lag
positions (176), ID storage (32 MB / 16 MB), the SLO budget (20,000), payload
size (3.2 MB) and the pool round trips. All correct, and every figure and
GOALS bullet I checked is taught in its chapter. Fix these before merge:

1. **E2E gate is a no-op for every E1 chapter.**
   `curriculum-tracks.spec.ts` checks
   `chapter.topic.startsWith(`${prefix}.`)`. For Systems Design the prefix is
   the track (`systems-design` → `systems-design.case-chat` matches), but the
   E1 prefixes are whole topic ids: `distributed.fundamentals` never starts
   with `distributed.fundamentals.`, so the opener and exercise-card
   assertions are skipped on all 22 chapters while the suite stays green.
   Match `chapter.topic === prefix || chapter.topic.startsWith(`${prefix}.`)`,
   and check that the test still fails if one E1 chapter's `## Exercises` is
   removed. (The unit gate is unaffected: it matches the file path,
   `distributed.fundamentals/…`, without the dot.)

2. **`distributed.replication/05-leaderless-and-quorums`: Apply duplicates
   Stretch, and the quorum maths is untested.** Both ask how a rarely read,
   deleted key's tombstone converges, and the Recall covers the same ground.
   The first GOALS bullet promises "Calculate read/write quorum overlap from
   R, W and N", which no exercise asks. Replace the Apply with one built on
   the chapter's own N = 5 example, for instance: N = 5 and writes must
   succeed with two replicas down; choose W, find the smallest R that
   guarantees overlap, and say whether W = 2, R = 3 overlaps. Solution:
   W ≤ 5 − 2 = **3**; R + 3 > 5 gives **R = 3** (6 > 5), which also lets reads
   survive two replicas down; W = 2, R = 3 gives 5, not > 5, so **no
   guaranteed overlap**. End with the chapter's caveat that overlap still
   isn't linearizability. Keep the Stretch as it is.

3. **`distributed.rpc/02-wire-protocols-and-framing`, Apply: the last
   sentence is false.** "TCP read boundaries do not align with either frame
   boundary": frame 2 ends exactly at the end of the fourth read (and frame
   1 starts at the start of the first). Say instead that each length prefix
   is split across two reads and frame 1's payload is split across reads 2
   and 3, so the parser can't treat any single read as a message.

**Status:** E1 needs fixes 1–3. E2 can start from main once E1 merges.

### E1 re-review — 2026-11-11 (Claude): approved

dc13dae, 261133b and 1b4d39e apply fixes 1–3. The tracks spec now matches a
topic id exactly or as a prefix, so the opener and exercise-card assertions
run on all 22 E1 chapters. The quorum chapter's Apply is the N = 5 problem
(W = 3, R = 3, and W = 2/R = 3 gives no guaranteed overlap); Codex also
rewrote its Recall around N, R, W and sloppy quorums, all taught in the
chapter, so the three exercises no longer repeat the tombstone question.
The framing solution now describes the read splits correctly. Lint,
typecheck, 1,661 unit tests and 254/254 E2E pass, run in Codex's worktree
now that it has `.env.local`.
