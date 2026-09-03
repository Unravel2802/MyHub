---
title: Back-of-envelope estimation
minutes: 18
summary: The numbers worth memorising and the arithmetic that turns them into design decisions.
---

Estimation is how you find out, in two minutes, whether a design is plausible. It
is not about precision — being within an order of magnitude is enough to rule
options in and out, which is all the decision needs.

## The numbers to memorise

```text
  TIME
    1 day = 86,400 s        ≈ 10⁵
    1 month ≈ 2.6M s
    1 year ≈ 31.5M s        ≈ 3 × 10⁷

  LATENCY (from the distributed track)
    L1 cache          1 ns
    main memory     100 ns
    SSD read        100 µs
    same-DC RTT     0.5 ms
    cross-region     50–150 ms
    disk seek         5 ms

  SIZES
    a UUID           16 B
    a timestamp       8 B
    a short text     ~200 B
    a JSON record  ~1–2 KB
    a web page     ~1–2 MB
    a photo        ~1–5 MB
    a minute of video ~50 MB (1080p)

  CAPACITY (one commodity server)
    Postgres, indexed     20k–50k simple queries/s
    Redis                 100k+ ops/s
    nginx static          100k+ req/s
    memory              256 GB – 2 TB
    NVMe               10–100 TB, 500k+ IOPS
    network            25–100 Gbps
```

## Powers of two, for storage

```text
  2¹⁰  = 1 thousand   KB
  2²⁰  = 1 million    MB
  2³⁰  = 1 billion    GB
  2⁴⁰  = 1 trillion   TB
  2⁵⁰  =              PB
```

## The four calculations

```text
  1. QPS
       DAU × actions per user per day ÷ 86,400
       peak = 2–10× average

  2. STORAGE
       records/day × size × retention days × replication
       × 1.3 for indexes and overhead

  3. BANDWIDTH
       QPS × payload size

  4. MEMORY (for a cache)
       working set × size
       → and the 80/20 rule: 20% of data serves 80% of
         requests, so caching the hot 20% is usually enough
```

## A worked example

```text
  a social app: 100M DAU

  WRITES
    each user posts twice a day
      200M posts/day ÷ 86,400 ≈ 2,300 writes/s
      peak (×5) ≈ 12,000 writes/s

  READS
    each user opens the feed 20 times, 20 posts each
      100M × 20 = 2B feed loads/day ≈ 23,000 QPS
      peak ≈ 115,000 QPS
      → read:write ≈ 10:1 by request, 100:1 by item

  STORAGE
    200M posts × 500 B (text + metadata) = 100 GB/day
      × 365 days = 36 TB/year
      × 3 replication = ~110 TB/year
    media: 10% of posts have a 2 MB image
      = 20M × 2 MB = 40 TB/day  ← DOMINATES
      → media goes to object storage and a CDN, not the
        database. that conclusion falls straight out of the
        number.

  BANDWIDTH
    115,000 QPS × 20 KB response = 2.3 GB/s = ~18 Gbps
      → several load-balanced servers; a CDN for media

  CACHE
    hot working set ≈ 20% of a day's posts
    = 40M posts × 500 B = 20 GB
      → comfortably fits in memory. cache the timeline.
```

```text
  the conclusions that fall out, without any further work

    □  media dominates storage → object storage + CDN
    □  reads dominate requests → caching is the main lever
    □  12k writes/s exceeds one Postgres primary →
       partition, or a different store
    □  the hot set fits in RAM → a cache hit rate above 90%
       is achievable
```

**That last block is the point of the exercise.** The arithmetic is worthless
unless it produces architectural conclusions, and here four numbers ruled out a
single-database design and ruled in a CDN, a cache and partitioning.

## Estimating with confidence

```text
  □  ROUND AGGRESSIVELY — 86,400 is 10⁵; 365 is 400
  □  work in powers of ten
  □  STATE ASSUMPTIONS out loud: "assume 2 posts per user
     per day — tell me if that's off"
  □  SANITY-CHECK against something known: 100M DAU is
     roughly Twitter-scale; 40 TB/day of media is a large
     but not absurd CDN bill
  □  compute PEAK, not just average — systems fail at peak
  □  and remember peak is not uniform: a global product has
     a diurnal cycle per region
```

## Ratios worth carrying

```text
  read:write        10:1 to 1000:1 for consumer products
                    → caching is almost always the answer
  peak:average      2–10×
  cache hit rate    80–95% achievable with a good key
  compression       2–10× on text, ~1× on already-compressed
                    media
  storage overhead  ~1.3× for indexes
  replication       3× typical
```

## Cost, roughly

```text
  compute     $50–150 / month per commodity VM
  GPU         $1–40 / hour depending on the card
  object
  storage     ~$0.02 / GB / month
  block
  storage     ~$0.10 / GB / month
  egress      ~$0.05–0.09 / GB   ← frequently the surprise
  managed DB  2–4× the equivalent self-hosted compute
```

```text
  the egress line is the one that catches people:

    40 TB/day of media served directly from object storage
    = 1.2 PB/month × $0.08 = ~$96,000/month

    the same traffic through a CDN with a 95% hit rate
    ≈ $10,000–20,000/month

  → which is a second, independent argument for the CDN
```

## Common mistakes

```text
  ✗  computing average and designing for it
  ✗  forgetting replication and index overhead
  ✗  ignoring media, which usually dominates storage
  ✗  ignoring egress, which often dominates cost
  ✗  false precision — 2,314.7 QPS is not more useful than
     "about 2,000"
  ✗  computing numbers and drawing no conclusion from them
```

## What to take away

1. Memorise a handful of numbers — 86,400 seconds a day, the latency ladder,
   typical record sizes, one server's capacity — and round aggressively.
2. The four calculations are QPS, storage, bandwidth and cache working set.
3. Always compute peak, not average, and state your assumptions aloud so they can
   be corrected.
4. Media usually dominates storage and egress usually dominates cost — both are
   commonly forgotten.
5. Sanity-check against a known system, and prefer an order of magnitude to false
   precision.
6. Arithmetic that produces no architectural conclusion is wasted — say what each
   number rules in or out.

Next: choosing where the data lives.
