-- REVIEW DRAFT ONLY — intentionally outside supabase/migrations.
-- Claude owns review and landing as 0028_design_drill_solutions_backfill.sql.

-- Original-bank drills not covered by the three 0027 exemplars ----------------

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A home timeline is a **merge problem**. Push ordinary authors into precomputed follower feeds, pull celebrity posts at read time, and merge the two streams by cursor. The hybrid prevents a single celebrity post from becoming 100M writes.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','requirements','heading','Requirements','body',$md$- Recent posts from followees appear within seconds and load in **<200 ms**.
- Support post, follow, unfollow, ranking, edits, and deletes.
- Design for 300M DAU, about 200 followees per user, and celebrity accounts with 100M+ followers.$md$),
    jsonb_build_object('id','fanout','heading','Push, pull, and the hybrid','body',$md$**Fan-out on write** appends a new post id to every follower's feed cache. Reads are cheap, but write amplification follows the author's audience.

**Fan-out on read** stores posts by author and merges followees at request time. Writes are cheap, but normal reads become expensive.

Use a **hybrid**: push normal authors; mark high-follower accounts as celebrities and pull their recent posts during reads. This caps write amplification while preserving fast reads for the common case.$md$),
    jsonb_build_object('id','read-path','heading','Read path and pagination','body',$md$Read the capped Redis feed list, fetch recent posts for celebrity followees, merge by `(created_at, post_id)`, then hydrate bodies from cache/storage and rank.

Use **cursor pagination**, never offsets: incoming posts shift offset boundaries and cause duplicates or omissions.$md$),
    jsonb_build_object('id','consistency','heading','Consistency, edits, and deletes','body',$md$Feed caches contain ids, not copied post bodies. Hydration filters deleted posts and reads the latest edit, avoiding millions of cache rewrites. Cap each cached feed to a few hundred entries and rebuild older history on demand.$md$),
    jsonb_build_object('id','tradeoffs','heading','Tradeoffs and probes','body',$md$Be ready to defend the celebrity threshold, push-vs-pull cost, cursor design, cache eviction, and where ranking enters. The key invariant is that celebrity traffic cannot fan out without bound.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Daily active users','value','300M','note','consumer-scale feed'),
    jsonb_build_object('label','Typical followees','value','~200','note','merge fan-in per user'),
    jsonb_build_object('label','Feed latency','value','<200 ms','note','cached hybrid read path'),
    jsonb_build_object('label','Celebrity audience','value','100M+','note','reason to pull instead of push')
  )
) where slug = 'news-feed';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A durable scheduler provides **at-least-once execution**, then makes duplicates harmless through idempotency. Workers atomically lease due jobs; expired leases make crash recovery automatic.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','semantics','heading','Delivery semantics','body',$md$Literal exactly-once execution is not available across process and network failures. Promise **at-least-once delivery** and require each job to carry an idempotency key so repeating completed work is a no-op.$md$),
    jsonb_build_object('id','model','heading','Job model','body',$md$Store `id`, `run_at`, cron expression, status, attempts, maximum attempts, payload, lease owner, and lease expiry. Index `(status, run_at)` so finding due work does not scan history.$md$),
    jsonb_build_object('id','claiming','heading','Atomic claiming','body',$md$Claim batches in one transaction with `SELECT ... FOR UPDATE SKIP LOCKED`, then mark them running with a lease. A read followed by an unrelated update races; a queue alone also permits redelivery.$md$),
    jsonb_build_object('id','recovery','heading','Crash recovery and retries','body',$md$If a worker dies, its lease expires and the row becomes claimable. On ordinary failure increment attempts and reschedule with exponential backoff plus jitter. Exhausted jobs enter a dead-letter state and alert operators.$md$),
    jsonb_build_object('id','scale','heading','Scale and clocks','body',$md$Partition jobs by id or time bucket and keep a small due-soon index. Use one authoritative time source or tolerate bounded skew; scheduling correctness cannot assume perfectly synchronized worker clocks.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Job population','value','Millions','note','indexed by status and run time'),
    jsonb_build_object('label','Delivery','value','At least once','note','idempotency supplies effective once-only behavior'),
    jsonb_build_object('label','Claim size','value','Batched','note','SKIP LOCKED reduces contention'),
    jsonb_build_object('label','Retry delay','value','Exponential + jitter','note','protects dependencies')
  )
) where slug = 'job-scheduler';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Collaborative editing needs every replica to **converge without dropping concurrent edits**. Choose OT for a tightly centralized authority or a CRDT for offline, order-independent merging; keep ephemeral presence separate from durable document operations.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','conflicts','heading','Conflict resolution','body',$md$**Operational Transformation** transforms an incoming positional edit against operations the server already accepted. It is compact but hard to implement and normally depends on a central order.

**CRDTs** give content stable identifiers and merge commutatively. They tolerate offline edits naturally but pay metadata cost. Plain last-write-wins is invalid because it discards concurrent work.$md$),
    jsonb_build_object('id','transport','heading','Transport and resync','body',$md$Each editor holds a WebSocket to a collaboration server. The server broadcasts accepted operations. A reconnect sends the last acknowledged sequence/version vector and receives only the missing delta—not the entire document history.$md$),
    jsonb_build_object('id','presence','heading','Presence is a separate path','body',$md$Cursor and selection updates are high-frequency and disposable. Send them over a low-durability channel; losing a cursor for a second is acceptable, while losing a text operation is not.$md$),
    jsonb_build_object('id','persistence','heading','Persistence and partitioning','body',$md$Persist periodic snapshots plus an operation tail. Opening a document loads the snapshot and replays a short log. Route all editors of one document to the same partition, or use pub/sub keyed by document id.$md$),
    jsonb_build_object('id','tradeoffs','heading','Tradeoffs and probes','body',$md$Explain why the chosen OT/CRDT model fits offline requirements, how reconnect avoids full replay, why presence is isolated, and how a hot document keeps one coherent broadcast fan-out.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Concurrent editors','value','~50 / doc','note','shared collaboration partition'),
    jsonb_build_object('label','Propagation','value','<200 ms','note','operation broadcast target'),
    jsonb_build_object('label','Persistence','value','Snapshot + op log','note','bounded replay on open'),
    jsonb_build_object('label','Presence durability','value','Best effort','note','separate from document content')
  )
) where slug = 'collab-editor';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Proximity search maps a radius to a small set of spatial cells, fetches candidates, then applies exact distance. **Moving and static entities belong in different tiers** because one is write-heavy and the other is durable and filter-heavy.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','index','heading','Spatial indexing','body',$md$Geohash is simple and prefix-searchable but needs neighboring cells at boundaries. Quadtrees adapt to density but rebalance under movement. S2/H3 cells provide a practical globe-wide covering. In every case, cover the query circle with cells, fetch candidates, then calculate exact distance.$md$),
    jsonb_build_object('id','moving-static','heading','Moving versus static data','body',$md$Keep moving drivers in Redis GEO or an in-memory cell map updated from pings; tolerate a few seconds of staleness rather than persisting every move. Store restaurants durably with a geospatial index because they change rarely and need rich attributes.$md$),
    jsonb_build_object('id','filters','heading','Filtering and ranking','body',$md$Location produces a candidate set. Apply cuisine, rating, availability, and other attributes afterward, then rank by exact distance and quality. Do not multiply the spatial index by every filter combination.$md$),
    jsonb_build_object('id','scale','heading','Scale and subscriptions','body',$md$Shard by region/cell and split hot cities further. Stream driver updates to the in-memory tier and snapshot periodically. Clients subscribe only to cells within their viewport.$md$),
    jsonb_build_object('id','tradeoffs','heading','Tradeoffs and probes','body',$md$Cover boundary cells, density skew, update cost versus staleness, exact-distance post-filtering, and why moving and static data have different durability needs.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Moving entities','value','5M','note','updated every few seconds'),
    jsonb_build_object('label','Static entities','value','50M','note','durable indexed records'),
    jsonb_build_object('label','Location freshness','value','A few seconds','note','accepted moving-entity staleness'),
    jsonb_build_object('label','Query work','value','Cover cells + candidates','note','never scan the globe')
  )
) where slug = 'proximity-search';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Learning to rank learns **relative ordering** from behavioral logs. A pairwise workhorse such as LambdaMART combines query, item, user, and cross features; position bias must be corrected before clicks become trustworthy labels.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','objective','heading','Objective and model family','body',$md$Pointwise models score each item independently. Pairwise models learn that A should rank above B and are a strong practical default. Listwise methods align directly with NDCG but add complexity. Choose based on the metric and serving budget.$md$),
    jsonb_build_object('id','features','heading','Features','body',$md$Use query intent, item quality/freshness, user history, and especially query-item cross signals such as BM25, historical CTR, and purchase affinity. Cross features usually carry the strongest relevance signal.$md$),
    jsonb_build_object('id','labels','heading','Labels from behavior','body',$md$A clicked or purchased result below a skipped result yields a preference pair. Behavioral labels avoid requiring exhaustive human judgments, but they inherit the policy that produced the page.$md$),
    jsonb_build_object('id','position-bias','heading','Correct position bias','body',$md$Higher positions receive clicks regardless of relevance. Collect randomized/interleaved traffic, estimate examination propensity, and reweight examples by inverse propensity. Merely adding position as a feature does not create unbiased evaluation.$md$),
    jsonb_build_object('id','evaluation','heading','Evaluation','body',$md$Measure NDCG/MAP offline on corrected held-out data, then run an A/B test with conversion, revenue, and latency guardrails. An offline gain is evidence, not the launch decision.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Candidates / query','value','~1,000','note','already retrieved before ranking'),
    jsonb_build_object('label','Primary offline metric','value','NDCG','note','position-sensitive ranking quality'),
    jsonb_build_object('label','Bias correction','value','Inverse propensity','note','from randomized exposure'),
    jsonb_build_object('label','Launch gate','value','A/B test','note','conversion plus guardrails')
  )
) where slug = 'search-ranking';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Feed ranking predicts several outcomes, then combines them in a **product-owned value function**. Long-term quality requires explicit negative signals, diversity constraints, and randomized traffic that exposes feedback loops.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','multi-task','heading','Multi-task model','body',$md$Use a shared representation with heads for click, like, share, comment, dwell, hide, and report. The shared bottom learns common structure and keeps serving simpler than a separate model per action.$md$),
    jsonb_build_object('id','value-model','heading','One ranking score','body',$md$Combine predictions explicitly:

`score = w_click P(click) + w_share P(share) + w_dwell E[dwell] - w_hide P(hide)`

The weights encode what the product values and can change without retraining the base model.$md$),
    jsonb_build_object('id','feedback-loop','heading','Feedback loops and clickbait','body',$md$Training on prior exposure reinforces what the old policy showed. Penalize negative feedback, cap repeated sources/topics, and reserve exploration so new or diverse content can earn evidence.$md$),
    jsonb_build_object('id','detection','heading','Detecting a filter bubble','body',$md$Track topic/source entropy in **served** feeds over time. Maintain a randomized or diversified holdout and compare retention and distribution against the exploit policy. A collapsing served distribution is an observable failure.$md$),
    jsonb_build_object('id','evaluation','heading','Evaluation','body',$md$Offline replay is counterfactual and biased. Use interleaving or randomized controls, then optimize long-term retention with short-term engagement and safety guardrails.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Candidates / load','value','500–2,000','note','ranked by the value model'),
    jsonb_build_object('label','Model outputs','value','Multi-task','note','positive and negative actions'),
    jsonb_build_object('label','Bubble signal','value','Topic/source entropy','note','measured on served inventory'),
    jsonb_build_object('label','Unbiased slice','value','Randomized holdout','note','detects policy feedback')
  )
) where slug = 'feed-ranking-ml';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Fraud scoring is an **asymmetric, delayed-label decision system**. Streamed velocity features feed a fast model; business cost selects allow, review, and block thresholds; maturation-aware training avoids treating recent unknown fraud as legitimate.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','imbalance','heading','Imbalance and metrics','body',$md$At roughly 0.1% fraud, accuracy and ROC-AUC can look excellent while missing costly fraud. Use precision-recall curves and cost-weighted metrics; apply class weights or careful sampling without destroying probability calibration.$md$),
    jsonb_build_object('id','decision','heading','Cost-based decisions','body',$md$A false positive creates friction and lost revenue; a false negative creates direct loss. Pick thresholds from those costs and use three bands: low risk **allow**, uncertain **manual review**, high risk **block**.$md$),
    jsonb_build_object('id','features','heading','Real-time features','body',$md$Maintain rolling card/device/IP counts, amount deviations, and behavioral aggregates in a streaming feature store. Scoring reads precomputed windows; it cannot scan transaction history inside a 100 ms request.$md$),
    jsonb_build_object('id','label-lag','heading','Label maturation','body',$md$Chargebacks arrive weeks later. Exclude or down-weight immature recent negatives, train on matured cohorts, and use reviewer outcomes as a faster but noisier label source.$md$),
    jsonb_build_object('id','adaptation','heading','Adversarial drift','body',$md$Monitor score and feature distributions, retrain regularly, and keep policy/rule fallbacks for active attacks. Fraudsters react to the model, so static validation is insufficient.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Traffic','value','10s of K txn/s','note','streaming decision volume'),
    jsonb_build_object('label','Decision latency','value','<100 ms','note','feature fetch plus inference'),
    jsonb_build_object('label','Fraud prevalence','value','~0.1%','note','precision-recall regime'),
    jsonb_build_object('label','Label delay','value','Weeks','note','chargeback maturation')
  )
) where slug = 'fraud-detection';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Ad CTR prediction turns sparse user/ad/context signals into a **calibrated probability** under a tiny latency budget. Calibration matters because the probability is multiplied directly into a monetary bid.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','features','heading','Sparse features','body',$md$Learn embeddings for important high-cardinality ids and hash the long tail. Cross features capture user-by-category or publisher-by-ad interactions. Fewer hash buckets save memory but increase collisions and lost signal.$md$),
    jsonb_build_object('id','model','heading','Model ladder','body',$md$Start with logistic regression plus crosses: fast and often well calibrated. Add boosted trees for nonlinearities or Wide & Deep/DeepFM/DCN when data justifies learned interactions. Model complexity spends both latency and calibration budget.$md$),
    jsonb_build_object('id','calibration','heading','Calibration is the crux','body',$md$Bidding uses `expected value = P(click) × bid`. A rank-correct but overconfident model overpays. Apply Platt scaling or isotonic regression and monitor predicted-versus-observed CTR by probability bucket.$md$),
    jsonb_build_object('id','freshness','heading','Fresh campaigns','body',$md$Daily batch leaves new campaigns unknown for too long. Use incremental updates or frequent retrains, backed by priors for unseen ids, so early clicks affect predictions quickly.$md$),
    jsonb_build_object('id','serving','heading','Latency budget','body',$md$Co-locate the feature store, cache embeddings, and serve a compact model. Budget feature lookup, inference, and network separately; together they must fit under the model's 10 ms allowance.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Serving volume','value','Millions QPS','note','ad-auction hot path'),
    jsonb_build_object('label','Model budget','value','<10 ms','note','feature fetch plus inference'),
    jsonb_build_object('label','Output','value','Calibrated P(click)','note','multiplied into bids'),
    jsonb_build_object('label','Feature cardinality','value','Thousands+ sparse fields','note','embeddings and hashing')
  )
) where slug = 'ad-ctr-prediction';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A grounded support assistant is a **retrieve → rerank → generate** pipeline with citations and an explicit refusal path. Hybrid retrieval handles both semantics and exact product/error tokens; freshness and faithfulness are release gates.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','ingestion','heading','Ingestion and chunking','body',$md$Chunk documents with enough overlap to preserve context without diluting retrieval precision. Embed each chunk with source, version, and URL metadata. Replacements must remove stale vectors rather than append forever.$md$),
    jsonb_build_object('id','retrieval','heading','Hybrid retrieval','body',$md$Fuse embedding ANN candidates with BM25 candidates. Semantic search handles paraphrase; lexical search catches product names, identifiers, and error codes. Apply metadata access filters before content reaches generation.$md$),
    jsonb_build_object('id','rerank','heading','Precision reranking','body',$md$Run a cross-encoder over the fused top-N and pass only a high-precision top-k to the model. Expensive pairwise attention is affordable on dozens of candidates, not millions of chunks.$md$),
    jsonb_build_object('id','grounding','heading','Generation and refusal','body',$md$Prompt the model to answer only from retrieved passages and cite chunk ids. If retrieval confidence is low, decline or escalate. Free-generating a plausible answer violates the product requirement.$md$),
    jsonb_build_object('id','evaluation','heading','Faithfulness and freshness','body',$md$Measure retrieval recall@k, answer accuracy, and whether every claim is supported by its citations using a human-labeled set plus automated judging. Re-index changed documents incrementally and delete retired vectors.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Corpus','value','~2M docs','note','continuously updated'),
    jsonb_build_object('label','Retrieval','value','Hybrid ANN + BM25','note','semantic and exact-match coverage'),
    jsonb_build_object('label','Rerank fan-in','value','Top-N → top-k','note','cross-encoder precision'),
    jsonb_build_object('label','Failure policy','value','Decline','note','when evidence is insufficient')
  )
) where slug = 'rag-support-assistant';

-- Expansion-bank drills ------------------------------------------------------

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Snowflake IDs pack **time, worker identity, and a per-millisecond sequence** into 64 bits. Every host generates locally; coordination is required only when assigning worker ids, not on the hot path.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','layout','heading','Bit layout','body',$md$A representative layout is `1 sign | 41 timestamp | 10 worker | 12 sequence`. A custom epoch gives about 69 years, 1,024 workers, and 4,096 ids per millisecond per worker. Resize fields from actual fleet and rate constraints.$md$),
    jsonb_build_object('id','generation','heading','Lock-free generation','body',$md$The tuple `(timestamp, worker_id, sequence)` is unique, so hosts mint ids independently. Assign worker ids through configuration, pod identity, or a leased etcd/ZooKeeper slot; assignment must never overlap.$md$),
    jsonb_build_object('id','overflow','heading','Sequence overflow','body',$md$Increment the sequence inside one millisecond. If all 4,096 values are consumed, wait for the next millisecond and reset to zero. Timestamp high bits provide rough ordering and good index locality.$md$),
    jsonb_build_object('id','clock','heading','Clock rollback','body',$md$Persist the last observed timestamp. If NTP moves the clock backward, refuse or wait until wall time catches up; minting in an already-used millisecond risks duplicates.$md$),
    jsonb_build_object('id','alternatives','heading','Alternatives','body',$md$UUIDv4 avoids coordination but is 128-bit and unordered. Database sequences and ticket servers centralize the hot path. Snowflake trades perfect global order for decentralization and compact, roughly ordered ids.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Timestamp field','value','41 bits','note','~69 years from custom epoch'),
    jsonb_build_object('label','Workers','value','1,024','note','10-bit worker id'),
    jsonb_build_object('label','Per-worker rate','value','4,096 ids/ms','note','12-bit sequence'),
    jsonb_build_object('label','Hot-path coordination','value','None','note','worker assignment is out of band')
  )
) where slug = 'unique-id-generator';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Notifications are an **asynchronous, per-channel fan-out pipeline**. Queues absorb bursts, preferences gate delivery before send, and idempotency makes provider retries safe.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','pipeline','heading','Delivery pipeline','body',$md$Producer event → ingestion queue → recipient/channel expansion → template rendering → per-channel queues → APNs/FCM, email, or SMS providers. Producers never block on third-party delivery.$md$),
    jsonb_build_object('id','preferences','heading','Preferences and compliance','body',$md$Resolve opt-outs, quiet hours, category preferences, and legal unsubscribe rules before enqueuing channel work. Templates carry locale and version so retries reproduce the same content.$md$),
    jsonb_build_object('id','idempotency','heading','Idempotency','body',$md$Use one key per `(notification, user, channel)` and record the terminal send result. At-least-once queues may redeliver, but the same logical notification must not double-send.$md$),
    jsonb_build_object('id','providers','heading','Provider limits and failure','body',$md$Apply per-provider rate limits, exponential backoff with jitter, circuit breakers, and dead-lettering. Fail over where a second provider exists, while preserving the same idempotency key.$md$),
    jsonb_build_object('id','bursts','heading','Bursts and priority','body',$md$Let a 10M-recipient blast queue and drain at sustainable provider rates. Autoscale on queue depth and keep transactional notifications in a higher-priority lane than marketing.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Users','value','100M','note','preference and routing population'),
    jsonb_build_object('label','Daily notifications','value','500M','note','~5.8K/s average before channel fan-out'),
    jsonb_build_object('label','Marketing burst','value','10M recipients','note','buffered by queues'),
    jsonb_build_object('label','Delivery guarantee','value','At least once + dedupe','note','provider-safe retries')
  )
) where slug = 'notification-system';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Typeahead is a read-dominated prefix lookup. Put **precomputed top-k completions at every trie node**, publish immutable snapshots from offline query-log aggregation, and make each keystroke a cache lookup.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','trie','heading','Prefix data structure','body',$md$Walk a trie to the prefix node and return the node's stored top-k list. Ranking all descendants at request time cannot meet the keystroke latency target.$md$),
    jsonb_build_object('id','build','heading','Offline build path','body',$md$Aggregate normalized query counts from logs, compute top-k for every prefix, and periodically publish an immutable snapshot. Windowed counts plus recency decay support trending suggestions.$md$),
    jsonb_build_object('id','read','heading','Read path','body',$md$Cache hot prefixes at the edge/in memory and debounce requests in the client. Optional locale or personalization should be a light re-rank of a larger precomputed candidate set.$md$),
    jsonb_build_object('id','scale','heading','Sharding and rollout','body',$md$Shard by leading characters, replicate hot shards, and atomically swap snapshot versions. Moderate staleness is acceptable; partial mixed-version tries are not.$md$),
    jsonb_build_object('id','safety','heading','Quality and safety','body',$md$Normalize spelling variants, suppress sensitive or unsafe queries, and monitor no-result rate, acceptance rate, and latency by prefix popularity.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Training searches','value','10B/day','note','offline popularity source'),
    jsonb_build_object('label','Keystroke latency','value','<100 ms','note','lookup, not ranking'),
    jsonb_build_object('label','Result count','value','Top 5','note','stored per prefix node'),
    jsonb_build_object('label','Freshness','value','Minutes–hours','note','snapshot rebuild tolerance')
  )
) where slug = 'typeahead';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Ticketing correctness lives in an atomic seat state machine: **available → held → booked**. A virtual waiting room controls the herd; strongly consistent holds prevent oversell while the browse map may be stale.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','lifecycle','heading','Seat lifecycle','body',$md$Claim with a conditional update such as `UPDATE ... WHERE status = 'available'`. Zero affected rows means the seat was lost. Never read availability and then write in a separate raceable step.$md$),
    jsonb_build_object('id','expiry','heading','Hold expiry','body',$md$A hold records user and expiry, commonly five minutes. A sweeper and lazy expiry return abandoned seats to available. Payment success transitions the still-valid hold to booked.$md$),
    jsonb_build_object('id','consistency','heading','Consistency boundaries','body',$md$Inventory and state transitions require strong consistency. The seat-map cache can be eventually consistent because the conditional hold remains the source of truth.$md$),
    jsonb_build_object('id','waiting-room','heading','Thundering herd','body',$md$Admit users from a signed, ordered virtual queue at a rate the inventory service can sustain. Add bot controls and limit active holds per user to preserve fairness.$md$),
    jsonb_build_object('id','payment','heading','Payment idempotency','body',$md$Use an idempotency key with both the application and processor. On ambiguous timeouts query processor status before retrying; never charge twice or book after the hold belongs to someone else.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Seats','value','100K','note','strongly consistent inventory'),
    jsonb_build_object('label','Launch demand','value','1M users','note','waiting-room input'),
    jsonb_build_object('label','Hold TTL','value','~5 min','note','payment window'),
    jsonb_build_object('label','Oversell tolerance','value','Zero','note','conditional state transition')
  )
) where slug = 'ticketing-system';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Chat combines a durable conversation log with a large WebSocket gateway fleet. Per-conversation sequence numbers provide ordering; offline inboxes and last-seen cursors guarantee reconnect delivery.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','connections','heading','Connection layer','body',$md$Clients maintain WebSockets to gateways. A registry maps user ids to gateway/connection ids, while inter-gateway pub/sub routes messages to recipients connected elsewhere.$md$),
    jsonb_build_object('id','send','heading','Send path','body',$md$The chat service assigns a conversation sequence, durably appends the message, updates recipient inbox state, pushes online recipients, and then acknowledges the sender. Persistence precedes success.$md$),
    jsonb_build_object('id','offline-order','heading','Offline delivery and ordering','body',$md$On reconnect a client sends last-seen sequence numbers and pulls each missing tail. Pushes may arrive out of order, so clients dedupe by message id and arrange by conversation sequence.$md$),
    jsonb_build_object('id','storage','heading','Storage','body',$md$Use a wide-column store partitioned by conversation id and clustered by sequence/time. Bucket very large conversations to avoid unbounded partitions; cache recent tails.$md$),
    jsonb_build_object('id','groups','heading','Groups and receipts','body',$md$Fan out to member inboxes for small groups; let very large groups read from the shared conversation log. Receipts and presence are lightweight separate signals, not mutations of message bodies.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Users','value','1B','note','connection registry population'),
    jsonb_build_object('label','Messages','value','50B/day','note','~579K/s average'),
    jsonb_build_object('label','Ordering','value','Per conversation','note','monotonic sequence'),
    jsonb_build_object('label','Offline sync','value','From last seen seq','note','bounded reconnect tail')
  )
) where slug = 'chat-system';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A distributed cache partitions keys with **consistent hashing and virtual nodes**, replicates partitions for node-loss survival, and treats staleness and eviction as explicit product tradeoffs.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','hashing','heading','Key distribution','body',$md$Hash keys and virtual nodes onto a ring; a key belongs to the next node clockwise. Unlike `hash(key) % N`, adding a node moves about `1/N` of keys instead of nearly all of them.$md$),
    jsonb_build_object('id','failure','heading','Node failure','body',$md$Replicate each partition across independent nodes. Promote a replica and repair the ring after failure, avoiding a partial-cache wipe and resulting database stampede.$md$),
    jsonb_build_object('id','eviction','heading','Eviction and TTL','body',$md$Use per-node LRU or LFU when memory fills. Expire TTLs lazily on access plus periodic sweeps. Capacity planning trades memory cost against hit rate.$md$),
    jsonb_build_object('id','consistency','heading','Application consistency','body',$md$Cache-aside is simple but can serve stale values; write-through simplifies read freshness but raises write latency. Define invalidation and accept replication lag rather than claiming strong consistency.$md$),
    jsonb_build_object('id','hot-keys','heading','Hot keys','body',$md$A single key can saturate its owner even with balanced partitions. Replicate hot values, add client-local caching, and coalesce concurrent misses.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Capacity','value','TBs','note','cluster memory'),
    jsonb_build_object('label','Throughput','value','Millions ops/s','note','many application servers'),
    jsonb_build_object('label','Rebalance movement','value','~1/N keys','note','consistent hashing'),
    jsonb_build_object('label','Failure survival','value','1+ replicas','note','prevents DB stampede')
  )
) where slug = 'distributed-cache';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Object storage separates a strongly indexed **metadata plane** from an immutable chunk **data plane**. Erasure coding across failure domains and continuous scrubbing turn raw disks into eleven-nines durability.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','planes','heading','Metadata and data planes','body',$md$Metadata maps bucket/key to version, size, checksum, and chunk locations in a sharded ordered store. Storage nodes hold immutable byte chunks. The two planes scale independently.$md$),
    jsonb_build_object('id','multipart','heading','Large objects','body',$md$Multipart upload splits TB-scale objects into independently retryable chunks uploaded in parallel. Completion atomically commits a manifest; abandoned parts are garbage-collected.$md$),
    jsonb_build_object('id','durability','heading','Erasure coding','body',$md$Encode `k` data plus `m` parity shards across racks/AZs. This survives `m` failures with much less overhead than triple replication, at the cost of reconstruction work.$md$),
    jsonb_build_object('id','paths','heading','Write and read paths','body',$md$PUT allocates placements, writes data/parity with checksums, then commits metadata as the visibility point. GET resolves metadata and streams chunks, reconstructing missing shards when necessary.$md$),
    jsonb_build_object('id','operations','heading','Repair and listing','body',$md$Background scrubbing detects corruption and restores redundancy continuously. Listing is a prefix range scan over ordered metadata, with an explicit consistency guarantee for new writes and deletes.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Stored data','value','Exabytes','note','many storage nodes'),
    jsonb_build_object('label','Objects','value','Trillions','note','sharded metadata index'),
    jsonb_build_object('label','Durability','value','11 nines','note','coding plus repair'),
    jsonb_build_object('label','Object size','value','Bytes–TB','note','multipart chunking')
  )
) where slug = 'object-storage';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A crawler is a polite, prioritized loop over a **URL frontier**. Partitioning by host makes rate limits natural; separate URL and content dedup prevent wasted fetching and indexing.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','frontier','heading','Crawl frontier','body',$md$Maintain prioritized per-host queues ordered by importance and freshness. A scheduler chooses eligible hosts while respecting next-fetch time, preventing one large site from starving the corpus.$md$),
    jsonb_build_object('id','politeness','heading','Politeness','body',$md$Fetch and cache `robots.txt`, identify the crawler, and enforce per-domain concurrency and delays. Back off on errors and `Retry-After` rather than treating every URL independently.$md$),
    jsonb_build_object('id','dedup','heading','URL and content dedup','body',$md$Canonicalize URLs and consult a sharded seen set or Bloom filter. Hash fetched content and use SimHash/MinHash for near duplicates so mirrors do not flood the index.$md$),
    jsonb_build_object('id','traps','heading','Crawler traps','body',$md$Limit depth and URLs per host, reject session/calendar patterns, cap redirects and response size, and inspect content type before parsing.$md$),
    jsonb_build_object('id','freshness','heading','Scale and recrawl','body',$md$Shard frontier and seen state by domain, run many fetchers, and store content separately. Requeue pages according to observed change frequency: news quickly, static pages slowly.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Corpus','value','1B+ pages','note','distributed frontier'),
    jsonb_build_object('label','URL seen set','value','Bloom filter','note','memory-efficient with small false positives'),
    jsonb_build_object('label','Politeness','value','Per host','note','rate and concurrency caps'),
    jsonb_build_object('label','Recrawl','value','Adaptive','note','based on change history')
  )
) where slug = 'web-crawler';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Payments require an immutable **double-entry ledger**: every transaction balances debits and credits atomically. Idempotency prevents duplicate application, while reconciliation resolves uncertain external-processor outcomes.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','ledger','heading','Double-entry model','body',$md$Each transfer appends balanced entries whose amounts sum to zero. Ledger entries are immutable; corrections are reversing entries. This preserves an auditable history and makes conservation testable.$md$),
    jsonb_build_object('id','atomicity','heading','Atomicity and balances','body',$md$Commit debit and credit together under strong consistency. Derive balances from entries or maintain a transactionally updated projection; never debit without the matching credit.$md$),
    jsonb_build_object('id','idempotency','heading','Idempotent requests','body',$md$Store a client idempotency key with the transaction and return the original result on retries. A unique constraint and atomic insert prevent concurrent duplicates.$md$),
    jsonb_build_object('id','processors','heading','Ambiguous processor timeouts','body',$md$Forward an idempotency key to the processor and query status after timeout. Blind retries can double-charge when the first response was merely lost.$md$),
    jsonb_build_object('id','reconciliation','heading','States and reconciliation','body',$md$Move operations through pending to settled or failed. Reconcile ledger records against processor/bank statements and alert on any imbalance or unknown state.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Volume','value','Millions txn/day','note','correctness-first workload'),
    jsonb_build_object('label','Ledger invariant','value','Debits + credits = 0','note','per transaction'),
    jsonb_build_object('label','Duplicate tolerance','value','Zero applied twice','note','idempotency key'),
    jsonb_build_object('label','Entries','value','Append-only','note','reversals correct mistakes')
  )
) where slug = 'payment-ledger';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Spam detection is adversarial classification with a costly false-positive error. Fast content, sender, and link signals produce a calibrated score; two thresholds route mail to inbox, recoverable spam, or hard block.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','features','heading','Signals','body',$md$Combine subject/body text, sender reputation, SPF/DKIM/DMARC, sending velocity, headers, URL reputation, and attachment metadata. Sender and campaign-level signals react faster than content alone.$md$),
    jsonb_build_object('id','model','heading','Model and decision bands','body',$md$Serve a fast linear/boosted model plus compact text embeddings. Favor precision at the hard-block threshold; route uncertain messages to the spam folder so users can recover false positives.$md$),
    jsonb_build_object('id','adaptation','heading','Adversarial adaptation','body',$md$Continuously refresh reputation and URL blocklists, retrain frequently, and monitor feature/score drift. Attackers intentionally probe static rules and models.$md$),
    jsonb_build_object('id','labels','heading','Labels','body',$md$Use user spam/not-spam actions, honeypots, and trusted feeds. Model source-specific noise and label delay; appeals and corrected classifications are especially valuable.$md$),
    jsonb_build_object('id','serving','heading','Scale and latency','body',$md$Run cheap screening before delivery and send attachment sandboxing or expensive analysis asynchronously. Cache reputation and share campaign fingerprints across messages.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Traffic','value','Billions emails/day','note','inline delivery gate'),
    jsonb_build_object('label','Latency','value','<1 s','note','before delivery'),
    jsonb_build_object('label','Block objective','value','High precision','note','false positives are costly'),
    jsonb_build_object('label','Uncertain band','value','Spam folder','note','recoverable action')
  )
) where slug = 'spam-detection';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Content moderation is **multi-label, multimodal classification** with per-policy thresholds. High-confidence cases automate, uncertain cases enter a severity-aware human queue, and appeals close the learning loop.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','models','heading','Models','body',$md$Use text transformer/embedding classifiers and image vision models with one output per policy category. A post may violate several categories, so this is multi-label rather than mutually exclusive classification.$md$),
    jsonb_build_object('id','routing','heading','Automation and human review','body',$md$Define approve, review, and remove bands. Auto-remove only high-confidence violations; prioritize the review queue by severity, reach, and virality.$md$),
    jsonb_build_object('id','costs','heading','Per-category error costs','body',$md$Child safety and imminent harm may favor recall, while satire or news demands caution against false removal. Use per-category thresholds instead of one global confidence cutoff.$md$),
    jsonb_build_object('id','policy','heading','Policy evolution','body',$md$Version policy definitions, labels, and models together. Reviewer decisions provide new labels; policy changes may require relabeling older examples rather than blindly retraining.$md$),
    jsonb_build_object('id','appeals','heading','Adversaries and appeals','body',$md$Train against obfuscation and altered images. Appeals make false removals recoverable and produce high-value counterexamples for evaluation and retraining.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Ingestion','value','1M+ posts/min','note','fast first-pass screening'),
    jsonb_build_object('label','Task','value','Multi-label','note','several policy categories'),
    jsonb_build_object('label','Uncertain cases','value','Human review','note','severity-prioritized queue'),
    jsonb_build_object('label','Heavy analysis','value','Async','note','outside the inline path')
  )
) where slug = 'content-moderation';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$ETA prediction decomposes a route into road segments, predicts current travel time per segment, and sums them with turn costs. **Fresh streaming traffic state** matters as much as model sophistication.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','decomposition','heading','Route decomposition','body',$md$Predict reusable segment travel times, then aggregate along the chosen route with intersection and turn penalties. A whole-trip model generalizes poorly across arbitrary routes.$md$),
    jsonb_build_object('id','features','heading','Features','body',$md$Combine current probe speed, incidents, and weather with road class, speed limit, geometry, and historical speed by time and weekday. Neighboring segments provide spatial context.$md$),
    jsonb_build_object('id','model','heading','Model','body',$md$Gradient-boosted segment regressors are a strong baseline; graph/sequence models capture spillover between connected roads. Serve precomputed current segment predictions, not a full graph model per request.$md$),
    jsonb_build_object('id','freshness','heading','Streaming freshness','body',$md$Aggregate live GPS probes into robust segment speeds, reject outliers, and expire stale observations. Fall back gradually to historical priors where live coverage is thin.$md$),
    jsonb_build_object('id','evaluation','heading','Evaluation','body',$md$Track MAE/MAPE and calibration of arrival-time intervals by region, trip length, and time. Systematic underestimation is especially harmful even when average error looks good.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Requests','value','Millions/s','note','route serving scale'),
    jsonb_build_object('label','Latency','value','<100 ms','note','lookups plus aggregation'),
    jsonb_build_object('label','Prediction unit','value','Road segment','note','reused across routes'),
    jsonb_build_object('label','Freshness','value','Streaming','note','live GPS/probe updates')
  )
) where slug = 'eta-prediction';

update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Semantic search embeds queries and documents into a shared space, uses **approximate nearest-neighbor retrieval** at scale, fuses lexical results for exact terms, and reranks a small candidate set for precision.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id','embeddings','heading','Shared embedding space','body',$md$Encode queries and documents with a domain-appropriate dual encoder. Cosine or dot-product similarity captures paraphrase and semantic relatedness beyond literal terms.$md$),
    jsonb_build_object('id','ann','heading','ANN retrieval','body',$md$Exact comparison against 100M vectors is too slow. HNSW or IVF/PQ trades some recall for latency and memory efficiency; tune search breadth against recall@k.$md$),
    jsonb_build_object('id','hybrid','heading','Hybrid retrieval','body',$md$Fuse ANN with BM25 using weighted or reciprocal-rank fusion. Product names, identifiers, and error codes often require lexical matching.$md$),
    jsonb_build_object('id','rerank','heading','Reranking','body',$md$Apply a cross-encoder to the fused top-N because it can jointly attend to query and document. Its cost is acceptable only after cheap retrieval narrows the corpus.$md$),
    jsonb_build_object('id','freshness-eval','heading','Freshness and evaluation','body',$md$Embed and upsert changed documents; remove deleted vectors. Re-embedding the full corpus is reserved for model changes. Evaluate recall@k/NDCG offline and clicks or task success online.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label','Corpus','value','100M+ docs','note','vector plus lexical indexes'),
    jsonb_build_object('label','Retrieval latency','value','<100 ms','note','ANN and fusion'),
    jsonb_build_object('label','ANN tradeoff','value','Recall ↔ latency','note','search breadth/index parameters'),
    jsonb_build_object('label','Freshness','value','Incremental upsert','note','re-embed on document change')
  )
) where slug = 'semantic-search';
