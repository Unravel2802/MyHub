-- Design Drills: add worked solutions + backfill the original 12 drills
-- See migration 0024 for the drill bank. This adds the `solution` column (the
-- full model answer, always viewable in the UI - a deliberate product choice,
-- LeetCode-style) and backfills a worked solution for each of the 12 seed
-- drills.
--
-- `default ''` keeps a future drill without a solution valid; the UI treats an
-- empty solution as "not written yet". Solutions are authored for plain-text
-- legibility (numbered sections, dash bullets) because the UI renders them with
-- whitespace-pre-wrap, exactly like prompts - there is no markdown renderer in
-- the app and none on the approved-deps list.
--
-- Backfill is plain UPDATE ... WHERE slug, so this migration is re-runnable.

alter table design_drills add column if not exists solution text not null default '';

update design_drills set solution = $sol$APPROACH
A URL shortener is a write-light, read-heavy key-value lookup (short code ->
long URL). The design is three decisions: how you mint codes, where you store
the mapping, and how you serve reads cheaply.

1) REQUIREMENTS
- Functional: shorten(longUrl) -> shortUrl; resolve(code) -> redirect; optional
  custom alias; optional expiry.
- Scale: 100M writes/day (~1.2K/s avg, plan ~10x peak); 10:1 reads -> ~12K/s
  avg. Years of retention -> tens of billions of rows.
- Codes must not be sequentially guessable; redirects must stay fast under the
  read skew.

2) API
- POST /urls {long_url, custom_alias?, ttl?} -> {short_url}
- GET /{code} -> 302 Location: long_url. Use 302, not 301: 301 is cached by
  browsers effectively forever, which kills analytics and makes expiry/retarget
  impossible.

3) KEY GENERATION (the crux)
- Base62 over [0-9a-zA-Z]: 7 chars = 62^7 ~= 3.5T codes, plenty.
- Encode a unique integer, but source it WITHOUT a single hot counter: a central
  allocator hands each app server a block of ids (e.g. 1,000 at a time), or use
  a Snowflake-style id. Encoding a raw monotonic counter makes codes sequential
  and enumerable, so either permute the counter with a keyed bijection or accept
  sequential ids and rate-limit enumeration at the edge.
- Hashing (e.g. first 7 chars of a hash of the URL) is the alternative but forces
  a collision check on every write and turns "same URL -> same code?" into a
  product decision.

4) DATA MODEL / STORAGE
- urls(code PK, long_url, created_at, expires_at, owner). Access is pure lookup
  by code, so a horizontally-sharded KV store (DynamoDB/Cassandra) fits; a single
  Postgres won't hold tens of billions of rows without sharding by code.
- Custom alias is a reserved row; use a conditional/if-not-exists insert so two
  users can't claim the same alias.

5) SERVING READS (10:1)
- Front the store with a Redis LRU cache. A small set of links gets most of the
  traffic, so the hit rate is very high and the DB sees mostly cache misses.
- Analytics MUST be async: emit a click event to a log/queue (Kafka) and
  aggregate offline. Never do a synchronous counter increment on the redirect
  hot path.

6) EXPIRY / DELETE
- Store expires_at; check lazily on read plus a background sweeper. Give cache
  entries a TTL so expiry evicts them automatically.

7) WHAT INTERVIEWERS PROBE
- 302 vs 301 (analytics + mutability); avoiding guessable codes; generating ids
  without a hot counter; why the cache hit rate is high; custom-alias uniqueness.$sol$
where slug = 'url-shortener';

update design_drills set solution = $sol$APPROACH
A rate limiter answers "has key K exceeded N actions per window?" in the request
hot path. The design is: the counting algorithm, where shared state lives, the
concurrency guarantee, and the failure policy.

1) REQUIREMENTS
- Per-user AND per-API limits; a clear rejection signal; correct across many
  instances of the calling service; defined behavior when the limiter's store is
  down.
- Budget: sub-millisecond decision, adds negligible latency to every call.

2) ALGORITHMS (name the trade-off)
- Fixed window counter: one counter per (key, window). Cheap, but allows a 2x
  burst across the window boundary.
- Sliding window log: store each timestamp; exact, but O(N) memory per key.
- Sliding window counter: weight the previous window's count by overlap. Near-
  exact, O(1) memory -- the usual default.
- Token bucket: tokens refill at a rate, each request spends one. Allows
  controlled bursts (bucket size) with a steady long-run rate. Best when you want
  to permit short bursts.

3) WHERE STATE LIVES
- NOT per-instance memory -- the requirement is correctness across many callers,
  so a shared low-latency store (Redis) holds the counters. Key = ratelimit:{api}:{user}.

4) CONCURRENCY (the crux)
- The naive GET-then-SET is a race: two concurrent requests both read 99, both
  write 100, both pass. Fix with an atomic op: INCR + EXPIRE, or a small Lua
  script that does check-and-increment atomically (token bucket needs the script
  to refill-then-spend in one round trip).

5) CONFIG
- Limits are data, not code: a config store maps (api, tier) -> {limit, window},
  hot-reloaded, so no deploy per limit change. Return 429 with Retry-After and
  X-RateLimit-Remaining/Reset headers.

6) FAILURE POLICY
- Decide fail-open vs fail-closed explicitly when Redis is unreachable. For most
  APIs, fail-open (allow) -- a limiter outage shouldn't take down the whole API;
  for abuse/security-critical limits, fail-closed. State the trade-off.
- Deploy Redis close to callers (or a local token-bucket approximation synced
  periodically) to keep the added latency tiny.

7) WHAT INTERVIEWERS PROBE
- The boundary-burst flaw of fixed windows; the read-modify-write race and its
  atomic fix; fail-open vs fail-closed and why; how limits are configured without
  a deploy; multi-instance correctness.$sol$
where slug = 'rate-limiter';

update design_drills set solution = $sol$APPROACH
A home timeline merges recent posts from accounts a user follows, fast. The
whole problem is WHEN you do the merge -- at write time (push) or read time
(pull) -- and how celebrity accounts break the simple answer.

1) REQUIREMENTS
- Feed of recent posts from followees; post/follow/unfollow; new posts visible
  within seconds; <200ms feed load.
- Scale: 300M DAU, ~200 followees avg, celebrities with 100M+ followers.

2) TWO MODELS
- Fan-out-on-write (push): on each post, append its id to every follower's
  precomputed feed cache. Reads are trivial (read your list). Writes amplify by
  follower count.
- Fan-out-on-read (pull): store posts per author; at read time, gather your
  followees' recent posts and merge. Writes are cheap, reads are expensive.

3) THE HYBRID (the crux)
- Push breaks for celebrities: one post = 100M cache writes. So: push for normal
  accounts, and DON'T push for accounts above a follower threshold. For those,
  pull their recent posts at read time and merge into the pushed feed. Almost all
  authors are cheap to push; the few huge ones are pulled. This is the answer.

4) DATA MODEL
- posts(post_id, author_id, created_at, body). feed_cache: per-user list of
  post_ids (Redis list/sorted-set), capped to a few hundred. follows(follower,
  followee) sharded by follower for "who do I follow", and by followee for "who
  follows this celebrity".

5) READ PATH
- Read the pushed feed_cache, pull recent posts from your celebrity followees,
  merge by time, hydrate post bodies from a cache. Rank here if needed.
- Pagination is CURSOR-based (created_at/post_id), never OFFSET -- new posts
  arriving would shift offsets and duplicate/skip items.

6) CONSISTENCY / EVICTION
- Deleted or edited posts: don't rewrite every feed; filter at hydration time
  (a deleted post id hydrates to nothing). Cap feed length; older entries fall
  off and are recomputed on demand.

7) WHAT INTERVIEWERS PROBE
- Push vs pull trade-off; the celebrity fan-out blowup and the hybrid fix; cursor
  vs offset pagination; how deletes/edits propagate without rewriting every
  follower's feed; where ranking hooks in.$sol$
where slug = 'news-feed';

update design_drills set solution = $sol$APPROACH
A job scheduler runs cron and one-off jobs at scale while surviving worker
crashes. The core is: assign work without double-running it, and define what
"exactly-once" really means (it usually isn't literal).

1) REQUIREMENTS
- Schedule at a time or on a cron expression; retry with backoff up to a cap; a
  job must not vanish if its worker crashes mid-run; millions of jobs.

2) DELIVERY SEMANTICS (say this first)
- True exactly-once execution is not achievable across crashes. The practical
  answer is at-least-once delivery + idempotency: each job carries an idempotency
  key so a re-run is a no-op, making a double-run harmless.

3) DATA MODEL
- jobs(id, run_at, cron, status[pending|running|done|failed], attempts, max_attempts,
  lease_owner, lease_expires_at, payload). Index on (status, run_at).

4) CLAIMING WORK (the crux)
- A dispatcher/worker claims due jobs with a lease, atomically, so two workers
  never take the same one. In SQL: SELECT ... FOR UPDATE SKIP LOCKED to grab a
  batch of due pending rows and flip them to running with a lease_expires_at. A
  bare queue does NOT prevent double-claim on redelivery -- the lease/lock does.

5) CRASH RECOVERY
- If a worker dies, its lease expires and a sweeper (or the next claim query)
  finds running jobs whose lease_expires_at < now and makes them claimable again.
  So a crashed job becomes re-runnable rather than stuck "running" forever -- and
  the idempotency key covers the case where it had already done work.

6) RETRIES + SCALE
- On failure: attempts++, if < max_attempts reschedule with exponential backoff
  (+ jitter); else move to a dead-letter state and alert.
- Shard the jobs table by id or time bucket; a partitioned "due soon" index keeps
  the claim query cheap at millions of rows. For time-based scheduling, don't
  assume synchronized clocks -- use a single time source or tolerate skew.

7) WHAT INTERVIEWERS PROBE
- Exactly-once vs at-least-once + idempotency; SKIP LOCKED / leasing to prevent
  double-claim; lease expiry for crash recovery; backoff + dead-letter; sharding
  and clock skew.$sol$
where slug = 'job-scheduler';

update design_drills set solution = $sol$APPROACH
Real-time collaborative editing means concurrent edits converge to the same
document for everyone, with no lost writes, even after a brief offline gap. The
central decision is the conflict-resolution model.

1) REQUIREMENTS
- Concurrent edits converge (no last-write-wins data loss); live cursors; full
  persistence + history; ~50 concurrent editors; <200ms propagation; offline
  edits merge back cleanly.

2) CONFLICT RESOLUTION (the crux)
- Operational Transformation (OT): edits are operations (insert@pos, delete@pos);
  a central server transforms an incoming op against ops it already applied so
  positions stay correct. Compact, but transform functions are notoriously hard
  to get right and generally need a central authority.
- CRDTs: characters get unique, ordered identifiers so merges are commutative and
  associative -- any order of the same ops yields the same doc, which tolerates
  offline/peer-to-peer merges naturally. Cost is per-character metadata (mitigated
  by block/RGA-style encodings).
- Pick one and justify: OT for a centralized server with tight docs; CRDT when
  offline resilience and merge-order-independence matter most. Plain last-write-
  wins is unacceptable (it drops concurrent edits).

3) TRANSPORT
- WebSocket per editor to a collaboration server; the server broadcasts applied
  ops/deltas to the other editors. On reconnect after a drop, the client resyncs
  from its last acknowledged version (send a version vector / seq, get the delta)
  -- not "replay everything from doc creation".

4) PRESENCE (separate path)
- Cursors/selections are ephemeral and high-frequency: broadcast them on a
  lower-durability channel that does NOT need to survive a crash the way document
  content does. Losing a cursor for a second is fine; losing a keystroke is not.

5) PERSISTENCE / SCALE
- Persist periodic snapshots + an op log (or the CRDT state), so opening a doc
  loads a snapshot and replays a short tail, not the whole history.
- Past one server: a single doc's editors must share one broadcast fan-out, so
  route all connections for a doc to the same server/partition (consistent
  hashing on doc_id) or use a shared pub/sub keyed by doc.

6) WHAT INTERVIEWERS PROBE
- OT vs CRDT and WHY; how reconnect resyncs without full replay; why presence is
  a separate data path; snapshot+log persistence; keeping one doc's editors on
  one fan-out across servers.$sol$
where slug = 'collab-editor';

update design_drills set solution = $sol$APPROACH
"Find things near me" is a spatial index over points plus a radius query. The
twist is that constantly-moving entities (drivers) and near-static ones
(restaurants) want different handling.

1) REQUIREMENTS
- Given (lat, lng, radius) return nearby entities by distance; moving entities
  current within seconds; static entities support extra filters (cuisine,
  rating). Scale: 5M moving updating every few seconds; 50M static; high QPS.

2) SPATIAL INDEX (the crux)
- Geohash: interleave lat/lng bits into a string; a prefix = a cell. Simple and
  range-scannable, but a query near a cell boundary must also check neighbor
  cells, and fixed precision handles density poorly.
- Quadtree: recursively split dense regions into 4; adapts to density but needs
  rebalancing as points move.
- S2 / H3 (Uber): cover the globe with near-uniform cells; a radius query maps to
  a set of covering cells, which is clean for "within 2km". Good default for
  moving fleets.
- A radius query = compute the covering cells for the circle, fetch candidates in
  those cells, then filter by exact distance. You never scan the whole space.

3) MOVING vs STATIC (the real point)
- Moving drivers: writes dominate (every few seconds). Keep them in an in-memory
  geospatial index (e.g. Redis GEO / an in-memory cell map) updated on each ping;
  staleness tolerance of a few seconds lets you avoid persisting every move.
- Static restaurants: read-dominated, rarely change. Persist them in a durable
  store with a geospatial index; extra attributes (cuisine, rating) live here.

4) FILTERING
- Cuisine/rating is a SECONDARY filter applied to the geospatial candidate set,
  not baked into the spatial cell -- get candidates by location, then filter/rank
  by attributes and distance.

5) SCALE
- Shard the index by region/cell. Hot cities get more shards. Driver location
  updates go to the in-memory tier and are snapshotted; a client subscribes to
  updates for the cells in view.

6) WHAT INTERVIEWERS PROBE
- Geohash boundary problem; how a radius maps to covering cells; why moving and
  static entities use different indexes/tiers; secondary attribute filtering;
  update cost vs staleness for moving entities.$sol$
where slug = 'proximity-search';

update design_drills set solution = $sol$APPROACH
A large recommender can't score the whole catalog per request. The pattern is
two-stage: cheaply retrieve a few hundred candidates, then rank them with a
heavier model. Everything else (cold-start, metrics, skew) hangs off that.

1) REQUIREMENTS & OBJECTIVE
- Ranked recs per user, refreshed as they interact; handle new users and new
  items. Optimize a real objective (e.g. long-term watch time), not just clicks.
- Scale: hundreds of millions of items, billions of requests/day, tens-of-ms p99.

2) TWO-STAGE ARCHITECTURE (the crux)
- Retrieval/candidate generation: narrow 100Ms -> ~hundreds. Two-tower model:
  a user tower and an item tower produce embeddings; item embeddings are indexed
  in an ANN structure (FAISS/ScaNN); at serve time embed the user and do an ANN
  nearest-neighbor lookup. (Complement with co-visitation / popularity sources.)
- Ranking: a heavier model scores the few hundred candidates with rich features
  and picks the top-k. A single model over the whole catalog per request can't
  meet the latency budget -- that's why retrieval exists.

3) FEATURES
- User: watch history, embeddings, demographics, session context (time, device).
- Item: metadata, age, historical engagement, embedding.
- Interaction/cross: past affinity between user and this item's channel/topic.

4) COLD START (both sides)
- New user: no history -> fall back to popularity / demographic priors / onboarding
  signals, personalize as interactions arrive.
- New item: no engagement -> lean on content-based features (metadata embedding)
  and explicit exploration until it accrues data.

5) TRAINING & EVALUATION
- Train on logged impressions + engagement labels. Beware training/serving skew:
  features computed differently offline vs online silently degrade quality --
  share one feature pipeline / feature store.
- Offline: AUC / NDCG / recall@k on held-out logs. Online: CTR, watch time,
  session length via A/B test. An offline win doesn't guarantee an online win;
  the A/B test is the arbiter.

6) FAILURE MODES / PROBES
- Feedback loops (recommending what you already show); popularity bias; the need
  for exploration; why two stages; ANN recall vs latency trade-off.$sol$
where slug = 'recommendation-system';

update design_drills set solution = $sol$APPROACH
Learning-to-rank orders a candidate set for a query using signals learned from
click/purchase logs. The design is: the ranking objective, features, how labels
come from logs, and correcting the biases in click data.

1) REQUIREMENTS & OBJECTIVE
- Given a query + ~1000 candidates, return an order optimizing relevance /
  purchase likelihood; learn from logs, not hand rules; evaluate rankers before
  full rollout.

2) MODELING APPROACH (name the family)
- Pointwise: predict a per-item score/relevance (regression/classification).
  Simple; ignores that ranking is relative.
- Pairwise (e.g. LambdaMART / RankNet): learn "A should rank above B" from pairs.
  A strong practical default.
- Listwise: optimize a whole-list metric (NDCG) directly. Best alignment with the
  metric, more complex. Pick pairwise as the workhorse; listwise if squeezing
  NDCG justifies the cost.

3) FEATURES
- Query: length, intent, category.
- Document/product: price, rating, popularity, freshness.
- User: history, segment.
- Query-document interaction: BM25/text-match score, historical CTR for this
  (query, doc) pair, past purchases. These cross features carry most of the
  signal.

4) LABELS FROM LOGS (the crux)
- Derive labels from behavior: a clicked/purchased result ranked below a skipped
  one is a pairwise "should have been higher" signal. You don't need human
  relevance ratings.

5) POSITION BIAS (the other crux)
- Users click higher-ranked items regardless of true relevance, so naive click
  labels are biased toward whatever the old ranker showed on top. Correct it:
  randomize/interleave to collect less-biased data, add position as a feature, or
  reweight with inverse propensity of the shown position.

6) EVALUATION
- Offline: NDCG / MAP on held-out logs (with bias correction). Online: A/B test
  with a holdout, watch conversion + guardrail metrics (latency, revenue), not
  just "the number went up".

7) WHAT INTERVIEWERS PROBE
- Pointwise/pairwise/listwise trade-offs; deriving labels from clicks; position
  bias and a concrete correction; the offline-vs-online eval gap.$sol$
where slug = 'search-ranking';

update design_drills set solution = $sol$APPROACH
Rank an already-retrieved set of feed candidates for LONG-TERM engagement, not
raw clicks. The design is a multi-task model whose predictions combine into one
score, plus a way to DETECT the filter-bubble/clickbait failure, not just hope
to avoid it.

1) REQUIREMENTS & OBJECTIVE
- Rank ~500-2000 candidates/load using multiple signals (click, like, share,
  comment, dwell); avoid optimizing engagement into a filter bubble / clickbait;
  let "good" evolve without full retrains.

2) MULTI-TASK MODEL (the crux)
- One model with a shared representation and multiple heads predicting P(click),
  P(like), P(share), P(comment), E[dwell], etc. Shared bottom = shared learning +
  one serving path, vs a brittle model-per-action zoo.

3) COMBINING INTO ONE SCORE
- score = w1*P(click) + w2*P(like) + w3*P(share) + w4*E[dwell] - w5*P(hide/report)
  ... A "value model" weighted sum. The weights encode a PRODUCT decision (what
  the org values), not just a modeling one -- tuning them is how "good" evolves
  without retraining the base model.

4) THE FAILURE MODE (why this drill exists)
- A model trained on what users engaged with reinforces what it already showed,
  narrowing the distribution over time (filter bubble), and pure engagement
  rewards clickbait. Penalize hide/report/"see fewer" signals in the value model,
  and cap/penalize per-source and per-topic over-exposure.

5) DETECTING IT (not just avoiding)
- Track diversity/distribution metrics of what's SERVED over time (topic/source
  entropy), and run a held-out exploration slice serving randomized/diversified
  content to measure divergence from the exploit policy. If served diversity
  collapses, you're bubbling.

6) EVALUATION
- Offline replay is biased by the policy that logged the data (counterfactual
  problem). Use interleaving or a real randomized control for an unbiased read;
  optimize for retention/long-term engagement in the A/B, not day-1 clicks.

7) WHAT INTERVIEWERS PROBE
- Multi-task vs per-action models; weights as a product lever; the feedback loop
  and a DETECTION plan; counterfactual/interleaving evaluation.$sol$
where slug = 'feed-ranking-ml';

update design_drills set solution = $sol$APPROACH
Real-time fraud scoring must decide allow/block/review in <100ms on a hugely
imbalanced stream, with labels that arrive weeks late. The design centers on
imbalance, fast features, the cost-based threshold, and label lag.

1) REQUIREMENTS & OBJECTIVE
- Score each transaction in real time; route high-risk to manual review, not
  just auto-block; adapt as fraud shifts. Scale: tens of K txns/s, <100ms,
  fraud ~0.1%.

2) CLASS IMBALANCE (0.1%)
- Accuracy/ROC-AUC are misleading at this skew. Use precision-recall AUC; handle
  imbalance with class weighting or resampling (undersample negatives / SMOTE with
  care). Optimize for catching fraud value, not raw label accuracy.

3) COST-BASED DECISION (the crux)
- Frame the threshold as business cost: a false positive blocks a legitimate
  purchase (user friction + lost revenue); a false negative pays out fraud
  (direct loss). Pick the operating point from that trade-off, and put MANUAL
  REVIEW as a third band between allow and block for the ambiguous middle.

4) REAL-TIME FEATURES (<100ms)
- Velocity/behavioral features (txns from this card/device/IP in the last
  minute/hour, amount vs the account's norm) must be precomputed: a streaming
  aggregator maintains rolling-window counters in a low-latency feature store,
  read at scoring time. You cannot scan full history per request.

5) LABEL LAG (the other crux)
- Confirmed fraud arrives weeks later via chargebacks. So recent training data
  has immature labels: a naive "retrain nightly on all labels so far" treats
  recent not-yet-charged-back fraud as legit and learns the wrong thing. Account
  for the maturation window; weight/segment recent data accordingly.

6) ADAPTATION
- Fraudsters probe and adapt (adversarial drift), so monitor score/feature
  distributions and retrain on a regular cadence; keep human-review feedback as a
  faster label source than chargebacks.

7) WHAT INTERVIEWERS PROBE
- Metric choice under imbalance; the FP/FN cost framing + review band; streaming
  features vs history scans; the label-lag trap; adversarial drift + retraining.$sol$
where slug = 'fraud-detection';

update design_drills set solution = $sol$APPROACH
CTR prediction feeds a bid (E[value] = P(click) x bid), at millions of QPS under
a <10ms budget. Two things dominate: high-cardinality sparse features, and
CALIBRATION (not just ranking), because the probability is multiplied into money.

1) REQUIREMENTS & OBJECTIVE
- Predict P(click) for (ad, user, context); well-CALIBRATED, not just well-ranked;
  adapt to new campaigns with no history. Scale: millions QPS, <10ms model budget,
  thousands of high-cardinality categoricals.

2) FEATURES (the sparse crux)
- user_id, ad_id, publisher_id etc. are huge-cardinality. Don't one-hot -- use
  learned embeddings for the important ids and feature hashing for the long tail
  (state the hashing-collision trade-off: fewer buckets = more collisions = lost
  signal). Cross features (user x ad category) capture interactions.

3) MODEL (justify the rung)
- Logistic regression with feature crosses is a strong, cheap, well-calibrated
  baseline. Gradient-boosted trees add nonlinearity. A deep model (Wide & Deep /
  DeepFM / DCN) learns interaction terms + embeddings when the data justifies it.
  Don't jump to the deepest model without a reason -- latency and calibration cost.

4) CALIBRATION (why this drill exists)
- Bidding multiplies P(click) by bid, so a model that RANKS ads correctly but is
  mis-calibrated produces systematically wrong bids (over/under-paying) even with
  great AUC. Calibrate the output (Platt scaling / isotonic regression) and
  monitor predicted-vs-actual CTR by bucket.

5) FRESHNESS
- New campaigns have no history; a pure daily batch model treats them as unknown
  too long. Use online/incremental learning (or very frequent retrains) so recent
  clicks update the model quickly.

6) LATENCY (<10ms)
- Budget it: feature lookup (embedding/feature-store fetch) + inference + network
  must sum under 10ms. Precompute/cached embeddings, compact models, and colocated
  feature stores make this real rather than asserted.

7) WHAT INTERVIEWERS PROBE
- Embeddings vs hashing + collisions; model-choice justification; WHY calibration
  matters for bidding and how to fix it; online vs batch for new campaigns; the
  latency budget breakdown.$sol$
where slug = 'ad-ctr-prediction';

update design_drills set solution = $sol$APPROACH
A grounded support assistant retrieves from a large private corpus and answers
with citations, where an ungrounded (hallucinated) answer is worse than none.
The design is chunking + hybrid retrieval + rerank + generation, with an eval
harness for faithfulness and a story for updates.

1) REQUIREMENTS & OBJECTIVE
- Answer questions grounded in retrieved docs, with citations; handle doc
  updates/deletes (stale answers are a failure); decline when nothing relevant
  exists rather than hallucinate. Scale: ~2M continuously-updated docs.

2) INGESTION / CHUNKING
- Split docs into chunks with sensible size + overlap: too large hurts retrieval
  precision, too small loses context. Embed each chunk; store vector + metadata
  (source, version, url) in a vector index.

3) RETRIEVAL (hybrid -- the crux)
- Combine semantic (embedding ANN) with lexical (BM25/keyword) search. Support
  queries lean on exact tokens (product names, error codes) that pure embeddings
  miss, so hybrid beats semantic-only. Fuse the two candidate lists.

4) RERANK
- Rerank the fused top-N with a cross-encoder (query attends to passage) to get a
  high-precision top-k, rather than feeding raw ANN hits into the prompt.

5) GENERATION + GROUNDING
- Assemble the top-k passages into the prompt; instruct the model to answer ONLY
  from them and cite chunk ids. If retrieval confidence is low / nothing relevant,
  decline or escalate to a human -- do NOT free-generate.

6) EVALUATION (hallucination)
- Build a faithfulness eval set: measure whether answers are supported by cited
  sources (LLM-as-judge + a human-labeled set), plus retrieval recall@k and
  answer accuracy. This is the gate that catches hallucination regressions.

7) UPDATES / DELETES + COST
- On doc change: re-chunk + re-embed and REPLACE stale vectors (don't append
  versions forever); on delete, remove vectors so they can't be cited. Re-indexing
  2M live docs is a real cost -- incremental, change-driven. Cache repeated/similar
  queries; budget the retrieve->rerank->generate latency.

8) WHAT INTERVIEWERS PROBE
- Chunking trade-offs; WHY hybrid over semantic-only; the rerank step; the
  faithfulness eval + "decline when unsure"; keeping the index fresh on
  updates/deletes without unbounded growth.$sol$
where slug = 'rag-support-assistant';
