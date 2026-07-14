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

## ★ Open decision: the existing gate-task convention overlaps this

`dashboardSelectors` already has a `Gate: <Month> <Year>` **task** convention (a parent task with
subtasks), a `gateChecklistProgress` selector, a Dashboard panel, and a `npm run seed:gates` script.

That is a *second*, parallel system for tracking exactly these monthly gates. **Two sources of truth
for the same thing is how they drift.** Three options, and I'd want a call before building:

1. **Roadmap module supersedes it (recommended).** The roadmap catalog becomes the source of truth;
   the Dashboard's gate panel reads from the roadmap module instead of from tasks. Retire
   `seed:gates`. One system.
2. **Keep both, explicitly linked.** Roadmap items can *spawn* tasks ("add this to my board"), but the
   roadmap owns completion. Tasks become a scratchpad, not a record.
3. **Keep both, unlinked.** Simplest to build, worst to live with — they will disagree, and you won't
   know which to believe.

I'd take (1), with (2) as a follow-up if you find you want roadmap items on the Kanban.

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
