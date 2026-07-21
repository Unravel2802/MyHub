-- Design Drills: expand the bank with 13 new drills (9 system design, 4 ML)
-- See migration 0024 for the seed format and 0025 for the `solution` column.
-- SD-weighted per the plan, and fills the thin warmup/core tiers. Prompts are
-- OA/onsite length; rubrics are "what a strong answer hits"; solutions are full
-- worked answers authored for whitespace-pre-wrap legibility.
--
-- on conflict (slug) do nothing so this stays re-runnable.

insert into design_drills (slug, category, difficulty, title, prompt, rubric, solution, estimated_minutes, tags)
values
(
  'unique-id-generator',
  'system_design',
  'warmup',
  'Distributed Unique ID Generator',
  $$Design a service that generates unique 64-bit IDs for a distributed system
(like Twitter's Snowflake).

**Scale:** thousands of IDs/s across many hosts and data centers, IDs should be
roughly time-sortable, no central coordination on the hot path.

**Functional requirements:**
- Generate unique 64-bit IDs.
- IDs are roughly monotonic by creation time.
- Work across many hosts without collision or a shared lock per ID.

Cover: the bit layout, how you avoid collisions without central coordination,
and what happens on clock skew / a clock moving backwards.$$,
  array[
    $r$Proposes a concrete bit layout (timestamp | worker id | per-ms sequence) and explains the sizing of each field against host count and rate.$r$,
    $r$Avoids a central bottleneck: uniqueness comes from (time + worker id + sequence) so each host generates independently with no per-ID lock.$r$,
    $r$Explains time-sortability (timestamp in the high bits) and its benefit (roughly ordered IDs, good index locality / range scans).$r$,
    $r$Handles per-ms sequence overflow (wait for the next ms) and how each host gets a distinct worker id.$r$,
    $r$Addresses a clock moving backwards (refuse/wait rather than risk duplicate IDs) instead of ignoring clock skew.$r$,
    $r$Compares to alternatives (UUIDv4 -> no ordering; DB auto-increment -> central bottleneck; ticket server -> SPOF).$r$
  ],
  $sol$APPROACH
Snowflake-style: pack a 64-bit id from time + a per-host worker id + a per-ms
sequence, so every host mints ids independently with no lock, and ids sort
roughly by time.

1) REQUIREMENTS
- Unique 64-bit ids; roughly time-ordered; many hosts/DCs; no central bottleneck.

2) BIT LAYOUT (the crux)
- 1 sign bit (0) | 41 bits ms timestamp (custom epoch, ~69 years) | 10 bits worker
  id (1024 hosts) | 12 bits sequence (4096 ids/ms/host). ~4M ids/s/host; resize
  fields to your host count vs rate.

3) NO CENTRAL LOCK
- (timestamp, worker_id, sequence) is unique by construction, so hosts generate
  locally with no coordination. Only worker-id ASSIGNMENT needs coordination, and
  rarely: config, a ZooKeeper/etcd lease, or derive from host/pod identity.

4) SEQUENCE OVERFLOW
- Same ms: increment the sequence; if it overflows 4096, busy-wait until the next
  ms and reset the sequence to 0.

5) CLOCK SKEW (the gotcha)
- If the clock moves BACKWARDS (NTP correction), reissuing an earlier ms can
  collide with ids already minted. Refuse and wait until the clock passes the
  last-seen timestamp -- never mint on a rewound clock.

6) ALTERNATIVES
- UUIDv4: 128-bit, no ordering, index-unfriendly. DB auto-increment: central
  bottleneck + SPOF. Central ticket server: hotspot/SPOF. Snowflake wins for
  ordered, decentralized ids.

7) WHAT INTERVIEWERS PROBE
- The bit layout + sizing; why no lock is needed; sequence overflow; the
  clock-goes-backwards case; worker-id assignment.$sol$,
  15,
  array['ids', 'snowflake', 'distributed systems']
),
(
  'notification-system',
  'system_design',
  'core',
  'Notification / Push Fan-out',
  $$Design a notification system that delivers messages across multiple channels
(push, email, SMS) -- e.g. an "order shipped" alert.

**Scale:** 100M users, 500M notifications/day, bursty (a marketing blast to 10M
users at once).

**Functional requirements:**
- Send a notification to a user across one or more channels.
- Respect user preferences / opt-outs.
- Don't double-send on retries.
- Survive third-party provider failures and rate limits.

Cover: the pipeline from event to delivery, how you handle provider rate
limits/failures, and how you avoid double-sending.$$,
  array[
    $r$Describes an async pipeline: event -> queue -> per-channel workers -> provider, decoupling producers from delivery.$r$,
    $r$Enforces user preferences / opt-outs / channel selection as a lookup before send, not after.$r$,
    $r$Ensures idempotency so a retried or duplicate event doesn't double-send (idempotency key per (user, notification, channel)).$r$,
    $r$Handles provider failures + rate limits: retries with backoff, per-provider rate limiting, dead-letter, and failover.$r$,
    $r$Absorbs bursts (a 10M blast) via queue buffering + worker autoscaling and priority lanes (transactional over marketing).$r$,
    $r$Addresses templating/localization and per-notification delivery tracking (sent/delivered/failed).$r$
  ],
  $sol$APPROACH
A notification system is an async fan-out pipeline: an event enters a queue, is
expanded per recipient/channel against preferences, and per-channel workers hand
off to third-party providers with retries and idempotency.

1) REQUIREMENTS
- Send across push/email/SMS; respect prefs/opt-outs; dedupe; survive provider
  failures/rate limits. Scale: 100M users, 500M/day, bursty.

2) PIPELINE
- Producer emits an event -> ingestion -> message queue (Kafka). Workers resolve
  recipients + channels, render templates, enqueue per-channel tasks. Per-channel
  worker pools call providers (APNs/FCM, SES, Twilio). Async + queued so producers
  never block and bursts buffer.

3) PREFERENCES / ROUTING
- Before send, look up prefs + opt-outs + quiet hours + per-category settings;
  drop disabled channels. Compliance (unsubscribe) is enforced here.

4) IDEMPOTENCY / DEDUPE (the crux)
- Each (user, notification, channel) has an idempotency key; a store records what's
  sent so a retried/duplicate event doesn't double-send. At-least-once queue +
  idempotency = no dupes that matter.

5) PROVIDER FAILURES + RATE LIMITS
- Per-provider rate limiter; retries with exponential backoff + jitter; dead-letter
  after max attempts; failover to a secondary provider; track provider health.

6) BURSTS
- A 10M blast lands in the queue and drains at the providers' sustainable rate;
  workers autoscale on queue depth. Priority lanes so "order shipped" beats
  marketing.

7) TRACKING
- Persist per-notification status from provider webhooks (queued/sent/delivered/
  failed/bounced) for observability + suppressing bad addresses.

8) WHAT INTERVIEWERS PROBE
- Async queue + per-channel workers; idempotency vs double-send; provider retry/
  backoff/failover + rate limits; burst absorption + priority; preference
  enforcement.$sol$,
  40,
  array['queues', 'fan-out', 'third-party providers']
),
(
  'typeahead',
  'system_design',
  'core',
  'Search Autocomplete / Typeahead',
  $$Design search autocomplete: as the user types, show the top completions.

**Scale:** the suggestion data is built from 10B searches/day, each keystroke
must return in under 100ms, and you show the top-k (e.g. 5) completions ranked
by popularity.

**Functional requirements:**
- Given a prefix, return the top-k most popular completions.
- Suggestions reflect popular / trending queries (within some staleness).
- Sub-100ms per keystroke.

Cover: the data structure for prefix lookup, how top-k is served fast, and how
the suggestion data is built and updated from query logs.$$,
  array[
    $r$Uses a prefix structure (trie) and stores PRECOMPUTED top-k at each node rather than ranking at query time.$r$,
    $r$Serves each keystroke in <100ms: top-k per prefix is precomputed/cached (edge cache), so a keystroke is a lookup, not a ranking pass.$r$,
    $r$Builds suggestion data offline from query logs (batch aggregation of counts), not synchronously on the read path.$r$,
    $r$Explains the read/write split: reads are enormous and cheap; the trie/top-k is rebuilt periodically with staleness tolerance.$r$,
    $r$Ranks by popularity (+ optional recency/personalization) and selects top-k correctly.$r$,
    $r$Scales: shards the trie by prefix, caches hot prefixes, debounces keystrokes client-side.$r$
  ],
  $sol$APPROACH
Typeahead is a read-dominated prefix lookup where ranking is precomputed. Store
the top-k completions AT each trie node so a keystroke is a cache/lookup, not a
ranking computation, and rebuild the structure offline from query logs.

1) REQUIREMENTS
- prefix -> top-k popular completions; <100ms/keystroke; tracks popularity (+ some
  recency). Scale: 10B searches/day feeding it.

2) DATA STRUCTURE (the crux)
- Trie keyed by prefix. At each node, PRECOMPUTE and store the top-k completions
  (with scores). A query walks to the prefix node and returns its stored top-k --
  no on-the-fly aggregation.

3) READ PATH (<100ms)
- Reads dwarf writes, so they must be trivial: serve top-k from an in-memory/edge
  cache keyed by prefix. Debounce keystrokes client-side; cache hot prefixes hard.

4) BUILD PATH (offline)
- Aggregate query counts from logs in batch (Spark/MapReduce) over a window,
  compute top-k per prefix, publish a new trie/snapshot periodically. Counting is
  NOT on the read path. Minutes/hours of staleness is fine for popularity.

5) RANKING
- Popularity (windowed counts) primarily; optional recency decay for trending +
  light locale/personalization as a re-rank; filter unsafe suggestions.

6) SCALE
- Shard the trie by leading characters; replicate hot shards. The snapshot is
  immutable + cache-friendly; swap atomically on rebuild.

7) WHAT INTERVIEWERS PROBE
- Precomputed top-k at trie nodes (not query-time ranking); the read/write split;
  offline log aggregation; staleness tolerance; sharding + caching + debounce.$sol$,
  40,
  array['trie', 'caching', 'autocomplete']
),
(
  'ticketing-system',
  'system_design',
  'core',
  'Concert Ticketing (Seat Locking)',
  $$Design a concert/event ticket booking system (like Ticketmaster) where many
users compete for limited seats.

**Scale:** a hot event with 100K seats and 1M users hitting "buy" the moment it
goes on sale. No seat may be double-sold, and a held seat is released if payment
doesn't complete in time.

**Functional requirements:**
- Browse available seats.
- Hold a seat while paying.
- Confirm the purchase.
- Release holds that expire.

Cover: how you prevent double-selling a seat under massive concurrency, the
hold/reservation lifecycle, and how you handle the on-sale thundering herd.$$,
  array[
    $r$Prevents double-selling with a concurrency-safe seat transition (row lock / conditional update available -> held), not a read-then-write.$r$,
    $r$Models the seat lifecycle available -> held(expiry) -> booked and releases expired holds (TTL + sweeper or lazy check).$r$,
    $r$Handles the on-sale herd with a waiting room / virtual queue admitting users at a controlled rate instead of 1M concurrent holds.$r$,
    $r$Makes payment idempotent and only marks a seat booked on payment success, with the hold protecting it meanwhile.$r$,
    $r$Chooses strong consistency for inventory (no oversell) vs an eventually-consistent/cached browse view.$r$,
    $r$Considers fairness (queue order) and abuse (one hold per user, bot mitigation).$r$
  ],
  $sol$APPROACH
The core is a concurrency-safe seat state machine (available -> held -> booked)
with atomic transitions so a seat is never double-sold, a time-boxed hold, and a
waiting room to tame the on-sale herd.

1) REQUIREMENTS
- Browse; hold while paying; confirm; auto-release expired holds; NEVER
  double-sell. Scale: 100K seats, 1M concurrent buyers.

2) SEAT LIFECYCLE (the crux)
- States: available -> held(user, expires_at) -> booked. available->held MUST be
  atomic: "UPDATE seat SET status=held, holder=U WHERE seat_id=S AND
  status=available" -- 0 rows affected means someone beat you; return "taken".
  Read-then-write races oversell.

3) HOLD EXPIRY
- Hold has a TTL (e.g. 5 min). Release via TTL + sweeper, or lazily (if expires_at
  < now, treat as available). Payment success: held -> booked; timeout: held ->
  available.

4) CONSISTENCY WHERE IT COUNTS
- Seat inventory is strongly consistent (a transactional store / per-seat atomic
  op) -- no oversell. The browse/map view can be eventually consistent + cached;
  showing a seat as free a beat after it's held is fine because the atomic hold is
  the real gate.

5) THUNDERING HERD
- A waiting room / virtual queue admits users into the buy flow at a controlled
  rate, so the seat store sees a manageable rate, not 1M simultaneous holds. Gives
  fairness (queue order) too.

6) PAYMENT + IDEMPOTENCY
- Payment is idempotent (idempotency key) so retries don't double-charge; the seat
  flips to booked only on confirmed payment; failure releases the hold.

7) ABUSE
- One active hold per user per event; bot detection / rate limits at the waiting
  room.

8) WHAT INTERVIEWERS PROBE
- The atomic available->held transition (why read-then-write oversells); hold TTL +
  release; strong vs eventual consistency per component; the waiting-room; idempotent
  payment.$sol$,
  45,
  array['concurrency', 'locking', 'inventory']
),
(
  'chat-system',
  'system_design',
  'advanced',
  'Real-Time Chat / Messaging',
  $$Design a real-time 1:1 and group chat system (like WhatsApp/Messenger).

**Scale:** 1B users, 50B messages/day, users are frequently offline, messages
must not be lost and must arrive in order per conversation.

**Functional requirements:**
- Send/receive messages in real time.
- Deliver to offline users when they reconnect (no loss).
- Per-conversation ordering.
- Delivery/read receipts and group chats.

Cover: the connection layer for real-time delivery, how offline delivery and
ordering work, and how you store messages at this scale.$$,
  array[
    $r$Describes a persistent-connection layer (WebSocket) with a gateway mapping user -> connection, and how a message routes to the recipient's gateway.$r$,
    $r$Handles offline users: messages persist to a per-user inbox and sync on reconnect (from last-seen seq), so nothing is lost.$r$,
    $r$Guarantees per-conversation ordering via sequence numbers and client-side de-dupe/reorder.$r$,
    $r$Chooses a store for 50B msgs/day (wide-column, partitioned by conversation, clustered by time/seq) and names the partition key.$r$,
    $r$Handles group fan-out (write to each inbox for small groups, fan-out on read for large) and receipts as separate lightweight signals.$r$,
    $r$Addresses connection scale (millions of concurrent sockets across gateways) and inter-gateway routing (registry / pub-sub).$r$
  ],
  $sol$APPROACH
Chat is a persistent-connection delivery layer over a durable per-conversation
message log. Online users get pushed over their socket; offline users get a
persisted inbox synced on reconnect; ordering comes from per-conversation
sequence numbers.

1) REQUIREMENTS
- Real-time 1:1 + group; offline delivery (no loss); per-conversation ordering;
  receipts. Scale: 1B users, 50B msgs/day, frequent offline.

2) CONNECTION LAYER
- Clients hold a WebSocket to a gateway. A registry maps user_id -> {gateway,
  connection}. To deliver, find the recipient's gateway and push; gateways reach
  each other via pub/sub or routing keyed by user_id.

3) SEND PATH
- Client -> gateway -> chat service that (a) assigns a per-conversation seq, (b)
  persists the message, (c) pushes to online recipients, (d) writes to offline
  recipients' inboxes. Ack the sender.

4) OFFLINE + ORDERING (the crux)
- Persist every message + a per-user inbox. On reconnect, the client sends its
  last-seen seq per conversation and pulls the missed tail -- nothing lost.
  Per-conversation sequence numbers give strict order; the client de-dupes and
  orders by seq (pushes can arrive out of order).

5) STORAGE (50B/day)
- Wide-column store (Cassandra/HBase) partitioned by conversation_id, clustered by
  seq/time, so "recent messages in a conversation" is one partition range scan.
  Recent messages cached.

6) GROUP CHAT
- Small groups: fan-out write to each member's inbox. Very large groups: fan-out on
  read (members pull from the conversation log) to avoid write amplification.

7) RECEIPTS + PRESENCE
- Delivery/read receipts are small separate signals; presence is ephemeral,
  high-churn, kept in a fast store, not the durable log.

8) WHAT INTERVIEWERS PROBE
- Socket gateway + user->connection registry + inter-gateway routing; offline inbox
  + reconnect sync; per-conversation seq ordering; partitioning at 50B/day; group
  fan-out trade-off.$sol$,
  60,
  array['websockets', 'messaging', 'fan-out']
),
(
  'distributed-cache',
  'system_design',
  'advanced',
  'Distributed In-Memory Cache',
  $$Design a distributed in-memory cache (like Redis/Memcached as a service) used
by many application servers.

**Scale:** TBs of cached data across a cluster, millions of ops/s, must survive
a node loss without a full cache wipe.

**Functional requirements:**
- get/set/delete by key with TTL.
- Scale beyond one node's memory.
- Tolerate node failures.
- Keep data reasonably balanced across nodes.

Cover: how keys are distributed across nodes, what happens when a node is
added/removed, and the eviction + consistency behavior.$$,
  array[
    $r$Distributes keys with consistent hashing and explains why hash(key) % N reshuffles almost everything when N changes.$r$,
    $r$Explains consistent hashing + virtual nodes for balance and minimal key movement on add/remove.$r$,
    $r$Handles node failure with replication (primary + replica) so a loss doesn't wipe those keys, and how reads/writes fail over.$r$,
    $r$Covers eviction (LRU/LFU) + TTL expiry and the memory-vs-hit-rate consideration.$r$,
    $r$Addresses consistency: best-effort/eventual, replication lag, and cache-aside vs write-through with the app (+ invalidation).$r$,
    $r$Considers hot keys (one key swamping a node) and mitigation (replicate hot keys / client-side cache / coalescing).$r$
  ],
  $sol$APPROACH
A distributed cache is a partitioned in-memory KV store. The core decisions are
key distribution (consistent hashing), surviving node loss (replication), and
eviction/consistency behavior.

1) REQUIREMENTS
- get/set/delete + TTL; scale past one node's RAM; tolerate node loss without a
  full wipe; balanced load. Scale: TBs, millions ops/s.

2) KEY DISTRIBUTION (the crux)
- Consistent hashing: hash keys AND nodes onto a ring; a key belongs to the next
  node clockwise. hash(key) % N remaps almost every key when N changes (adding one
  node reshuffles the whole cache -> stampede). The ring moves only ~1/N keys on
  add/remove. Virtual nodes give even load + smooth rebalancing.

3) NODE FAILURE
- Replicate each partition to 1+ replicas so losing a node doesn't lose its keys;
  reads/writes fail over to the replica while the ring re-forms. Without
  replication a node loss is a partial cache wipe -> DB stampede.

4) EVICTION + TTL
- Per-node LRU/LFU eviction when full, plus TTL expiry (lazy on access + periodic
  sweep). Sizing is memory vs hit-rate.

5) CONSISTENCY
- Best-effort/eventual. With the app, choose cache-aside (read cache, on miss load
  DB + populate) vs write-through/write-back; discuss replication lag + stale
  reads; invalidate on write.

6) HOT KEYS
- One hot key can swamp its node: replicate it across nodes, client-side/local
  cache, or request coalescing.

7) WHAT INTERVIEWERS PROBE
- Why consistent hashing (vs mod-N reshuffle) + virtual nodes; replication for
  node-loss survival; eviction/TTL; cache-aside vs write-through + invalidation;
  hot-key mitigation.$sol$,
  60,
  array['consistent hashing', 'caching', 'replication']
),
(
  'object-storage',
  'system_design',
  'advanced',
  'Object / Blob Storage (S3-like)',
  $$Design a large-scale object/blob storage service (like Amazon S3).

**Scale:** exabytes of data, trillions of objects, 99.999999999% (11 nines)
durability, objects ranging from bytes to terabytes.

**Functional requirements:**
- PUT/GET/DELETE objects by key within buckets.
- High durability.
- Handle very large objects.
- List objects in a bucket.

Cover: how objects are stored durably across machines, the metadata-vs-data
separation, and how you handle very large objects and durability.$$,
  array[
    $r$Separates METADATA (key -> location/size) from DATA (bytes on storage nodes); metadata in a scalable indexed store, data on many nodes.$r$,
    $r$Achieves durability via replication or erasure coding across independent failure domains, and explains erasure coding's storage efficiency vs replication.$r$,
    $r$Handles large objects via chunking / multipart upload (split, upload parts in parallel, assemble).$r$,
    $r$Explains the write path (allocate placement, write shards, commit metadata) and read path (metadata lookup -> fetch/reconstruct chunks).$r$,
    $r$Covers durability operations: background scrubbing/repair to detect and re-replicate lost shards over time.$r$,
    $r$Handles listing (prefix scan over the metadata index) and metadata consistency.$r$
  ],
  $sol$APPROACH
Object storage splits METADATA (key -> where the bytes live) from DATA (bytes
spread across many storage nodes), gets durability from erasure coding across
failure domains, and handles huge objects by chunking.

1) REQUIREMENTS
- PUT/GET/DELETE by key in buckets; list; 11 nines durability; objects bytes->TB.
  Scale: exabytes, trillions of objects.

2) METADATA vs DATA (the crux)
- Metadata service: bucket/key -> {chunk locations, size, version, checksum}, in a
  scalable indexed store (sharded KV / distributed DB) for trillions of keys.
- Data plane: storage nodes hold immutable chunks. Separating them lets each scale
  independently.

3) LARGE OBJECTS
- Multipart upload: split into parts, upload in parallel, then commit an assembled
  manifest. A TB object is many chunks; failed parts retry independently.

4) DURABILITY (11 nines)
- Erasure coding (Reed-Solomon: k data + m parity shards) across independent
  failure domains (racks/AZs): survives m losses at ~1.5x storage vs 3x for triple
  replication. Replication is simpler but costlier; erasure coding wins at exabyte
  scale.

5) WRITE / READ PATH
- PUT: auth -> allocate placements -> write data+parity shards -> on quorum commit
  metadata (the commit is the durability point). GET: metadata lookup -> fetch
  chunks/shards (reconstruct from parity if one is missing) -> stream.

6) DURABILITY OPS
- Background scrubbing verifies checksums, detects lost/corrupt shards, and
  re-encodes/re-replicates to hold the target. Durability is maintained
  continuously.

7) LISTING + CONSISTENCY
- List = prefix scan over the sorted metadata index. Discuss read-after-write
  consistency for new objects.

8) WHAT INTERVIEWERS PROBE
- Metadata/data separation; erasure coding vs replication + failure domains;
  multipart/chunking; commit-on-metadata write path; scrubbing/repair; listing via
  the metadata index.$sol$,
  60,
  array['erasure coding', 'storage', 'durability']
),
(
  'web-crawler',
  'system_design',
  'advanced',
  'Web Crawler',
  $$Design a web crawler that fetches and processes billions of pages (to build a
search index).

**Scale:** crawl 1B+ pages, be polite to sites (rate limits, robots.txt), avoid
re-crawling duplicates, and refresh pages over time.

**Functional requirements:**
- Fetch pages from seed URLs and extract links to crawl next.
- Store page content.
- Respect robots.txt and politeness.
- Avoid duplicate and near-duplicate content.

Cover: the crawl frontier (what to crawl next), how you stay polite and avoid
traps, and how you deduplicate and handle scale.$$,
  array[
    $r$Describes the crawl frontier: a prioritized queue of URLs to fetch, organized so the crawler knows what is next.$r$,
    $r$Enforces politeness: per-domain rate limiting/delays and robots.txt compliance, usually via per-host queues.$r$,
    $r$Deduplicates URLs (a seen-set, e.g. a Bloom filter over normalized URLs) and near-duplicate CONTENT (checksums/simhash).$r$,
    $r$Handles crawler traps / infinite spaces (depth limits, pattern filters, calendar loops) and non-HTML content.$r$,
    $r$Scales horizontally: many fetchers, frontier + seen-set sharded by domain, a content store.$r$,
    $r$Handles re-crawl/freshness: pages re-queued over time by change frequency, not crawled once forever.$r$
  ],
  $sol$APPROACH
A crawler is a big loop over a prioritized frontier of URLs, fetching politely,
extracting links, and deduping both URLs and content -- sharded by domain to stay
polite and scale.

1) REQUIREMENTS
- Fetch from seeds, extract + enqueue links, store content, respect robots.txt +
  politeness, dedupe, re-crawl. Scale: 1B+ pages.

2) FRONTIER (the crux)
- The set of URLs to crawl next: a prioritized queue (by importance / freshness
  need), organized as PER-HOST queues so politeness is natural and one busy domain
  can't starve others. A scheduler picks the next URL respecting per-host delays.

3) POLITENESS
- Fetch + cache robots.txt per host and obey it; enforce a per-domain crawl delay /
  rate limit; identify via User-Agent. This keeps you from being blocked / DDoSing
  a site.

4) DEDUP (URLs + content)
- Normalize/canonicalize URLs, then check a seen-set -- a Bloom filter over 1B+
  urls is memory-efficient (tiny false-positive rate). For CONTENT, hash the page
  (+ simhash/minhash for near-duplicates) so mirrors aren't reprocessed.

5) TRAPS
- Depth limits, max URLs per host, pattern filters, detecting infinite spaces
  (calendars, session-id loops). Skip/handle non-HTML by content type.

6) SCALE / PIPELINE
- Seed -> frontier -> fetchers (many, sharded by host) -> parser (extract links +
  content) -> dedup -> content store (+ enqueue new links). Shard frontier +
  seen-set by domain hash.

7) FRESHNESS
- Re-queue pages on a schedule tied to observed change frequency (news often,
  static rarely) -- adaptive re-crawl, not crawl-once.

8) WHAT INTERVIEWERS PROBE
- Frontier prioritization + per-host queues; robots.txt + politeness; Bloom-filter
  URL dedup + content simhash; crawler traps; sharding; adaptive re-crawl.$sol$,
  60,
  array['crawling', 'bloom filter', 'politeness']
),
(
  'payment-ledger',
  'system_design',
  'advanced',
  'Payment System / Double-Entry Ledger',
  $$Design a payment system / ledger that moves money between accounts (like a
wallet or payments backend).

**Scale:** millions of transactions/day, correctness is paramount (no lost or
double-applied money), integrates with external payment processors.

**Functional requirements:**
- Transfer funds between accounts.
- Record an auditable history.
- Never double-charge and never create/lose money.
- Handle processor failures/timeouts.

Cover: how you guarantee correctness (idempotency, atomicity), the ledger data
model, and how you handle unreliable external processors.$$,
  array[
    $r$Uses a double-entry ledger: balanced debits and credits per transaction, so money is conserved and the history is auditable (immutable entries).$r$,
    $r$Guarantees atomicity of a transfer (debit + credit commit together) so you never debit without crediting.$r$,
    $r$Ensures idempotency: each payment carries an idempotency key so a retry/duplicate applies exactly once (no double-charge).$r$,
    $r$Handles the ambiguous processor timeout via idempotency keys to the processor + reconciliation, not a blind retry.$r$,
    $r$Models transaction states (pending -> settled/failed) and reconciliation against processor records.$r$,
    $r$Treats entries as immutable/append-only (corrections are reversing entries) and uses strong consistency for balances.$r$
  ],
  $sol$APPROACH
A payments system is a double-entry ledger where correctness beats everything.
Transfers are atomic balanced entries, made exactly-once via idempotency keys,
and external-processor ambiguity is resolved by idempotency + reconciliation.

1) REQUIREMENTS
- Move funds; auditable history; NO double-charge, no money created/lost; survive
  processor failures/timeouts. Scale: millions txns/day.

2) DOUBLE-ENTRY LEDGER (the crux)
- Every transaction writes balanced entries: debit one account, credit another,
  summing to zero. Money is conserved by construction and fully auditable. Entries
  are IMMUTABLE/append-only; a mistake is a new reversing entry, never an edit.

3) ATOMICITY
- The debit and credit commit together (one transaction / atomic write) -- never
  debit without the matching credit. Balances are strongly consistent, not
  eventual.

4) IDEMPOTENCY (no double-charge)
- Each payment carries a client idempotency key. The first request creates the
  transaction; retries with the same key return the SAME result instead of applying
  again. This makes retries safe.

5) EXTERNAL PROCESSORS (the ambiguous timeout)
- On a processor timeout you don't know if it succeeded. Don't blindly retry --
  pass an idempotency key to the PROCESSOR so their side de-dupes, and/or query
  status before retrying. Reconcile against their records to resolve unknowns.

6) STATES + RECONCILIATION
- Transactions move pending -> settled/failed. A daily reconciliation job compares
  the ledger to processor/bank statements to catch + correct discrepancies; alert
  on any imbalance.

7) WHAT INTERVIEWERS PROBE
- Double-entry + conservation + immutability; atomic debit/credit; idempotency for
  exactly-once; the timeout ambiguity + processor idempotency + reconciliation;
  strong consistency for balances.$sol$,
  60,
  array['ledger', 'idempotency', 'consistency']
),
(
  'spam-detection',
  'ml_system_design',
  'core',
  'Email Spam / Phishing Detection',
  $$Design an ML system to detect spam/phishing emails at an email provider.

**Scale:** billions of emails/day, sub-second scoring before delivery,
adversaries who adapt to evade the filter, and a very low tolerance for false
positives (blocking a real email is bad).

**Functional requirements:**
- Classify each incoming email as spam vs ham and route (spam folder / block).
- Adapt to new spam campaigns.
- Keep false positives low.

Cover: the features + model, how you handle adversarial adaptation, and the
false-positive vs false-negative trade-off.$$,
  array[
    $r$Frames as binary classification with features from content, sender reputation, headers/metadata, and links/attachments.$r$,
    $r$Weighs the FP vs FN trade-off explicitly: a false positive is very costly, so the block threshold favors precision; uncertain -> spam folder, not block.$r$,
    $r$Handles adversarial adaptation via continuous/online retraining and fast-reacting signals (sender reputation, URL blocklists), not a static model.$r$,
    $r$Uses label sources (user report spam/not-spam, honeypots, known-spam feeds) and acknowledges label noise/delay.$r$,
    $r$Addresses scale/latency: cheap features + a fast model inline, heavier analysis async, cached sender reputation.$r$,
    $r$Considers evaluation (precision at the block threshold) and drift monitoring as campaigns change.$r$
  ],
  $sol$APPROACH
Spam detection is adversarial binary classification in the delivery path, where a
false positive (blocking real mail) is the expensive error. Content + sender +
link features feed a fast model; continuous retraining tracks evolving spam.

1) REQUIREMENTS & OBJECTIVE
- Classify spam vs ham, route/block; adapt to new campaigns; keep FALSE POSITIVES
  very low. Scale: billions/day, sub-second, adversarial.

2) FEATURES
- Content: tokens/embeddings of subject+body. Sender: reputation, SPF/DKIM/DMARC
  auth, sending history. Metadata: headers, geo, volume. Links/attachments: URL
  reputation/blocklists, attachment types. Sender reputation is often the strongest
  single signal.

3) MODEL
- A gradient-boosted / logistic baseline on these features is strong and fast; add
  a text embedding model for content. Fast enough to score inline.

4) FP vs FN (the crux)
- A false positive (real email blocked) is far costlier than a false negative (spam
  slips through). So the BLOCK threshold favors precision; the ambiguous middle goes
  to the SPAM FOLDER (recoverable), not a hard block. Tune to that asymmetric cost.

5) ADVERSARIAL ADAPTATION
- Spammers evolve, so the model can't be static: continuous/frequent retraining +
  fast-reacting signals (sender reputation, near-real-time URL blocklists). Monitor
  drift as new campaigns appear.

6) LABELS
- User "report spam"/"not spam", honeypot addresses, known-spam feeds.
  Acknowledge label noise + delay; weight trusted sources.

7) SCALE / LATENCY
- Cheap features + fast model inline before delivery; heavier/async analysis
  (attachment sandboxing) off the hot path; cache sender reputation.

8) WHAT INTERVIEWERS PROBE
- Feature sources (esp. sender reputation); asymmetric FP/FN cost + spam-folder
  middle band; adversarial drift -> continuous retraining; label sources + noise;
  precision at the block threshold.$sol$,
  45,
  array['classification', 'adversarial', 'precision-recall']
),
(
  'content-moderation',
  'ml_system_design',
  'core',
  'Content Moderation Classifier',
  $$Design an ML system to moderate user-generated content (text and images) for
policy violations (hate, violence, nudity, etc.) on a large platform.

**Scale:** 1M+ posts/minute, decisions must be fast, low tolerance for both
missing violations and wrongly removing benign content, and policies evolve.

**Functional requirements:**
- Classify content against multiple policy categories.
- Auto-remove clear violations; send borderline cases to human review.
- Support both text and images.

Cover: the model approach for multi-category classification, the automation vs
human-review split, and how you handle evolving policies and appeals.$$,
  array[
    $r$Frames as multi-label classification across policy categories, for both text (transformer/embedding) and images (vision model).$r$,
    $r$Uses a confidence-thresholded split: high-confidence violations auto-removed, borderline routed to human reviewers (humans in the loop).$r$,
    $r$Balances the two error costs with per-category thresholds (some categories err toward removal, others toward keeping).$r$,
    $r$Uses human-review decisions as training labels (a feedback loop) and retrains/relabels as policies evolve.$r$,
    $r$Addresses scale/latency (fast inline screening + heavier async) and human-queue prioritization (severity, virality).$r$,
    $r$Considers appeals/false-removal recourse and adversarial evasion (obfuscated text, altered images).$r$
  ],
  $sol$APPROACH
Content moderation is multi-label classification over policy categories for text
AND images, with a confidence-based split between automation and human review.
Human decisions feed the training loop; thresholds encode per-category cost.

1) REQUIREMENTS & OBJECTIVE
- Classify against multiple categories; auto-remove clear violations, route
  borderline to humans; text + images; evolving policies. Scale: 1M+ posts/min.

2) MODELS (multi-modal, multi-label)
- Text: transformer/embedding classifier with a head per category (multi-label --
  a post can violate several). Images: a vision model (CNN/ViT). Often separate
  per-modality models fused into one decision.

3) AUTOMATION vs HUMAN REVIEW (the crux)
- Threshold on confidence: high-confidence violations auto-remove; a clearly-benign
  band auto-approve; the uncertain middle goes to HUMAN reviewers. Don't auto-act
  on low confidence -- humans in the loop for the hard cases.

4) ASYMMETRIC, PER-CATEGORY COST
- Missing a violation vs removing benign content have different costs, varying by
  category (child-safety -> err toward removal; satire/news -> err toward keeping).
  Set per-category thresholds, not one global cutoff.

5) LABELS + EVOLVING POLICY
- Human-review outcomes are the training labels -- a feedback loop. On policy
  change, relabel/retrain; models must track policy. Version policies + models
  together.

6) SCALE / LATENCY + QUEUE
- Fast inline screening at ingestion; heavier analysis async. Prioritize the human
  queue by severity + virality (a fast-spreading borderline post first).

7) ADVERSARIAL + APPEALS
- Handle obfuscation (leetspeak, altered images) via robust features/augmentation;
  an appeals path makes false removals recoverable (and feeds appeals back as
  labels).

8) WHAT INTERVIEWERS PROBE
- Multi-label multi-modal models; confidence-thresholded auto vs human split;
  per-category asymmetric costs; human decisions as the label loop + policy drift;
  queue prioritization; adversarial evasion + appeals.$sol$,
  45,
  array['multi-label', 'human-in-the-loop', 'multimodal']
),
(
  'eta-prediction',
  'ml_system_design',
  'advanced',
  'ETA / Travel-Time Prediction',
  $$Design an ML system to predict ETA / travel time for trips (like a rideshare
or maps app).

**Scale:** millions of ETA requests/s, predictions must be accurate and fast
(<100ms), and conditions change in real time (traffic, weather, incidents).

**Functional requirements:**
- Given origin, destination (and route), predict travel time.
- Reflect current traffic.
- Update as conditions change.

Cover: the features (especially real-time signals), the modeling approach over a
road network, and how you keep predictions fresh and evaluate them.$$,
  array[
    $r$Frames as regression and decomposes route ETA into road segments, summing predicted segment times (plus turns/intersections).$r$,
    $r$Uses real-time features (current segment speed, live incidents, weather) alongside static/historical (road type, speed limit, speed by time-of-day/day-of-week).$r$,
    $r$Chooses a modeling approach (per-segment speed via GBM or a graph/sequence model over the road network) + route aggregation, and justifies it.$r$,
    $r$Keeps predictions fresh via streaming live GPS/probe data updating segment speeds continuously, not historical averages.$r$,
    $r$Evaluates with MAE/MAPE on actual vs predicted and monitors systematic bias online.$r$,
    $r$Addresses <100ms latency via precomputed/cached segment speeds + fast route aggregation, not heavy per-request full-graph inference.$r$
  ],
  $sol$APPROACH
ETA is travel-time regression over a road network: predict per-segment times from
live + historical speed and sum along the route. The freshness of real-time
segment speeds matters as much as the model.

1) REQUIREMENTS & OBJECTIVE
- Predict travel time for origin->destination/route; reflect current traffic;
  update live. Scale: millions req/s, <100ms, changing conditions.

2) DECOMPOSITION (the crux)
- Break the route into road SEGMENTS; predict each segment's time and sum, adding
  turn/intersection/signal costs. Predicting per-segment speed and aggregating is
  more tractable + reusable than one model per whole trip.

3) FEATURES
- Real-time: current speed/flow per segment (live GPS/probe data), incidents,
  weather. Static/historical: road type, speed limit, historical speed by
  time-of-day + day-of-week, typical congestion.

4) MODEL
- Per-segment speed via gradient-boosted trees or a graph model (GNN over the road
  graph, capturing correlation between adjacent segments), then route aggregation.
  Justify by the spatial structure of traffic.

5) FRESHNESS (why it's real-time)
- Stream live probe/GPS data to continuously update current segment speeds in a
  fast store; ETAs read these, reflecting NOW, not a historical average. Stale
  segment speeds are the main failure mode.

6) LATENCY (<100ms)
- Precompute/cache current segment speeds; a request looks up its route's segments
  and aggregates -- no heavy per-request full-graph inference. Heavy learning is
  offline/streaming; serving is a fast sum.

7) EVALUATION
- MAE / MAPE of predicted vs actual; monitor systematic bias (consistent
  under/over-estimation) online, per region/time.

8) WHAT INTERVIEWERS PROBE
- Segment decomposition + aggregation; real-time vs historical features; a
  graph/GBM choice + why; streaming freshness; MAE/MAPE + bias; the latency-driven
  precompute.$sol$,
  60,
  array['regression', 'graph', 'real-time features']
),
(
  'semantic-search',
  'ml_system_design',
  'advanced',
  'Semantic Search / Embedding Retrieval',
  $$Design a semantic search platform: retrieve relevant documents for a query by
meaning, not just keywords, over a large corpus (e.g. enterprise docs or a
product catalog).

**Scale:** 100M+ documents, low-latency retrieval (<100ms), and queries/documents
where exact-keyword matching misses relevant results.

**Functional requirements:**
- Given a query, return the most relevant documents by semantic similarity.
- Support fresh documents (adds/updates/deletes).
- Combine with keyword relevance.

Cover: the embedding + retrieval approach, how you serve nearest-neighbor search
at scale, and how you keep the index fresh and evaluate relevance.$$,
  array[
    $r$Uses embeddings: encode queries and documents into a shared vector space so similarity = vector distance (meaning beyond keywords).$r$,
    $r$Serves retrieval with approximate nearest neighbor (HNSW/IVF, FAISS/ScaNN) and explains the recall-vs-latency trade-off vs exact search.$r$,
    $r$Combines semantic with lexical/keyword (BM25) in a hybrid, since exact terms (names, codes) still matter.$r$,
    $r$Handles index freshness: embedding + upserting new/updated docs and removing deleted, and the re-embedding cost at 100M scale.$r$,
    $r$Adds a reranking stage (cross-encoder) on ANN candidates for precision, distinguishing cheap retrieval from expensive rerank.$r$,
    $r$Evaluates relevance (recall@k, NDCG, click metrics) and addresses embedding model choice / domain fine-tuning.$r$
  ],
  $sol$APPROACH
Semantic search embeds queries and documents into one vector space and retrieves
by nearest-neighbor, served with ANN at scale, fused with keyword search, and
optionally reranked for precision.

1) REQUIREMENTS & OBJECTIVE
- Return docs relevant by MEANING, not just keywords; support fresh docs; combine
  with keyword relevance. Scale: 100M+ docs, <100ms.

2) EMBEDDINGS (the crux)
- Encode queries + documents with an embedding model into a shared space, so
  semantic similarity = vector distance (cosine). Captures synonyms/paraphrase that
  keyword match misses. Choose/fine-tune the model on the domain.

3) ANN RETRIEVAL AT SCALE
- Exact nearest neighbor over 100M vectors is too slow; use ANN (HNSW graph or
  IVF/PQ) via FAISS/ScaNN. Explain the recall-vs-latency trade-off: ANN trades a
  little recall for big speed, tuned by index params.

4) HYBRID (semantic + lexical)
- Combine embedding retrieval with BM25/keyword. Exact tokens (product names, error
  codes, IDs) still matter and pure embeddings underperform there, so fuse both
  candidate sets (weighted / reciprocal-rank fusion).

5) RERANK (precision)
- Optionally rerank the fused top-N with a cross-encoder (query attends to each
  doc) for a high-precision top-k. Cheap ANN retrieval -> expensive rerank on a
  small set.

6) FRESHNESS
- On add/update: embed the doc and UPSERT its vector; on delete, remove it.
  Re-embedding at 100M scale is a real cost -- do it incrementally on change, and
  re-embed everything only when the model changes.

7) EVALUATION
- Recall@k / NDCG on labeled query-doc pairs + click-based online metrics. Monitor
  embedding drift when the model or corpus shifts.

8) WHAT INTERVIEWERS PROBE
- Shared-space embeddings; ANN + recall/latency trade-off; WHY hybrid over
  semantic-only; incremental re-embedding/freshness cost; the rerank stage;
  recall@k/NDCG evaluation.$sol$,
  60,
  array['embeddings', 'ann search', 'hybrid retrieval']
)
on conflict (slug) do nothing;
