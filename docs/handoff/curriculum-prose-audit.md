# Curriculum prose audit

X5, 2026-11-15: a correctness audit of the original prose in all 338
chapters, run by Codex in three batches after a "2× = 50% capacity" error
was found that had survived every exercise-focused review. Each line gives
the location, what was wrong, what it says now and a one-line derivation.
"Unsure, not changed" lists claims that are debatable or depend on context,
left as written on purpose. Line numbers refer to the pre-audit revision.

## Batch A

### Review follow-up

- systems-design.case-video/01-video-streaming.md:38 — Replaced the stale egress-cost comparison with ~$16.2M/month at the case-storage rate (202,500,000 GB × $0.08/GB), with CDN delivery cheaper per GB.
- systems-design.case-storage/01-object-storage-and-cdn.md:177 — Clarified that the ~$120,000/month origin estimate has an additional, unpriced CDN delivery bill.

### distributed

- distributed.failure/01-how-systems-actually-fail.md:101 — N+1 failover used N/(N−1) → (N+1)/N, with 60% before the failure (the N survivors share the same total load from N+1 servers).
- distributed.failure/01-how-systems-actually-fail.md:118 — Three-replica independent availability was 99.9999997% → 99.9999999% (1 − 0.001³ = 0.999999999).
- distributed.coordination/02-locks-and-leases.md:161 — Lease expired at 40s and the job retried before stopping → expiry at 50s and stop on the first failed renewal at 30s (last success 20s + TTL 30s; the rule requires an immediate stop).
- distributed.fundamentals/02-the-eight-fallacies.md:93 — An exact 400 ms for 201 round trips → about 400 ms (201 × 2 = 402 ms).
- distributed.fundamentals/04-latency-and-physics.md:211 — The total latency multiplier was labelled queue waiting time → distinguished total from waiting in the explanation and takeaway (subtracting one service time from 1/(1−ρ) leaves ρ/(1−ρ)).
- distributed.messaging/03-consumers-and-offsets.md:83 — Commit of offset 200 supposedly lost records through 200 → commit offset 201 (the returned batch ends at 200, so the next position auto-commits 200 + 1).
- distributed.messaging/06-operating-a-log.md:145 — Binary 2,048-byte message size labelled 2 KB → 2 KiB (2 × 1,024 B; total is still about 24 TB in decimal units).
- distributed.messaging/06-operating-a-log.md:151 — Three days was called half of seven → three and a half days, scoped to storage (7 ÷ 2 = 3.5 days).
- distributed.membership/01-failure-detection.md:112 — φ=1 was labelled a false-suspicion probability → 10% heartbeat-interval tail probability (10⁻¹ is the probability of waiting this long under the heartbeat model, not the posterior probability that the node is healthy).
- distributed.rpc/06-client-design.md:27 — 2–3 ms on 5 ms was given as a single 50% overhead → 40–60% (2/5 = 0.4 and 3/5 = 0.6).
- distributed.scheduling/02-fairness-and-multitenancy.md:30 — The equal-CPU allocation purportedly left CPU available → it fits CPU but exceeds RAM (50 + 50 = 100 CPUs; 200 + 1,000 = 1,200 GB > 1,000 GB).
- distributed.time/02-happens-before-and-lamport.md:146 — The trace listed sends after separate events at timestamps 2 and 4 → made each send itself the event at that timestamp (a distinct send would increment the counter again).
- distributed.time/04-hybrid-clocks-and-truetime.md:57 — The same wall clock was labelled 100 and 99 → 99 (the receive step uses B’s local wall reading of 99).
- distributed.replication/05-leaderless-and-quorums.md:130 — Diagram assigned three responses to two replicas in each quorum → two of three responses on each pair’s edge (the third in each set is the shared replica 3).
- distributed.fundamentals/06-tail-latency.md:55 — Tail probabilities multiplied request success rates without specifying independence → stated independence for the page, session and fan-out examples, with a common p99 threshold in the page example (P(all fast) = 0.99ⁿ under independence).
- distributed.partitioning/03-consistent-hashing.md:296 — Modulo hashing was said to remap 80–99% for any change in N → used N/(N+1) for one added node (4/5 = 80%, 99/100 = 99%; doubling N only moves half).
- distributed.fundamentals/01-why-distribute.md:166 — Five serial services were given an exact 0.995 combined availability → marked the original rounded number as approximate (0.999⁵ = 0.995009990004999).
- distributed.partitioning/03-consistent-hashing.md:42 — Consistent hashing was said to remap exactly 1/(N+1) of keys → described that share as an average (random placements give unequal arcs, while the N+1 nodes have equal expected shares).
- distributed.partitioning/03-consistent-hashing.md:133 — The 3-by-8 virtual-node diagram had 16 nodes → displayed eight arcs for each of the three owners (the original counts were 6 + 5 + 5; the corrected total is 3 × 8 = 24).

#### Unsure, not changed

- distributed.batch-stream/04-windows-and-watermarks.md:204 — The example uses a 30-second measured p99 after a 45-second example → unchanged (the chapter can be read as using two separate latency distributions).
- distributed.partitioning/03-consistent-hashing.md:148 — Approximate worst-node overload of 1/√V → unchanged (the approximation gives the per-node spread scale, but the worst-node magnitude depends on the number of physical nodes and token placement).

### systems-design

- systems-design.estimation/01-back-of-envelope.md:78 — Binary powers were given as exact decimal storage units → marked decimal figures approximate and used exact binary units (2¹⁰ = 1,024, versus 10³ = 1,000).
- systems-design.estimation/01-back-of-envelope.md:119 — Feed read:write by item was 100:1 → 200:1 (2B feed loads × 20 posts per load ÷ 200M written posts).
- systems-design.estimation/01-back-of-envelope.md:147 — CDN-to-origin arrow equated 40 TB/day of media uploads with cache-miss traffic → labelled the path cache misses (20M × 2 MB is upload volume; a 95% hit rate does not send all delivered media to the origin).
- systems-design.case-metrics/01-metrics-and-timeseries.md:142 — All rollups were described as 30× smaller → 30×, 12× and 24× fewer samples over equal spans (300/10, 3600/300, 86400/3600).
- systems-design.case-video/01-video-streaming.md:36 — Monthly video egress was 6.75 EB → about 202.5 PB (5M viewer-hours/day × 3,600 s/hour × 3 Mbps ÷ 8 × 30 days = 202.5 PB).
- systems-design.case-storage/01-object-storage-and-cdn.md:34 — Direct egress was $80M/month and the chart compared it with an unpriced CDN bill → $2.4M/month direct and roughly $120,000/month in origin charges with CDN hits (1 PB/day × 30 × 10⁶ GB/PB × $0.08; 5% origin traffic at the same rate).

#### Unsure, not changed

- systems-design.case-search/01-search-and-autocomplete.md:122 — Describes the shard p99 as typical for a 50-shard query → unchanged (under independence it is approximately the parent p60.5, and typical has no specified threshold).
- systems-design.estimation/01-back-of-envelope.md:224 — The CDN total of $10,000–20,000 per month has no tariff in the example → unchanged (95% byte hits would leave $4,800 in same-rate origin egress; edge rates are unspecified).

## Batch B

Original audit locations refer to the base revision (`c37abed`).

### Review follow-up

- foundations.data-structures/04-linked-structures.md:218 — Rewrapped takeaway 1 to the chapter’s prose width.

### backend

- backend.migrations/01-zero-downtime-migrations.md:91 — Inclusive endpoints admit 1,001 IDs and overlap adjacent batches → use a half-open interval (X through X+999 gives 1,000 possible IDs).
- backend.sql/01-relational-modeling-and-sql.md:188 — One JOIN was grouped with the two-query batched approach → the JOIN takes one round trip and batching takes two (one query versus an orders query plus a customers query).
- backend.time-money/01-time-dates-and-money.md:34 — The spring clock showed a nonexistent 2:59 and the same 2:30 job was described as ambiguous in fall → the Eastern example skips 2:xx in spring and repeats 1:xx in fall (converting the UTC instants on either side of the transition reproduces both jumps).

#### Unsure, not changed

- backend.sql/01-relational-modeling-and-sql.md:174 — Planner cost was compared with actual time → existing claim retained (whether the prose refers to estimated versus actual row counts or claims diagnostic frequency is unclear).

### craft

- craft.build-tooling/01-build-systems-and-dependencies.md:115 — Both dependency ranges omitted their floor → both start at 18.2.0 and admit stable versions below their respective ceiling (18.1.9 fails both; 18.3.0 passes only the caret range).
- craft.type-design/01-designing-with-types.md:108 — The validated list kept the caller’s mutable array → require a first element and copy the input (a sparse array can have positive length without index 0, and clearing the source array then leaves the copy intact).
- craft.version-control/01-git-and-version-control.md:28 — The opening DAG leaves the branch arrow under the main tip → show C3 as the fork used in the merge and rebase examples (C4 and C5 have the same parent).
- craft.version-control/01-git-and-version-control.md:47 — The merge and rebase reused C4 as the merge commit and discarded ancestry → merge adds M with both tips as parents and rebase keeps main at C4 (C5′ has parent C4 and C6′ has parent C5′).

#### Unsure, not changed

- craft.version-control/01-git-and-version-control.md:68 — Rebase guidance for shared commits is deliberately strict → existing claim retained (acceptable exceptions depend on the team's published branch policy).

### frontend

- frontend.html-css/01-html-and-css.md:90 — The cascade treated specificity as additive and !important as absolute → compare the selector counts in order only after earlier cascade criteria (one ID outranks eleven classes and user-important rules can outrank author-important rules).
- frontend.i18n/01-internationalization-and-localization.md:139 — Default JavaScript string ordering was described as code-point ordering → it compares UTF-16 code units (U+10000 starts with D800, so it sorts before U+E000).
- frontend.performance/01-web-performance.md:103 — A microtask boundary was said to permit paint → yield to a later task (the event loop drains pending microtasks before a rendering opportunity).
- frontend.react/01-react-and-component-models.md:95 — Closure capture was described as the mechanism that persists state → React stores state for the component while callbacks close over its render-specific value (a fresh render creates fresh closures but reads the same state slot).

#### Unsure, not changed

- frontend.i18n/01-internationalization-and-localization.md:178 — A 30–50% translation expansion rule was given → existing approximation retained (language, text length, and corpus determine the actual ratio).

### foundations

- foundations.algorithms/01-algorithms.md:26 — The comparison-sorting lower bound was written as an upper bound → worst-case Ω(n log n) (a binary decision tree with n! leaves has depth at least ceil(log₂(n!))).
- foundations.architecture/01-computer-architecture.md:37 — The adjacent latency gaps were all described as roughly one order of magnitude → the gaps vary (100 µs ÷ 100 ns = 1,000, while 4 ns ÷ 1 ns = 4).
- foundations.architecture/01-computer-architecture.md:158 — The 8-byte reordered struct listed different fields and required at least 10 bytes → reorder the same three fields (4 + 1 + 1 + 2 tail padding = 8 bytes).
- foundations.complexity/01-complexity-and-analysis.md:86 — The first push copied an element and later resizes copied more elements than the old capacity → start empty at capacity 1 and copy 1, 2, then 4 elements on pushes 2, 3, and 5 (copies equal the number of elements before insertion).
- foundations.complexity/01-complexity-and-analysis.md:110 — Additive growth was said to copy roughly the same amount per resize → copy counts grow each time (10, 20, 30, … occupy an arithmetic series with quadratic total cost).
- foundations.complexity/01-complexity-and-analysis.md:137 — A nested loop was alone treated as a quadratic lower bound written in O notation → specify a full scan for each element and count iterations directly (n scans × n iterations).
- foundations.data-structures/04-linked-structures.md:42 — A tail pointer or target node alone was said to make deletion O(1) → singly linked deletion needs the predecessor, with an O(n) worst-case search (a doubly linked tail supplies the predecessor directly).
- foundations.data-structures/05-graphs.md:270 — Topological sort was said to pinpoint a cycle → incomplete Kahn output detects a cycle (an unprocessed vertex can be downstream of a cycle without lying on it).
- foundations.data-structures/06-choosing-a-data-structure.md:84 — The heap’s delete cost omitted the search for an arbitrary item → O(log n) applies to the root or a known index (otherwise locating the item can take O(n)).
- foundations.databases/01-database-internals.md:35 — A B-tree range scan was given the cost of a point lookup → O(log n + k) for k matches (one descent finds the start and returning k entries costs at least k operations).
- foundations.information-theory/01-information-theory.md:167 — Cross-entropy was defined as excess bits → it measures total expected bits per observation (H(p,q) = H(p) + KL(p‖q), including H(p)).
- foundations.programming/02-values-references-and-memory.md:234 — The 257 literal assignments can share a compiled constant and compare identical → construct two values at runtime in CPython (separate int calls share the cache at 256 but allocate separately at 257).
- foundations.randomized/01-randomized-and-probabilistic-algorithms.md:88 — HyperLogLog’s typical percentage was presented as a bound → describe it as relative standard error (standard deviation divided by the true count describes dispersion, not a maximum).
- foundations.randomized/01-randomized-and-probabilistic-algorithms.md:125 — Quickselect was said to recurse into half and share the exactness trade-off → it recurses into the partition containing the target and returns the exact item (an extreme pivot can leave n−1 elements).
- foundations.strings/01-strings-and-text-algorithms.md:81 — Listing every prefix match was given the same cost as reaching the prefix node → charge for enumerating the subtree and emitting strings (returning r matches takes at least r output operations).

#### Unsure, not changed

- foundations.architecture/01-computer-architecture.md:209 — Matrix traversal was said to differ in wall-clock time by 5–10× → existing approximation retained (depends on matrix size, memory layout, and hardware).
- foundations.programming/01-what-a-program-is.md:99 — Interpreted loops were said to run 20–100× slower → existing approximation retained (the comparison depends on the implementations and workload).

### infra

- infra.linux/01-linux-and-the-shell.md:111 — The grep pipeline was described as counting HTTP 500 errors → it counts lines with the text 500 (a 200 response containing 500 elsewhere also matches).
- infra.networking-ops/01-practical-networking.md:108 — Hop-to-hop RTT changes and unanswered probes were treated as proof of location and path failure → treat both as clues (RTT includes the reply path, and filtered probes can time out even when traffic passes).

#### Unsure, not changed

- infra.networking-ops/01-practical-networking.md:210 — Certificate expiry was called the most common TLS incident → existing claim retained (frequency depends on which systems and incidents are measured).

### security

- security.supply-chain/01-supply-chain-security.md:110 — An artifact mismatch was treated as proof of tampering → it shows the outputs differ and warrants investigation (a different build environment can also change the artifact).

#### Unsure, not changed

- security.supply-chain/01-supply-chain-security.md:179 — Package-signature guarantee is summarized as identity and integrity → existing claim retained (the exercise states the trust assumption and actual verification depends on the configured authority).

## Batch C

### Review follow-up

- deep-learning.cnn/01-convolutional-networks.md:80 — Rewrapped the receptive-field paragraph to the chapter’s prose width.
- llm.reasoning/01-reasoning-and-test-time-compute.md:107 and deep-learning.rl/01-reinforcement-learning.md:185 — Restored the link between harder-to-game verifiable rewards and longer reasoning RL runs in both chapters and takeaways. Incomplete tests can still reward wrong answers.

### data (2 fixes, 3 unsure)

- data.analytics-eng/01-analytics-engineering.md:49 — SQL subtracts every joined refund and the comment says timely refunds are excluded → subtracts total in-window refunds once per order and documents the same policy (summing only amounts dated from the order through day 30 yields $230 in the Apply example, while summing all refunds yields $220)
- data.quality/01-data-quality-and-contracts.md:76 — one duplicate job run exemplifies a 100× row count → uses a 2× row count (one original and one duplicate give two copies)

#### Unsure, not changed

- data.formats/01-file-and-table-formats.md:52 — zero serialization for Arrow interchange → unchanged (depends on shared compatible memory and transport)
- data.ingestion/01-ingestion-and-change-data-capture.md:61 — CDC read path adds essentially no additional query load → unchanged (source and connector overhead depend on deployment)
- data.warehouse/01-warehouses-lakes-and-lakehouses.md:158 — compute spins up only for queries → unchanged (billing and runtime behavior vary by warehouse)

### engineering (0 fixes, 3 unsure)

No demonstrable fixes in this track.

#### Unsure, not changed

- engineering.career/01-scope-levels-and-growth.md:4 — scope and ambiguity as the primary promotion dimensions → unchanged (organizational policies differ and this is a heuristic)
- engineering.metrics/01-measuring-engineering.md:4 — the stated delivery metric taxonomy → unchanged (names and scope depend on report vintage)
- engineering.process/01-how-software-gets-built.md:27 — the historical characterization of waterfall and Agile → unchanged (accounts differ and the chapter gives no testable contract)

### ml-foundations (9 fixes, 3 unsure)

- ml-foundations.evaluation/01-model-evaluation.md:81 — 8% precision gives 92 false alarms per true positive → 11.5 false alarms per true positive (FP/TP = 0.92/0.08 = 92/8 = 11.5)
- ml-foundations.evaluation/01-model-evaluation.md:130 — doubling an error gives four times the RMSE → quadruples its squared contribution before the root (10²/5² = 4, but root-mean-square of one error is its absolute magnitude)
- ml-foundations.calculus/01-calculus-and-optimization.md:73 — convexity implies one minimum and successful gradient descent at any step size → any local minimum is global and convergence needs a suitable step size (constant functions are convex with multiple minima, and the gradient update for x² is x ← (1−2η)x, which diverges for η>1)
- ml-foundations.calculus/01-calculus-and-optimization.md:86 — Hessian alone classifies any point; flat directions preclude local minima → gives the second-derivative test at critical points and allows flat directions (x⁴ has a strict minimum with zero second derivative, and x² has a positive Hessian where the gradient is nonzero)
- ml-foundations.probability/01-probability-and-statistics.md:61 — 99% accuracy alone fixes the rare-event posterior → states sensitivity and specificity in the premise and qualifies the recap (the Bayes calculation uses P(+|D)=0.99 and P(+|¬D)=0.01, neither specified by overall accuracy alone)
- ml-foundations.probability/01-probability-and-statistics.md:110 — variance of a sum adds only under independence → zero covariance is sufficient, including the independent case (Var(X+Y)=Var(X)+Var(Y)+2Cov(X,Y))
- ml-foundations.probability/01-probability-and-statistics.md:95 — L2 regularisation strength described as the same as prior variance → strength tracks inverse prior variance (a zero-mean Gaussian adds w²/(2σ²) to the negative log posterior)
- ml-foundations.fairness/01-fairness-and-responsible-ml.md:79 — unequal base rates claimed to preclude equalized odds and predictive parity without qualification → specifies nonzero TPR and FPR (with shared TPR t and FPR f, precision tp/(tp+f(1−p)) varies with base rate p if t and f are positive; perfect classifiers are counterexamples to the original)
- ml-foundations.trees/01-trees-and-ensembles.md:92 — adding a tree fitted to the gradient of the loss → adds a tree fitted to the negative gradient (a positive step in the gradient raises loss to first order, whereas residuals under squared loss are proportional to the negative gradient)

#### Unsure, not changed

- ml-foundations.tuning/01-hyperparameter-optimization.md:35 — random search strictly better at equal budget → unchanged (the chapter illustrates its advantage in a sparse effective search space, but the empirical ranking across workloads lacks a specified objective/distribution)
- ml-foundations.calculus/01-calculus-and-optimization.md:77 — most high-dimensional critical points are saddles → unchanged (depends on the objective and what is sampled)
- ml-foundations.bandits/01-multi-armed-bandits.md:64 — Thompson sampling is usually the best empirical choice → unchanged (depends on benchmark, reward distribution and priors)

### deep-learning (5 fixes, 3 unsure)

- deep-learning.representation/01-embeddings-and-representation.md:78 — InfoNCE denominator excludes the positive example → positive and negative scores are normalized together (with all scores equal the positive probability must be 1/(1 + number of negatives))
- deep-learning.generative/01-generative-models.md:149 — noise-prediction loss asserted to decrease monotonically → regression objective can still fluctuate (stochastic steps can improve the current minibatch while increasing another minibatch loss or full objective)
- deep-learning.cnn/01-convolutional-networks.md:80 — 3×3 convolution sees 3 pixels, two see 5, with no stride assumptions → unit-stride undilated receptive fields are 3×3 and 5×5 (each ordinary unit-stride 3×3 layer adds 2 positions per spatial axis)
- deep-learning.rl/01-reinforcement-learning.md:84 — PPO clips the update and guarantees a single step cannot move a policy too far → clips the objective incentive without a hard bound on an update (the ratio is an input to clipping and is not itself constrained by that expression)
- deep-learning.rl/01-reinforcement-learning.md:178 — verifiable tests cannot be reward-hacked and a KL penalty bounds movement → tests can miss failures and a soft penalty discourages movement (a test suite covers its assertions only and a finite penalty can be outweighed by reward)

#### Unsure, not changed

- deep-learning.compression/01-pruning-distillation-nas.md:104 — a distilled model that meets the bar is 10× cheaper → unchanged (depends on the student, workload and achieved serving utilization)
- deep-learning.attention/01-attention-and-transformers.md:146 — FlashAttention does more arithmetic → unchanged (depends on implementation and whether forward or training recomputation is counted)
- deep-learning.regularization/01-regularization.md:96 — modern LLM training is approximately one epoch → unchanged (depends on corpus repetition and training mixture)

### llm (12 fixes, 4 unsure)

- llm.scaling-laws/01-scaling-laws.md:130 — each tenfold compute increase buys the same absolute reduction and a shrinking absolute reduction → same fraction of the reducible loss and shrinking absolute gains (if reducible loss is aC^−α, multiplying C by 10 multiplies loss by fixed 10^−α)
- llm.finetuning/01-finetuning-and-peft.md:71 — dense ΔW is described as containing only the low-rank parameter count → the learned factors are the small part (for square W, A and B store 2rd values while formed BA still has d² entries)
- llm.multimodal/01-multimodal-models.md:69 — 73 full 14-pixel patches described as covering a 1024-pixel side → 5,329 patches for complete patches only (73×14=1,022; keeping the unpadded remainder requires a different policy, and 73²=5,329)
- llm.reasoning/01-reasoning-and-test-time-compute.md:93 — programmatic verification said to remove the ceiling from reward hacking → removes reliance on a preference model while depending on check coverage (a program can accept an answer that meets its test cases and fails an untested case)
- llm.structured-output/01-structured-output.md:37 — grammar stated to guarantee parsing even though the chapter shows truncated valid prefixes → syntax guarantee is for completed outputs (a valid prefix such as an opening brace cannot be parsed as a complete object)
- llm.structured-output/01-structured-output.md:110 — a schema-valid date is assumed to be inherently a real date → calendar validity depends on the enforced constraint (a string that matches a YYYY-MM-DD pattern can still encode February 31)
- llm.structured-output/01-structured-output.md:238 — allowed citation IDs described as preventing fabricated citations outright → prevents unknown IDs but still permits incorrect attribution (a permitted ID can name a passage that does not support the claim)
- llm.tokenization/01-why-tokenization-exists.md:128 — Thai example implies exact 4× and generalizes it to all translations → Thai uses about 4× the tokens of the English example (45/12 = 3.75, compared with 18/12 = 1.5 and 30/12 = 2.5)
- llm.tokenization/02-embeddings-and-vocabulary.md:30 — one 128k × 4096 table is ~15% of 7B parameters → one table is ~7.5%, both untied tables ~15% (128,000×4,096=524,288,000 and 524,288,000/7,000,000,000≈0.0749)
- llm.tokenization/02-embeddings-and-vocabulary.md:197 — masking described as guaranteeing every output parses → guarantee applies to completed output (a prefix can satisfy the mask while still being incomplete)
- llm.memory/01-memory-and-context.md:33 — quadratic total cost asserted without a growth assumption → quadratic cumulative input tokens for uncompressed history with constant tokens added per turn (a fixed increment k yields k times the sum from 1 through n = k n(n+1)/2)
- llm.agents/01-agents-and-tool-use.md:44 — context grows monotonically even with compaction → uncompacted context grows monotonically (the memory chapter replaces raw history with a shorter summary)

#### Unsure, not changed

- llm.architecture/01-the-transformer-block.md:218 — 8 experts top-2 imply ~4× parameters and ~1.3× FLOPs → unchanged (no dense baseline, expert width or shared block cost is specified)
- llm.scaling-laws/01-scaling-laws.md:244 — models are deliberately over-trained by 50–100× → unchanged (training recipes and deployment objectives vary)
- llm.frontier/01-reading-the-frontier.md:197 — architecture stability and unresolved problems are time-sensitive → unchanged (requires a historical definition and dated evidence)
- llm.evaluation/01-llm-evaluation.md:190 — confidence interval width for n=50 → unchanged (roughly 14 percentage points is the worst-case normal approximation, but the actual interval depends on sampling and method)

### ml-systems (23 fixes, 6 unsure)

- ml-systems.cost/02-capacity-planning.md:184 — 50% capacity increase → 100% capacity increase (2C − C = C at fixed hardware).
- ml-systems.cost/02-capacity-planning.md:242 — 50% capacity increase → 100% capacity increase (2C − C = C at fixed hardware).
- ml-systems.evaluation-infra/02-online-testing.md:100 — 300,000 users per arm and 60 days → about 3 million and 600 days (two-sided two-proportion approximation: 2 × 0.05 × 0.95 × (1.96 + 0.84)² ÷ 0.0005² ≈ 2.98 million per arm).
- ml-systems.gpu/02-arithmetic-intensity.md:43 — Compute-bound arrow on rising roofline → compute-bound label beyond the ridge (min(peak, bandwidth × intensity) rises only below the ridge).
- ml-systems.gpu/02-arithmetic-intensity.md:186 — A few percent utilization → below 1% (14 GFLOP ÷ 0.007 s ÷ 312 TFLOP/s ≈ 0.64%, as in the inference chapter).
- ml-systems.vector-search/01-ann-algorithms.md:28 — 7.7 GFLOP → 7.7G multiply-adds or about 15.4 GFLOP (each multiply-add counts as two FLOPs in the curriculum’s convention).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:118 — 512 KB → 512 KiB (524,288 bytes ÷ 1,024 = 512).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:157 — Full output length multiplied by TPOT → output length minus one (TTFT already includes token one).
- ml-systems.inference-optimization/01-the-inference-bottleneck.md:142 — FP8 or INT8 makes KV 2–4× smaller → halves the BF16 payload (8 bits ÷ 16 bits = 0.5, before quantization metadata).
- ml-systems.inference-optimization/02-memory-and-attention.md:222 — 2–4× sequence capacity from 8-bit KV → half the BF16 payload (8 bits ÷ 16 bits; realized concurrency also depends on other memory).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:31 — Work divided by peak rate → model work rate divided by peak rate (MFU is dimensionless).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:50 — Single-GPU peak as denominator for a job → combined peak (with N equal GPUs, divide the job’s total FLOP/s by N × per-GPU peak).
- ml-systems.training-infra/01-keeping-the-accelerator-busy.md:288 — Optimizer alone takes 16P → model and optimizer state total 16P (2P weights + 2P gradients + 4P master weights + 8P moments).
- ml-systems.labeling/01-labeling-quality.md:4 — Annotator agreement as a model ceiling → a signal of label quality (agreement measures consistency between raters).
- ml-systems.labeling/01-labeling-quality.md:9 — Agreement sets a hard ceiling → agreement can expose label ambiguity (a model matching either deterministic rater can exceed their pairwise agreement against that rater).
- ml-systems.labeling/01-labeling-quality.md:25 — 75% agreement proves 25% ambiguity and caps accuracy at 75% → 25% disagreement warrants investigation (1 − 0.75 = 0.25; no bound against an individual rater follows).
- ml-systems.labeling/01-labeling-quality.md:33 — Achievable ceiling → label consistency (pairwise agreement alone cannot determine achievable accuracy).
- ml-systems.labeling/01-labeling-quality.md:41 — All-negative annotators agree 95% → 100% (both produce the identical label on every item).
- ml-systems.labeling/01-labeling-quality.md:279 — Ceiling in the recap → label consistency (agreement of two labels is not a mathematical bound on prediction accuracy).
- ml-systems.cost/01-where-the-money-goes.md:99 — Formula gave cost per request → multiply by 1,000 (dollars/hour ÷ requests/hour cancels to dollars/request).
- ml-systems.serving/03-scaling-and-operations.md:197 — Formula gave cost per prediction → multiply by 1,000 (the raw quotient is dollars per prediction).
- ml-systems.serving/02-batching-and-throughput.md:29 — A 32× throughput guarantee from shared weight reads → 32 predictions per read (throughput also depends on batch time, as the next table shows).
- ml-systems.serving/01-serving-architectures.md:178 — A service p99 is typical after several requests → the chance of a tail call can rise with fan-out (for five independent calls, 1 − 0.99⁵ ≈ 4.9%, below 50%).

#### Unsure, not changed

- ml-systems.cost/01-where-the-money-goes.md:182 — a 2% conversion lift on $100M of revenue is obviously worth $50k/month → unchanged (the revenue period, incremental margin and relationship between conversion and revenue are unspecified).
- ml-systems.edge/01-on-device-inference.md:225 — 90% of requests handled locally implies 90% lower serving cost → unchanged (the estimate depends on how much cost is variable and whether fallback requests cost the same).
- ml-systems.inference-optimization/03-model-compression-and-speculation.md:168 — speedup approximates acceptance rate times draft length → unchanged (the approximation depends on what acceptance rate counts, the bonus token, rejection position and draft/verification costs).
- ml-systems.monitoring/02-drift.md:102 — a 0.1% shift gives p < 0.001 → unchanged (the result depends on sample size, variance and test assumptions).
- ml-systems.distributed-training/04-communication-and-debugging.md:93 — selected transport silently halves inter-node bandwidth → unchanged (effective throughput depends on network configuration and baseline).
- ml-systems.vector-search/01-ann-algorithms.md:138 — probing two of 1,000 IVF lists scans 1/500 of the corpus → unchanged (this is a reasonable equal-list-size approximation and an individual query can see uneven lists).
