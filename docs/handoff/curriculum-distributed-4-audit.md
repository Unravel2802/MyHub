# DS4 chapter audit — 2026-11-12

Branch: `curriculum-distributed-4`. Base: fetched `origin/main`,
`d0bf7953c5861c85f0c453c577876e134cea33d7`.

Counted from the chapter files: **18 chapters** (5 batch-stream, 5 membership,
4 CRDT, 4 scheduling). Messaging/01–06 on `curriculum-distributed-3` supplied
the reference structure; the additional acceptance checklist supplied the
stricter semantic checks below.

Each row maps GOALS 1, 2 and 3 to Recall, Apply and Stretch respectively.
All rows were checked for a concrete situation and consequence on the WHY
marker line, distinct exercise tasks, prompt/solution agreement, and support
within that chapter. Scenario inputs are explicit in the Apply prompts;
solutions use the chapter's own rules rather than external facts.

| Chapter         | Recall / goal 1                                  | Apply / goal 2: independently checked result                                     | Stretch / goal 3: recommendation versus weaker alternative                                |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| batch-stream/01 | Whole-DAG optimisation and pipelining            | Filter before join; filter narrow, redistribution wide                           | Checkpoint expensive wide boundaries versus lineage-only recovery                         |
| batch-stream/02 | Shuffle network/disk work                        | 12 × 5 = 60 fetches; filtering changes volume, not pair count                    | Salt associative sums versus speculative copies; reject partial-scalar median combination |
| batch-stream/03 | Durable and bounded unending state               | Event time and temporal join preserve historical attribution                     | Five-minute batch versus unnecessary streaming cluster                                    |
| batch-stream/04 | Windows define what, triggers when               | 12/3 = 4 windows; 11:20 − 4 min = 11:16; minimum = 11:14                         | Early/late upserts and repair versus appending accumulating revisions                     |
| batch-stream/05 | Fold/unfold and bounded input                    | 425 − 401 + 1 = 25 replayed events; choose keyed upsert                          | Batch correction for expired history versus impossible retained-log replay                |
| membership/01   | Phi adapts to the observed distribution          | −log10(0.0001) = 4; stop routing, defer failover at 8                            | Caps, probing and refutation versus immediate mass eviction                               |
| membership/02   | Push early, pull late                            | Six doubling rounds × 0.5 s = 3 s, an estimate                                   | Gossip configuration, consensus lock versus gossip uniqueness                             |
| membership/03   | Evidence versus committed numbered views         | Seven-voter quorum 4; eight-voter quorum 5                                       | Catch up as learner versus immediate voter promotion                                      |
| membership/04   | Expected-size or unique-initiator bootstrap      | Unready → propagation → drain → leadership → replication → removal → termination | New identity for empty disk versus hostname-based reuse                                   |
| membership/05   | Local gossip and small authoritative group       | 200 × 199 = 39,800 messages; 200 × 2 KB = 0.4 MB                                 | Guarded movement triggers versus rebalance on every suspicion                             |
| crdt/01         | Agreement versus preserving user intent          | Index 4 + inserted length 4 = 8; `red lamp!`                                     | CRDT peer/offline support versus conventional server-ordered OT                           |
| crdt/02         | TP1, TP2 and server linearisation                | Delete index 2 + 1 = 3; `dXoor` becomes `dXor`                                   | Keep working OT under stated constraints versus automatic migration                       |
| crdt/03         | Delta-state and monotonic removal information    | Per-entry maxima {A:4,B:6}; sum 10; duplicate merge still 10                     | Cart add-wins versus applying it to revocation-sensitive permissions                      |
| crdt/04         | Ephemeral awareness and relative cursors         | Snapshot through 800, then 875 − 800 = 75 tail updates                           | Validate before relay/persistence versus accepting then checking                          |
| scheduling/01   | Pack for cost, spread for failure isolation      | A fails anti-affinity; B fails memory; C fits                                    | Specialised shared-state policies versus universal exhaustive scoring                     |
| scheduling/02   | Allocation promises versus isolation enforcement | A max(0.20,0.30)=0.30; B max(0.40,0.10)=0.40; A next                             | Gang reservation and bounded backfill versus partial allocation/starvation                |
| scheduling/03   | Pod/machine feedback loops and dampers           | About 6 min lost; 120 − 90 = 30 s shutdown margin                                | Leading signal and warm baseline versus zero baseline/lagging latency                     |
| scheduling/04   | Mesos offers versus filter-score-bind            | 80 × 1.25 = 100; ×1.20 = 120; /0.60 = 200 CPUs                                   | Match volume-zone eligibility versus adding arbitrary nodes                               |

Every Stretch solution names a concrete weaker choice that differs from its
recommendation. Every Apply requires either arithmetic or a choice between
plausible actions; none asks only to repeat its supplied configuration.
CHECK questions remain separate from the final exercise tasks.

Visual totals: 18 Mermaid diagrams, no charts, no KEY conversions, 36 CHECK
blocks. Each topic has three PITFALL blocks and one INTERVIEW block. All
flowcharts use TB; the other diagrams use sequence or state notation.
Every fenced line is at most 76 characters. Source checks also cover both
trailing-hyphen and leading-hyphen prose wraps.

Original prose was compared against the base after stripping added blocks,
fences, whitespace and emphasis delimiters: all 18 chapters preserve it.
The existing `near` / `-optimal` wrap was joined. One existing Python
conditional expression was parenthesised across lines to meet the fence
width limit without changing its behaviour. Prettier also normalised
existing emphasis and table formatting.

The gate changes extend both EXERCISE_TRACKS lists, the track spec's topics
and count (44 + 18 = 62 distributed chapters on this base), and add the DS4
quota test alongside the existing content gates. The DS3 additions are
intentionally left to its independent branch.

Validation: `npm run lint`, `npm run typecheck`, `npm test` (94 files,
1,662 tests), and the full `npm run test:ui` suite (272 tests) passed.
The UI suite used a temporary config on port 3104 with a production build
from this worktree, keeping the DS3 server independent. Its track gate opened
every DS4 chapter at 1440px and 390px, checked that all diagrams rendered,
rejected desktop scroll hints, and checked page overflow and opener/exercise
coverage. `git diff --check` also passed.
