-- Design Drills: a LeetCode-style problem bank for system design and ML system
-- design practice, plus timed self-graded attempts.
--
-- New module (not in myhub_plan.md — none of Wave 1-4 scoped a design-practice
-- surface). Prep Tracker already has entry_type 'system_design' /
-- 'ml_system_design' for LOGGING a rep after the fact (migration 0003), but a
-- rep log and a problem bank are different things: the roadmap's own §2.3 note
-- ("don't conflate a problem bank with a rep log") is why this is a sibling
-- module rather than new columns on prep_entries. A drill here is the reusable
-- problem; an attempt is one timed sitting against it. Cross-module: this emits
-- `drill.completed` on the Event Bus (src/lib/events.ts) rather than writing
-- into prep_entries directly, per architecture rule 1.

create type design_drill_category as enum ('system_design', 'ml_system_design');

create type design_drill_difficulty as enum ('warmup', 'core', 'advanced');

-- Mirrors the OA/onsite reality: you get a rating, not a numeric score, and you
-- give it to yourself, against the rubric, after the clock stops.
create type design_drill_self_rating as enum ('strong', 'solid', 'weak');

create table design_drills (
  id uuid primary key default gen_random_uuid(),
  -- Stable handle for re-running this seed migration and for deep-linking
  -- (/design-drills/<slug>) without depending on generated uuids.
  slug text not null unique,
  category design_drill_category not null,
  difficulty design_drill_difficulty not null,
  title text not null,
  -- Markdown. The full OA-style prompt: scale, constraints, functional asks.
  prompt text not null,
  -- One rubric bullet per array element (not a single markdown blob) so the
  -- UI can render each as an individually checkable self-grade item, and so
  -- design_drill_attempts.rubric_hits can reference them by stable index.
  -- Shown only after the attempt is submitted — never fetched alongside the
  -- prompt at the UI layer.
  rubric text[] not null default '{}',
  estimated_minutes int not null,
  tags text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table design_drill_attempts (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references design_drills (id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Wall-clock seconds actually spent, set when the attempt is submitted. Not
  -- derived from completed_at - started_at, since a paused/resumed session
  -- (or one left open overnight) would otherwise report a bogus duration.
  duration_sec int,
  -- The scratchpad: the design write-up itself, so past attempts stay
  -- reviewable, not just their score.
  notes text,
  -- Which rubric bullets (0-indexed into design_drills.rubric) the user
  -- checked off as covered. A snapshot at submit time, not a live join against
  -- the drill's current rubric, which can be edited later.
  rubric_hits int[] not null default '{}',
  self_rating design_drill_self_rating,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An in-progress attempt has completed_at/duration_sec/self_rating null; a
-- submitted one has all three. rubric_hits can legitimately be empty either way
-- (a submitted attempt that hit nothing on the rubric), so it's not part of the
-- gate.
alter table design_drill_attempts
  add constraint design_drill_attempts_completion_is_atomic check (
    (completed_at is null and duration_sec is null and self_rating is null)
    or (completed_at is not null and duration_sec is not null and self_rating is not null)
  );

-- Browse/filter reads by (category, difficulty); the drill workspace reads one
-- row by id (PK, already indexed).
create index design_drills_category_difficulty_idx
  on design_drills (category, difficulty)
  where deleted_at is null;

-- "Your past attempts on this drill" and "your recent attempts" are the two
-- reads the workspace and history view need.
create index design_drill_attempts_drill_id_idx
  on design_drill_attempts (drill_id)
  where deleted_at is null;

create index design_drill_attempts_completed_at_idx
  on design_drill_attempts (completed_at desc)
  where deleted_at is null and completed_at is not null;

create trigger design_drills_set_updated_at
  before update on design_drills
  for each row
  execute function set_updated_at();

create trigger design_drill_attempts_set_updated_at
  before update on design_drill_attempts
  for each row
  execute function set_updated_at();

-- RLS, matching every other table (migration 0012). Single-user: the gate is
-- "you must be signed in", not per-row ownership.
alter table design_drills enable row level security;

drop policy if exists design_drills_authenticated on design_drills;
create policy design_drills_authenticated on design_drills
  for all to authenticated using (true) with check (true);

alter table design_drill_attempts enable row level security;

drop policy if exists design_drill_attempts_authenticated on design_drill_attempts;
create policy design_drill_attempts_authenticated on design_drill_attempts
  for all to authenticated using (true) with check (true);

-- Seed bank. on conflict (slug) so this migration stays re-runnable and so a
-- later migration can add drills without touching this file. Prompts are
-- written at real OA/onsite length (scale numbers, explicit functional asks)
-- rather than one-liners, and rubrics are the "what a strong answer hits" bar,
-- not a model solution.

insert into design_drills (slug, category, difficulty, title, prompt, rubric, estimated_minutes, tags)
values
(
  'url-shortener',
  'system_design',
  'warmup',
  'URL Shortener',
  $$Design a URL shortening service like bit.ly.

**Scale:** 100M new URLs/day, 10:1 read:write ratio, links live for years.

**Functional requirements:**
- Given a long URL, return a short one.
- Given a short URL, redirect to the original (as close to instant as possible).
- A user can optionally pick a custom alias.
- Links can expire.

**Non-functional:** short codes must not be guessable in sequence (no
`bit.ly/1`, `bit.ly/2`, ...); redirects should not become the bottleneck under
read-heavy load.

Cover: the API surface, the key-generation scheme, the data model, and how you
serve 10:1 read-heavy traffic without hammering the primary store on every
click.$$,
  array[
    $r$Key generation: compares a counter+base62 encoding against a hash-based scheme, and calls out the collision-handling implication of each.$r$,
    $r$Explains why the short code shouldn't be sequential (enumeration/guessing) and how the chosen scheme avoids it.$r$,
    $r$Picks a data store and justifies it (a KV store is defensible; so is a relational table with an index on the short code, if justified).$r$,
    $r$Adds a cache layer (e.g. Redis) in front of the DB specifically to absorb the 10:1 read skew, and discusses cache invalidation on expiry/deletion.$r$,
    $r$Puts click analytics on an async path (event queue / log, not a synchronous write in the redirect's hot path).$r$,
    $r$Addresses custom aliases as a uniqueness constraint distinct from generated codes.$r$
  ],
  30,
  array['hashing', 'caching', 'key-value store']
),
(
  'rate-limiter',
  'system_design',
  'core',
  'Distributed Rate Limiter',
  $$Design a rate limiter that a company can drop in front of many internal
services as a shared library or sidecar — e.g. "user X may call this API at
most 100 times per minute."

**Scale:** thousands of services, each processing 1K-50K req/s, sharing one
rate-limiting layer.

**Functional requirements:**
- Support per-user and per-API limits.
- Support at least two limiting strategies (e.g. fixed window and a smoother
  alternative) and explain the trade-off.
- Return a clear signal to the caller when a request is rejected (headers,
  retry-after).

**Non-functional:** must work correctly across multiple instances of the
calling service (no single instance holding all the state in memory), and must
have a defined behavior if the rate limiter's own datastore goes down.

Cover: the algorithm choice, where the counters actually live, and what happens
under concurrent requests and under datastore failure.$$,
  array[
    $r$Compares at least two algorithms by name (token bucket, leaky bucket, fixed window counter, sliding window log, sliding window counter) with a concrete trade-off (memory vs. burst-smoothness vs. accuracy at window edges).$r$,
    $r$Puts shared state in a centralized fast store (e.g. Redis) rather than per-instance memory, since the requirement is correctness across many instances of the calling service.$r$,
    $r$Identifies the race condition on a concurrent read-modify-write of a counter and names a fix (atomic INCR, Lua script, or equivalent).$r$,
    $r$Explicitly decides fail-open vs. fail-closed when the rate limiter's store is unreachable, and justifies the choice against the cost of each failure mode.$r$,
    $r$Addresses how limits are configured/looked up per API without a hardcoded rule per endpoint.$r$
  ],
  45,
  array['redis', 'distributed systems', 'api gateway']
),
(
  'news-feed',
  'system_design',
  'core',
  'News Feed / Timeline',
  $$Design the home timeline for a social app like Twitter/Instagram: when a
user opens the app, they see recent posts from accounts they follow.

**Scale:** 300M daily active users, average user follows 200 accounts, some
celebrity accounts have 100M+ followers, users expect the feed to load in
under 200ms.

**Functional requirements:**
- Generate a feed of recent posts from followed accounts.
- Support posting, following/unfollowing.
- New posts should show up in followers' feeds within seconds.

Cover: how you'd generate the feed (compute it at post-time vs. at read-time,
or both), and specifically how celebrity accounts change your answer.$$,
  array[
    $r$Explains fan-out-on-write (push to followers' feed caches at post time) and fan-out-on-read (pull and merge at read time), with the actual trade-off: write amplification vs. read latency.$r$,
    $r$Identifies that fan-out-on-write breaks down for celebrity accounts (100M followers = 100M writes per post) and proposes a hybrid: push for normal accounts, pull-and-merge for accounts above a follower threshold.$r$,
    $r$Uses cursor-based pagination for the feed, not offset-based, and explains why (new posts shifting offsets).$r$,
    $r$Covers cache invalidation / staleness when a followed account posts or a post is deleted.$r$,
    $r$At least mentions where ranking would hook in, even if ranking itself is out of scope for this pass.$r$
  ],
  45,
  array['fan-out', 'caching', 'pagination']
),
(
  'job-scheduler',
  'system_design',
  'advanced',
  'Distributed Job Scheduler',
  $$Design a system that runs both cron-like recurring jobs and one-off
scheduled jobs at scale (think a simplified Airflow/Temporal).

**Scale:** millions of scheduled jobs, jobs can take seconds to hours, the
system must survive individual worker crashes without losing or double-running
a job in a way that matters.

**Functional requirements:**
- Schedule a job to run at a specific time, or on a recurring cron expression.
- Retry a failed job with backoff, up to a configurable limit.
- A job must not silently vanish if the worker running it crashes mid-execution.

Cover: how work gets assigned to workers, how you avoid two workers running the
same job at once, and what "exactly-once" actually means here (it usually
isn't literal).$$,
  array[
    $r$Distinguishes at-least-once from exactly-once delivery, and explains why the practical answer is at-least-once delivery + an idempotency key so a job double-running is harmless rather than promising literal exactly-once.$r$,
    $r$Describes how a worker claims a job without two workers claiming the same one (a lease/lock with a timeout, or a DB row-level lock with SELECT ... FOR UPDATE SKIP LOCKED or equivalent) — not just "a queue," which doesn't by itself prevent double-claiming on redelivery.$r$,
    $r$Handles a worker crashing mid-job: the lease expires and the job becomes claimable again, rather than being stuck "in progress" forever.$r$,
    $r$Covers retry with backoff and a max-attempts cutoff, and where the job goes after it (dead-letter, alerting).$r$,
    $r$Addresses how the job store is sharded/partitioned at millions of rows, and doesn't hand-wave clock skew across workers for time-based scheduling.$r$
  ],
  60,
  array['queues', 'leader election', 'idempotency']
),
(
  'collab-editor',
  'system_design',
  'advanced',
  'Real-Time Collaborative Document Editor',
  $$Design the real-time editing core of something like Google Docs: multiple
users typing in the same document at once, each seeing the others' edits live.

**Scale:** documents with up to ~50 concurrent editors, edits should appear for
other viewers within ~200ms, offline edits (brief network drop) must merge back
in without corrupting the document.

**Functional requirements:**
- Concurrent edits from multiple users converge to the same final document for
  everyone, without a "last write wins" data-loss failure.
- Show other users' live cursors/selections.
- The document persists and can be reopened later with full history intact.

Cover: your conflict-resolution strategy by name, and why it's the right fit
given the concurrency and offline requirements above.$$,
  array[
    $r$Names Operational Transformation and CRDTs specifically and picks one with a real justification (OT: needs a central server to transform ops and is harder to get right; CRDTs: merge is commutative/associative and tolerate offline edits more naturally, at some memory/metadata cost).$r$,
    $r$Describes the WebSocket connection model for broadcasting ops/deltas to other editors, and what happens on reconnect after a drop (resync, not "replay everything from scratch" as the only option considered).$r$,
    $r$Handles presence/cursors as a separate, lower-durability data path from the document content itself (ephemeral, doesn't need to survive a crash the way content does).$r$,
    $r$Covers persistence: periodic snapshots plus an op log (or CRDT state) rather than replaying every edit since document creation on every load.$r$,
    $r$Addresses how connection state scales past one server (a single doc's editors need to reach the same broadcast fan-out even if they're on different connection servers).$r$
  ],
  60,
  array['crdt', 'websockets', 'conflict resolution']
),
(
  'proximity-search',
  'system_design',
  'advanced',
  'Nearby / Proximity Search',
  $$Design a "find things near me" service like Uber's nearby-drivers search or
Yelp's nearby-restaurants search.

**Scale:** 5M actively moving entities (drivers) updating location every few
seconds, queries asking "what's within 2km of (lat, lng)" at high QPS, plus a
separate corpus of ~50M static entities (restaurants) that almost never move.

**Functional requirements:**
- Given a point and a radius, return nearby entities ranked by distance.
- Moving entities' positions must be current to within a few seconds.
- Static entities' search should support additional filters (cuisine, rating).

Cover: your geospatial indexing approach, and why moving vs. static entities
might need different handling.$$,
  array[
    $r$Names a concrete geospatial indexing approach (geohash, quadtree, or Uber's S2/H3) and explains the core trade-off of the one chosen (geohash: simple, but boundary/edge cases at cell borders; quadtree: adapts to density but needs rebalancing; S2/H3: uniform cells, good for radius queries).$r$,
    $r$Recognizes that constantly-moving entities (drivers) are a very different write pattern than near-static ones (restaurants), and proposes handling them differently rather than one index for both (e.g. an in-memory/fast-path index for moving entities vs. a persisted, less frequently updated index for static ones).$r$,
    $r$Explains how a radius query maps onto the chosen index (which cells/nodes to visit, and not scanning irrelevant ones).$r$,
    $r$Addresses the update cost of a moving entity's position change (index update frequency vs. staleness tolerance).$r$,
    $r$Covers additional filtering (cuisine, rating) as a secondary filter applied after or alongside the geospatial candidate set, not baked into the spatial index itself.$r$
  ],
  60,
  array['geospatial', 'indexing', 'real-time']
),
(
  'recommendation-system',
  'ml_system_design',
  'core',
  'Video/Product Recommendation System',
  $$Design the recommendation system for a large video platform (YouTube-scale):
given a user, surface videos they're likely to watch and enjoy.

**Scale:** hundreds of millions of videos in the catalog, billions of daily
recommendation requests, p99 latency budget in the tens of milliseconds per
request.

**Functional requirements:**
- Produce a ranked list of recommended videos for a user, refreshed as they
  interact with the app.
- Handle a brand-new user with no watch history.
- Handle a brand-new video with no engagement data yet.

Cover: the overall serving architecture (you cannot score hundreds of millions
of candidates per request), the training data / label source, and how offline
metrics relate to what you'd actually watch in production.$$,
  array[
    $r$Describes a two-stage architecture: candidate generation/retrieval (narrows hundreds of millions down to hundreds/thousands) followed by a heavier ranking model on the shortlist — and explains why a single model scoring the full catalog per request doesn't fit the latency budget.$r$,
    $r$Names a concrete retrieval approach (e.g. two-tower embedding model + ANN search via FAISS/ScaNN, or collaborative filtering) for candidate generation.$r$,
    $r$Lists concrete feature sources for ranking: user history, video metadata, contextual features (time of day, device), and interaction features.$r$,
    $r$Addresses cold-start on both sides: a new user (fall back to popularity/demographic priors) and a new video (content-based features until engagement data accumulates) — not just one side.$r$,
    $r$Names the training/serving skew risk (features computed differently offline vs. online) and a mitigation (shared feature pipeline/feature store).$r$,
    $r$Distinguishes offline evaluation metrics (AUC, NDCG on held-out logs) from online metrics (CTR, watch time, session length via A/B test), and notes that a win on one doesn't guarantee a win on the other.$r$
  ],
  45,
  array['recommenders', 'embeddings', 'ann search']
),
(
  'search-ranking',
  'ml_system_design',
  'core',
  'Search Result Ranking (Learning to Rank)',
  $$Design the ranking layer for a search engine or marketplace search (e.g.
ranking product results for a query on an e-commerce site).

**Scale:** tens of millions of queries/day, each query already has a candidate
set of ~1000 results from a retrieval step (out of scope — assume it exists),
and you need to rank that set.

**Functional requirements:**
- Given a query and a candidate list, return a ranked order optimized for
  relevance/purchase likelihood.
- Learn from historical click/purchase logs rather than hand-tuned rules.
- Support ongoing evaluation of ranker changes before full rollout.

Cover: the modeling approach (pointwise/pairwise/listwise), where your training
labels come from, and a known bias in click data you need to correct for.$$,
  array[
    $r$Names and compares pointwise, pairwise, and listwise learning-to-rank approaches, and picks one with a reason tied to the objective (e.g. pairwise as a practical middle ground; listwise if directly optimizing a ranking metric like NDCG matters enough to justify the complexity).$r$,
    $r$Lists concrete feature groups: query features, document/product features, user features, and query-document interaction features (e.g. BM25 score, historical CTR for this query-doc pair).$r$,
    $r$Explains how labels are derived from click/purchase logs (e.g. clicked doc > skipped-above doc as a pairwise label) rather than assuming explicit relevance ratings exist.$r$,
    $r$Names position bias specifically (users click higher-ranked results more regardless of relevance) and a correction (result randomization to collect unbiased data, or explicit position features / inverse propensity weighting).$r$,
    $r$Describes an A/B testing plan for a new ranker (holdout traffic split, guardrail metrics) rather than just replacing the ranker and watching overall numbers move.$r$
  ],
  45,
  array['learning to rank', 'click models', 'ab testing']
),
(
  'feed-ranking-ml',
  'ml_system_design',
  'advanced',
  'ML-Ranked Social Feed',
  $$You already have a feed of candidate posts from people a user follows
(fan-out solved elsewhere — out of scope). Design the ML ranking layer that
orders those candidates, optimizing for long-term engagement rather than raw
clicks.

**Scale:** the ranker scores ~500-2000 candidate posts per feed load, hundreds
of millions of feed loads/day, and the product has been burned before by a
ranker that maximized short-term clicks at the cost of visible long-term
engagement decline.

**Functional requirements:**
- Rank candidates using multiple signals: predicted click, like, share,
  comment, and time spent.
- Avoid optimizing so hard for engagement that the feed becomes a filter
  bubble or promotes low-quality "clickbait" content.
- Allow the definition of "good" to evolve without retraining from scratch
  every time a new signal is added.

Cover: how you combine multiple predicted actions into one ranking score, and
how you'd detect (not just hope to avoid) the filter-bubble/engagement-bait
failure mode.$$,
  array[
    $r$Proposes a multi-task model predicting several actions jointly (click, like, share, dwell/watch time, etc.) rather than one model per action trained and served independently, and explains the benefit (shared representations, one serving path).$r$,
    $r$Describes combining the multiple predicted probabilities into a single ranking score via a weighted sum (a "value model") and explicitly notes the weights encode a product decision, not just a modeling one.$r$,
    $r$Names the feedback-loop / filter-bubble risk directly: a model trained on what users engaged with reinforces what it already showed them, narrowing the distribution over time.$r$,
    $r$Proposes a concrete way to detect this rather than just avoiding it by design: diversity/exploration metrics, tracking content-type distribution served over time, or a held-out exploration slice of randomized/diversified content to measure divergence.$r$,
    $r$Distinguishes correlational and counterfactual evaluation (offline replay of logged data is biased by the policy that collected it) and mentions interleaving or a proper randomized control as the way to get an unbiased read.$r$
  ],
  60,
  array['multi-task learning', 'feedback loops', 'ranking']
),
(
  'fraud-detection',
  'ml_system_design',
  'advanced',
  'Real-Time Payment Fraud Detection',
  $$Design a system that scores payment transactions for fraud in real time and
either allows, blocks, or flags them for review.

**Scale:** tens of thousands of transactions/sec at peak, decision must be
made in under 100ms, fraud is roughly 0.1% of transactions, and confirmed fraud
labels often arrive weeks after the transaction (via chargebacks).

**Functional requirements:**
- Score each transaction in real time using recent behavioral signals (e.g.
  velocity of transactions from this account/card in the last hour).
- Route high-risk transactions to manual review instead of an automatic
  block, when appropriate.
- Adapt as fraud patterns shift (fraudsters actively probe for what gets
  through).

Cover: how you handle the severe class imbalance, how "recent behavior"
features get computed fast enough for a 100ms budget, and what label lag does
to your training/retraining loop.$$,
  array[
    $r$Addresses the ~0.1% class imbalance directly: names a concrete technique (resampling, class weighting, or a metric choice like precision-recall AUC instead of plain accuracy/ROC-AUC which is misleading at this skew).$r$,
    $r$Frames the precision/recall trade-off as a business-cost decision, not a pure modeling one: a false positive blocks a legitimate purchase (cost to the user/business), a false negative lets fraud through (direct monetary cost) — and ties the threshold choice to that trade-off, including where manual review sits as a third option between allow and block.$r$,
    $r$Describes real-time feature computation for the sub-100ms budget: precomputed aggregates in a low-latency store (a feature store / streaming aggregation keeping rolling windows), not computing velocity features from a full transaction history scan at request time.$r$,
    $r$Explicitly names the label lag problem (chargebacks land weeks later) and its consequence: today's model is trained on data that was itself using weeks-stale ground truth, so a naive "retrain nightly on all labels seen so far" quietly trains on an incomplete/immature label set for recent data.$r$,
    $r$Names adversarial drift (fraudsters adapt to the model) as a reason for ongoing monitoring and a retraining cadence, not a train-once-and-serve system.$r$
  ],
  60,
  array['class imbalance', 'streaming features', 'label lag']
),
(
  'ad-ctr-prediction',
  'ml_system_design',
  'advanced',
  'Ad Click-Through-Rate Prediction',
  $$Design the CTR prediction model that powers ad ranking/bidding for an ad
system.

**Scale:** millions of queries per second across the ad exchange, a hard
latency budget under 10ms for the model's contribution, thousands of
high-cardinality categorical features (user id, ad id, publisher id, etc.).

**Functional requirements:**
- Predict P(click) for an (ad, user, context) triple.
- The predicted probability must be well-calibrated, not just well-ranked —
  it feeds directly into a bidding formula that multiplies it by bid price.
- The model should adapt to fast-moving trends (a new ad campaign's true CTR
  isn't known until it gets traffic).

Cover: how you handle the high-cardinality sparse features under the latency
budget, why calibration matters here specifically (not just AUC), and
batch vs. online learning.$$,
  array[
    $r$Addresses high-cardinality categorical features (user id, ad id, etc.) via embeddings or feature hashing rather than naive one-hot encoding, and discusses the hashing-collision trade-off if hashing is chosen.$r$,
    $r$Names a concrete model progression/choice appropriate to the constraints (logistic regression with feature crosses as a strong simple baseline; gradient-boosted trees; a deep model like DeepFM/Wide&Deep/DCN for interaction terms) rather than jumping straight to the most complex option with no justification.$r$,
    $r$Explains WHY calibration matters here specifically: the predicted probability is multiplied directly into a bid formula (expected value = P(click) × bid), so a well-ranked but poorly-calibrated model produces systematically wrong bids even if it ranks ads correctly relative to each other — and names a calibration technique (Platt scaling / isotonic regression) as a fix.$r$,
    $r$Discusses online/incremental learning (or frequent retraining) specifically to handle new ad campaigns with no historical CTR, versus a pure batch model that would treat them as unknowns for too long.$r$,
    $r$Gives a concrete latency budget breakdown (feature lookup, model inference, network) that sums to under the 10ms target rather than asserting the number without justification.$r$
  ],
  60,
  array['ctr prediction', 'calibration', 'feature hashing']
),
(
  'rag-support-assistant',
  'ml_system_design',
  'advanced',
  'RAG-Based Support Assistant',
  $$Design a support assistant that answers user questions by retrieving from a
large private corpus of internal docs (product docs, past tickets, runbooks)
and generating an answer grounded in what it retrieved.

**Scale:** ~2M documents in the corpus, updated continuously, thousands of
queries/day, and the product requirement is that answers must be traceable to
a source document — an ungrounded (hallucinated) answer is worse than no
answer.

**Functional requirements:**
- Given a user question, retrieve relevant document chunks and generate a
  grounded answer with citations.
- Handle documents that update or get deleted (stale answers are a real
  failure mode here).
- Detect and handle the case where nothing relevant exists in the corpus,
  rather than generating a plausible-sounding but ungrounded answer.

Cover: your chunking and retrieval strategy, how you evaluate whether the
system is hallucinating, and how updates/deletes propagate.$$,
  array[
    $r$Describes a concrete chunking strategy (size, overlap) and explains the trade-off (too large hurts retrieval precision, too small loses context) -- chunking isn't treated as an afterthought.$r$,
    $r$Names a vector DB / ANN index choice and discusses hybrid retrieval (combining lexical/keyword search like BM25 with semantic/embedding search), not semantic search alone, since exact terms (product names, error codes) are common in support queries and often underperform in pure embedding search.$r$,
    $r$Includes a reranking step after initial retrieval (a cross-encoder or similar) to improve precision on the top-k passed to the generator, rather than feeding raw retrieval results straight into the prompt.$r$,
    $r$Names a concrete hallucination-mitigation and evaluation approach: grounding citations back to retrieved chunks, an LLM-as-judge or human eval set measuring answer-faithfulness to sources, and a defined behavior (decline to answer / escalate) when retrieval confidence is low or nothing relevant is found.$r$,
    $r$Addresses document updates/deletes: re-embedding on change and removing stale vectors, not just appending new versions forever, and considers the latency/cost of re-indexing 2M continuously-updated documents.$r$,
    $r$Mentions caching (e.g. for repeated/similar queries) and the latency/cost budget of a full retrieve-rerank-generate pipeline.$r$
  ],
  60,
  array['rag', 'vector search', 'hallucination eval']
)
on conflict (slug) do nothing;
