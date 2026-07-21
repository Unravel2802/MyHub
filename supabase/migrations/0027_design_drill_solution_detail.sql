-- Design Drills: structured, LeetCode-editorial-style solutions.
--
-- The `solution` TEXT column (migration 0025) is a single plain-text blob
-- rendered whitespace-pre-wrap. This adds `solution_detail jsonb` — a structured
-- editorial (intuition summary + ordered markdown sections + a quantitative
-- "scale, latency & cost" estimates block that stands in for algorithmic Big-O,
-- since these are DESIGN drills). The app now has a real markdown renderer
-- (react-markdown + remark-gfm + rehype-highlight, approved in CLAUDE.md/
-- AGENTS.md), so section bodies are GFM markdown.
--
-- Shape (validated defensively in DesignDrillsRepository.parseSolutionDetail —
-- a malformed blob falls back to the plain-text `solution`, never throws):
--   { summary: string,
--     sections: [{ id: string, heading: string, body: markdown }],
--     estimates: [{ label: string, value: string, note?: string }],
--     references?: [{ label: string, url: string }] }
-- `id` is a URL-safe anchor slug (outline nav + #section deep-links).
--
-- This migration adds the column and backfills THREE gold-standard exemplars
-- (url-shortener, rate-limiter, recommendation-system) that set the quality bar
-- and the JSON shape. The remaining 22 drills are backfilled in 0028.
--
-- jsonb is built with jsonb_build_object/array so each markdown body is a plain
-- dollar-quoted literal ($md$…$md$) — no JSON escaping of quotes/newlines.
-- Re-runnable: plain UPDATE ... WHERE slug.

alter table design_drills add column if not exists solution_detail jsonb;

-- url-shortener -------------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A URL shortener is a **write-light, read-heavy key-value lookup**: map a short code to a long URL. Three decisions carry the whole design — how you *mint codes*, where you *store the mapping*, and how you *serve reads* cheaply. Custom aliases, expiry, and analytics all hang off those three.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'requirements', 'heading', 'Requirements', 'body', $md$**Functional**

- `shorten(longUrl) -> shortUrl`, with optional custom alias and expiry.
- `resolve(code) -> redirect` to the original URL.

**Non-functional**

- Codes must not be sequentially guessable.
- Redirects stay fast under a heavy read skew (see the estimates panel).
- Retention of years ⇒ tens of billions of rows.$md$),
    jsonb_build_object('id', 'api', 'heading', 'API', 'body', $md$```http
POST /urls        { long_url, custom_alias?, ttl? }  -> { short_url }
GET  /{code}      -> 302 Location: long_url
```

Use **302, not 301**: a 301 is cached by browsers effectively forever, which kills click analytics and makes expiry or re-targeting impossible.$md$),
    jsonb_build_object('id', 'key-generation', 'heading', 'Key generation — the crux', 'body', $md$**Base62** over `[0-9a-zA-Z]`: 7 chars = 62⁷ ≈ 3.5T codes, plenty.

Encode a unique integer, but source it **without a single hot counter**:

- A central allocator hands each app server a *block* of ids (e.g. 1,000 at a time), or
- use a Snowflake-style id.

Encoding a raw monotonic counter makes codes sequential and enumerable — so either permute the counter with a keyed bijection, or accept sequential ids and rate-limit enumeration at the edge.

*Alternative:* hashing (first 7 chars of a hash of the URL) forces a collision check on every write and turns "same URL → same code?" into a product decision.$md$),
    jsonb_build_object('id', 'storage', 'heading', 'Data model & storage', 'body', $md$| Column | Notes |
| --- | --- |
| `code` | PK; access is pure lookup by code |
| `long_url` | the target |
| `created_at`, `expires_at` | expiry is lazy + swept |
| `owner` | for custom aliases / auth |

Access is a pure lookup by `code`, so a horizontally-sharded KV store (DynamoDB/Cassandra) fits; a single Postgres won't hold tens of billions of rows without sharding by `code`. A custom alias is a reserved row — use a conditional/if-not-exists insert so two users can't claim the same alias.$md$),
    jsonb_build_object('id', 'reads', 'heading', 'Serving reads (10:1)', 'body', $md$- Front the store with a **Redis LRU cache**. A small set of links gets most of the traffic, so the hit rate is very high and the DB sees mostly misses.
- **Analytics MUST be async**: emit a click event to a log/queue (Kafka) and aggregate offline. Never do a synchronous counter increment on the redirect hot path.$md$),
    jsonb_build_object('id', 'expiry', 'heading', 'Expiry & delete', 'body', $md$Store `expires_at`; check it lazily on read plus a background sweeper. Give cache entries a TTL so expiry evicts them automatically.$md$),
    jsonb_build_object('id', 'tradeoffs', 'heading', 'Tradeoffs & what interviewers probe', 'body', $md$- **302 vs 301** — analytics and mutability.
- Avoiding **guessable codes**.
- Generating ids **without a hot counter**.
- Why the **cache hit rate** is high.
- **Custom-alias uniqueness** under concurrency.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', 'Write throughput', 'value', '~1.2K rps', 'note', '100M writes/day, average'),
    jsonb_build_object('label', 'Peak writes', 'value', '~12K rps', 'note', '~10x provisioning headroom'),
    jsonb_build_object('label', 'Read throughput', 'value', '~12K rps', 'note', '10:1 read:write skew'),
    jsonb_build_object('label', 'Stored rows', 'value', '10s of billions', 'note', 'years of retention'),
    jsonb_build_object('label', 'Code space', 'value', '62⁷ ≈ 3.5T', 'note', '7-char base62')
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', 'Base62 encoding', 'url', 'https://en.wikipedia.org/wiki/Base62')
  )
) where slug = 'url-shortener';

-- rate-limiter --------------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A rate limiter answers *"has key K exceeded N actions per window?"* on the request hot path. Four decisions carry it: the **counting algorithm**, where **shared state** lives, the **concurrency guarantee**, and the **failure policy** when the store is down.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'requirements', 'heading', 'Requirements', 'body', $md$- Per-user **and** per-API limits, with a clear rejection signal.
- Correct across many instances of the calling service.
- Defined behavior when the limiter's own store is down.
- Sub-millisecond decision — negligible latency added to every call.$md$),
    jsonb_build_object('id', 'algorithms', 'heading', 'Algorithms — name the trade-off', 'body', $md$| Algorithm | Memory | Accuracy | Bursts |
| --- | --- | --- | --- |
| Fixed window counter | O(1) | Allows 2x boundary burst | — |
| Sliding window log | O(N) per key | Exact | — |
| Sliding window counter | O(1) | Near-exact | The usual default |
| Token bucket | O(1) | Steady long-run rate | Permits controlled bursts |

**Sliding window counter** weights the previous window's count by overlap — near-exact at O(1). **Token bucket** refills tokens at a rate and spends one per request — best when you *want* to permit short bursts.$md$),
    jsonb_build_object('id', 'state', 'heading', 'Where state lives', 'body', $md$**Not** per-instance memory — the requirement is correctness across many callers, so a shared low-latency store (**Redis**) holds the counters. Key = `ratelimit:{api}:{user}`.$md$),
    jsonb_build_object('id', 'concurrency', 'heading', 'Concurrency — the crux', 'body', $md$The naive GET-then-SET is a race: two concurrent requests both read 99, both write 100, both pass. Fix with an **atomic op**:

```lua
-- token bucket: refill-then-spend in one round trip
local tokens = redis.call('GET', KEYS[1]) or capacity
-- ...refill by elapsed time, then:
if tokens >= 1 then redis.call('DECR', KEYS[1]); return 1 else return 0 end
```

A simple counter can use `INCR` + `EXPIRE`; token bucket needs a small Lua script so refill and spend happen atomically.$md$),
    jsonb_build_object('id', 'config', 'heading', 'Configuration', 'body', $md$Limits are **data, not code**: a config store maps `(api, tier) -> {limit, window}`, hot-reloaded, so no deploy per limit change. Reject with `429` + `Retry-After` and `X-RateLimit-Remaining`/`Reset` headers.$md$),
    jsonb_build_object('id', 'failure-policy', 'heading', 'Failure policy', 'body', $md$Decide **fail-open vs fail-closed** explicitly when Redis is unreachable:

- Most APIs → **fail-open** (allow): a limiter outage shouldn't take down the whole API.
- Abuse/security-critical limits → **fail-closed**.

Deploy Redis close to callers (or a local token-bucket approximation synced periodically) to keep the added latency tiny.$md$),
    jsonb_build_object('id', 'tradeoffs', 'heading', 'Tradeoffs & what interviewers probe', 'body', $md$- The **boundary-burst** flaw of fixed windows.
- The **read-modify-write race** and its atomic fix.
- **Fail-open vs fail-closed** and why.
- Configuring limits **without a deploy**.
- **Multi-instance** correctness.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', 'Decision latency', 'value', '<1 ms', 'note', 'per call, on the hot path'),
    jsonb_build_object('label', 'Shared state', 'value', 'Redis', 'note', 'low-latency, near callers'),
    jsonb_build_object('label', 'Memory / key', 'value', 'O(1)', 'note', 'sliding window counter'),
    jsonb_build_object('label', 'Reject signal', 'value', '429 + Retry-After', 'note', 'plus X-RateLimit headers')
  )
) where slug = 'rate-limiter';

-- recommendation-system -----------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A large recommender can't score the whole catalog per request. The pattern is **two-stage**: cheaply *retrieve* a few hundred candidates, then *rank* them with a heavier model. Cold-start, metrics, and feedback loops all hang off that spine.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'objective', 'heading', 'Requirements & objective', 'body', $md$- Ranked recs per user, refreshed as they interact; handle **new users and new items**.
- Optimize a **real objective** (e.g. long-term watch time), not just clicks.$md$),
    jsonb_build_object('id', 'two-stage', 'heading', 'Two-stage architecture — the crux', 'body', $md$**Retrieval / candidate generation** narrows 100M items → ~hundreds:

- A **two-tower model** — a user tower and an item tower — produces embeddings.
- Item embeddings are indexed in an **ANN** structure (FAISS/ScaNN).
- At serve time, embed the user and do an ANN nearest-neighbor lookup. Complement with co-visitation / popularity sources.

**Ranking** then scores those few hundred candidates with a heavier model and rich features, and picks the top-k. A single model over the whole catalog per request can't meet the latency budget — that's *why* retrieval exists.$md$),
    jsonb_build_object('id', 'features', 'heading', 'Features', 'body', $md$| Group | Examples |
| --- | --- |
| User | watch history, embeddings, demographics, session context (time, device) |
| Item | metadata, age, historical engagement, embedding |
| Interaction / cross | past affinity between user and this item's channel/topic |

Cross features carry most of the signal.$md$),
    jsonb_build_object('id', 'cold-start', 'heading', 'Cold start (both sides)', 'body', $md$- **New user** (no history) → fall back to popularity / demographic priors / onboarding signals; personalize as interactions arrive.
- **New item** (no engagement) → lean on content-based features (metadata embedding) and explicit exploration until it accrues data.$md$),
    jsonb_build_object('id', 'training-eval', 'heading', 'Training & evaluation', 'body', $md$Train on logged impressions + engagement labels. Beware **training/serving skew**: features computed differently offline vs online silently degrade quality — share one feature pipeline / feature store.

- **Offline:** AUC / NDCG / recall@k on held-out logs.
- **Online:** CTR, watch time, session length via **A/B test** — the arbiter. An offline win doesn't guarantee an online win.$md$),
    jsonb_build_object('id', 'tradeoffs', 'heading', 'Failure modes & what interviewers probe', 'body', $md$- **Feedback loops** — recommending what you already show.
- **Popularity bias** and the need for **exploration**.
- Why **two stages**.
- The **ANN recall vs latency** trade-off.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', 'Catalog size', 'value', '100M+ items', 'note', 'why retrieval must exist'),
    jsonb_build_object('label', 'Request volume', 'value', 'billions/day', 'note', 'serving scale'),
    jsonb_build_object('label', 'Serving latency p99', 'value', 'tens of ms', 'note', 'retrieval + ranking'),
    jsonb_build_object('label', 'Retrieval fan-in', 'value', '100M → ~hundreds', 'note', 'two-tower + ANN'),
    jsonb_build_object('label', 'Ranking set', 'value', '~hundreds → top-k', 'note', 'heavier model')
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', 'Two-tower retrieval (Google)', 'url', 'https://research.google/pubs/pub48840/')
  )
) where slug = 'recommendation-system';
