# Roadmap module — plan

A page that answers two questions the app currently can't:

1. **Where am I?** — against the 11-month plan (`engineering_first_roadmap_v2.md` §6.5, Jul 2026 →
   May 2027).
2. **How deep am I?** — against the readiness matrix (§6.1), the thing that actually decides whether
   you land the offer.

Locked decisions: **timeline + skill tree, both**; progress is **hybrid** — derived automatically
wherever the data already exists, ticked by hand where nothing can infer it.

---

## The one thing that makes this cheap

**MyHub already tracks most of this.** The roadmap page is largely a *view* over existing selectors,
not new tracking:

| Roadmap criterion | Already computed by |
|---|---|
| "20 algorithm problems" | `prepScorecard.cumulativeCountsByType` |
| "2 system-design cases" | same |
| "one mock interview per week" | `dashboardSelectors.weeklyCadence` |
| "8 behavioral stories, both versions" | `achievementEngine` (already counts *complete* stories) |
| "40–60 target companies" | `companies` count |
| "applications live and active" | `funnelStats` |
| Dec / Feb technical targets | `prepTargets.progressTowardCheckpoint` |

So the new domain logic is mostly *composition*, not computation.

---

## Structure

### Catalog in code, progress in the database

Exactly the shape `achievements` already uses, and for the same reason: the roadmap's **content** is
static (it lives in a markdown file and changes when the roadmap changes, i.e. via a commit), while
your **progress** is data.

- `roadmapCatalog.ts` — the 11 months and the 7 readiness areas, transcribed from the roadmap.
  Every criterion carries a `source` citation, same discipline as `achievementCatalog`: **if a
  number can't be pointed at a line in the roadmap, it doesn't belong.**
- `roadmap_progress` table (migration `0014`) — one row per manually-ticked item, plus the
  self-assessed readiness levels.

### Two kinds of criterion

```ts
type Criterion =
  | { kind: "auto"; key: string; label: string; source: string;
      // Derived. Never ticked by hand — the number IS the truth.
      metric: (snapshot: RoadmapSnapshot) => { actual: number; target: number } }
  | { kind: "manual"; key: string; label: string; source: string };
```

`{ kind: "auto" }` covers "20 algorithms" (12/20, from prep entries). `{ kind: "manual" }` covers
"write the flagship design doc" — **nothing can infer that you wrote a document**, and pretending
otherwise would produce a roadmap that lies to you.

A month's status is then derived, not stored:

```
done        every criterion met
in_progress the month has started AND any criterion met
upcoming    the month hasn't started
missed      the month has passed AND criteria remain unmet   ← honest, not hidden
```

`missed` matters. A roadmap that silently rolls incomplete months forward is a roadmap that lets you
drift for a semester without noticing — which is precisely the failure §16 ("What to Avoid") is about.

### The 11 months (§6.5)

| Month | Theme | Gate |
|---|---|---|
| Jul 2026 | Setup and positioning | Two resumes, target list, diagnostic baselines, design doc |
| Aug 2026 | Backend refresh, retrieval v0 | Locally runnable BM25 retrieval service, tested, documented |
| Sep 2026 | Dense + hybrid search; **applications begin** | Hybrid retrieval end-to-end; funnel open and active |
| Oct 2026 | Multi-hop, refusal, evaluation harness | Demonstrates ML judgment, not API plumbing |
| Nov 2026 | Deployment, load testing, RL sidecar begins | Deployable, observable, load-tested; failure modes known |
| Dec 2026 | **Flagship v1.0 + semester review** | The 75–100 algo / 6 SD / 2 ML / 14 mock checkpoint |
| Jan 2027 | RL sidecar; full interview loops | Trained policy beating a baseline |
| Feb 2027 | Interview volume and polish | Both projects complete; performance consistent |
| Mar 2027 | External evidence | At least one PR / post / talk beyond your own repos |
| Apr 2027 | Packaging, negotiation, decisions | — |
| May 2027 | Graduate and transition | — |

### The 7 readiness areas (§6.1)

Algorithms · Backend · Distributed systems · ML systems · System design · Portfolio · Recruiting.

Each has a **Minimum** and a **Strong** bar, verbatim from the matrix. Target is *Strong across the
board*. Level is `not_started | minimum | strong`.

**Mostly self-assessed, and that's correct** — "Lead 45-min designs with capacity and failure
analysis" is a judgment, not a count. But two areas can be *evidenced* rather than merely claimed:

- **Algorithms** — the matrix's Strong bar is "most mediums in 20–30 min", and `prepScorecard`
  already computes `averageTimeToSolveMin` and `solveRate`. Show that number next to the
  self-assessment. If you've claimed Strong while averaging 38 minutes, the page should say so
  rather than let the claim stand.
- **Recruiting** — "tracked funnel, active mock loops" is literally what `funnelStats` and the
  weekly cadence measure.

That tension — *claimed* level vs *measured* evidence — is the most useful thing this page can
surface, and it's the reason the skill tree earns its place next to the timeline.

---

## ✅ Decided: the roadmap owns the truth

The Dashboard already tracked monthly gates via a `Gate: <Month> <Year>` task convention (parent
task + subtasks), with its own selector, panel, and `seed:gates` script. That was a second, parallel
system for the same information — and two sources of truth is how they drift. You'd tick the gate on
the Kanban, the Roadmap page wouldn't know, and one of them would quietly become a lie.

**The roadmap catalog is now the single source of truth for gates.**

- The Dashboard's gate panel reads from the roadmap module instead of from tasks.
- `seed:gates` is retired.
- The roadmap can auto-fill criteria a task subtask never could ("20 algorithms — 12/20").

Tasks stay what they're good at: today's work. The roadmap owns what the *month* means.

---

## Visualization — the point of the page

Two constraints shape all of it: **no new dependencies** (the approved list has no chart or
animation library) and **both themes**. Everything below is plain SVG plus the tokens and keyframes
already shipped in `globals.css`.

### The timeline is the lead: a metro line, not a progress bar

Eleven months is too few for a sprawling flowchart and too many for a row of cards. What fits is a
**transit line** — one track from July 2026 to graduation, a station per month.

```
Jul ●━━━━━● Aug ━━━━━● Sep ━━━━━◉ Oct ─ ─ ─ ○ Nov ─ ─ ─ ○ Dec ...
    done    done      done    ┃ YOU ARE HERE   upcoming
                              ┗━ pulse-glow, accent
```

The details are what make it feel alive:

- **The track fills as you progress.** Solid accent behind you, dashed muted ahead, and the segment
  you're *inside* fills proportionally to that month's completion. The line literally advances as you
  tick things off.
- **"You are here" reuses `pulse-glow`** — the same keyframe as the streak flame. Same signal: this
  is live, this is now.
- **A missed month keeps a red ring, permanently.** Not softened to grey, not rolled forward. This is
  deliberate and it is the feature: a roadmap that hides an incomplete month lets you drift a whole
  semester without noticing, which is exactly what §16 warns against. It should be uncomfortable to
  look at when you're behind.
- **Click a station** → it expands into its criteria. Auto ones as filled bars
  (`20 algorithms ▓▓▓▓▓▓░░░░ 12/20`), manual ones as checkboxes. Tick the last one and the station
  snaps to filled.

### The radar chart, second panel

§6.1's target is literally **"strong across the board"** — so make "across the board" a *shape*.
~60 lines of SVG, no library.

```
              Algorithms
   Recruiting     ╱╲      Backend
            ╱  ·······  ╲
           ╱ ·    ▲    · ╲
 Portfolio ·     ╱ ╲     · Distributed
           ╲ ·  ·····  · ╱
   System   ╲___________╱  ML systems
   design

  ▬▬ target (Strong, all 7)   ▓▓ claimed   ┈┈ measured
```

Three layers. The outer heptagon is the goal. Your **claimed** levels fill a solid polygon. And the
one that earns its keep: a **dashed polygon of measured evidence** drawn from real data.

Claim Strong on Algorithms while averaging 38 minutes against a 20–30 target, and the dashed line
pulls visibly inward from your claim. Same for Recruiting, drawn from your actual funnel. It's a
picture of self-image versus reality — uncomfortable in the way that's useful.

### Supporting elements

- **Countdown hero** — "May 2027 · 289 days". The one number that never stops mattering, and it makes
  the page feel like it's moving even on a day you do nothing.
- **Gate completion reuses the achievement toaster.** Already built, already announces to screen
  readers. Clearing a gate should *feel* like the milestone it is.
- **Density strip** under the timeline — a tick per active day, so the streak has somewhere to live
  visually and you can see the shape of the year.

### Interaction

Click **or arrow-key** along the stations — keyboard-navigable, no exceptions; we already have a focus
ring and an a11y suite and I'm not shipping a viz that needs a mouse. Hover a radar vertex for the
verbatim Minimum/Strong text. Ticks persist optimistically with rollback, like everything else.

All motion behind `motion-reduce`, which `globals.css` already enforces globally.

---

## Work split

Standing rule: Claude owns schema, contracts and correctness-critical logic; Codex owns UI.

### Claude

**R1 — migration `0014_roadmap_progress.sql`**
`roadmap_progress` (id, `item_key` text, `status`, `completed_at`, soft-delete + audit columns) +
partial unique index on `(item_key) where deleted_at is null` — the same idempotency backstop as
`achievements`. Plus `readiness` rows for the 7 areas (or a `kind` column discriminating the two).

**R2 — `roadmapCatalog.ts`** (pure data)
11 months × their criteria, 7 readiness areas × Minimum/Strong bars. Every entry cites its roadmap
section. Transcribed, not invented.

**R3 — `roadmapProgress.ts`** (pure, tested — the correctness-critical part)
- `evaluateMonth(month, snapshot, ticks) → { status, criteria: CriterionState[] }`
- `currentMonth(today)` — which node is "you are here"
- `readinessEvidence(area, snapshot)` — the *measured* number to show beside a claimed level
- **Date discipline: `format()`, never `.slice(0,10)`.** This bug class has recurred repeatedly in
  this codebase (streaks, archive, board stats). Month boundaries are local wall-clock.
- Boundary tests: a month with zero criteria met before it starts (`upcoming`, not `missed`); a past
  month with unmet criteria (`missed`, not silently `in_progress`); `done` at exactly N, not N−1.

**R4 — `RoadmapRepository.ts` + `useRoadmapStore.ts`**
Reads other modules through their **repositories** (rule 1), same as `useMomentumStore`.

### Codex

**R5 — Timeline view.** Horizontal month spine with status dots, "you are here" marker, expandable month
cards showing criteria. Auto criteria render as `12/20` with a `ProgressBar`; manual ones as
checkboxes. Reuse `StatCard`, `Panel`, `ProgressBar`, `Badge` — all built.

**R6 — Readiness matrix.** 7 areas, Minimum→Strong, self-assessed level + the measured evidence
beside it where we have it.

**R7 — Nav entry + `app/roadmap/page.tsx`**, and E2E: tick a manual item → persists; an auto criterion
reflects real prep data; a past month with unmet criteria shows `missed`.

**Rules that keep biting** (all three have been made and fixed in this codebase already):
- Never tint a card showing a zero or an em-dash — it highlights *absence*.
- No raw zinc/indigo in components; semantic tokens only, or it's invisible in light mode.
- Don't hide data behind a disclosure.

---

## What this is NOT

Not a generic roadmap builder, and not editable in-app. The roadmap is a **document you committed
to** — if it changes, that's a considered decision and it changes in the markdown file and the
catalog, together, in a commit. An in-app editor would let you quietly move the goalposts on a bad
week, which defeats the entire point of having written the roadmap down.
