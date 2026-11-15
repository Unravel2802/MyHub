# Curriculum prose audit

## Batch B

Locations refer to the base revision (`c37abed`).

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
