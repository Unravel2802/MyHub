---
title: "Case: video streaming"
minutes: 18
summary: Transcoding pipelines, adaptive bitrate, and a cost structure dominated by bandwidth.
---

Design a video platform: upload, transcode, stream globally, adapt to network
conditions. It is the case where bandwidth economics dominate every other
consideration, and where the CDN is not an optimisation but the product's
foundation.

## Requirements and scale

```text
  FUNCTIONAL   upload · transcode · adaptive streaming ·
               seek · (optionally) live
  NON-FUNCTIONAL
    start playback in < 2 s
    no rebuffering
    global
    cost-efficient — bandwidth dominates
```

```text
  10M DAU, 30 minutes each
    = 5M hours/day of watching
    at ~3 Mbps average = ~6.75 EB/month of egress

  → at CDN rates this is tens of millions of dollars a month
  → and at object-storage egress rates it is an order of
    magnitude worse
```

The arithmetic settles the architecture before any component is drawn: everything
is subordinate to reducing bytes served and serving them from the cheapest
possible place.

## The upload and transcode pipeline

```text
  client ──(signed URL)──▶ object storage
                              │ event
                              ▼
                        [transcode queue]
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
          [worker]        [worker]        [worker]
          1080p           720p            480p
              └───────────────┼───────────────┘
                              ▼
                    [segmented output + manifest]
                              │
                              ▼
                         object storage ──▶ CDN
```

```text
  □  upload goes DIRECTLY to storage via a signed URL —
     the same decision as the object-storage case
  □  transcoding is embarrassingly parallel: split the video
     into chunks, transcode chunks independently, reassemble
     → a 2-hour film transcodes in minutes on enough workers
  □  transcode to a LADDER of resolutions and bitrates
  □  and it is expensive: budget roughly 1–2× real time per
     output rendition on a CPU, far less on hardware encoders
```

## Adaptive bitrate streaming

```text
  the video is cut into SEGMENTS of 2–10 seconds, encoded at
  several qualities. a MANIFEST lists them.

    1080p  ├──┤├──┤├──┤├──┤├──┤
     720p  ├──┤├──┤├──┤├──┤├──┤
     480p  ├──┤├──┤├──┤├──┤├──┤
     240p  ├──┤├──┤├──┤├──┤├──┤
            ▲    ▲    ▲
        the CLIENT picks a rendition per segment, based on
        measured throughput and buffer level
```

```text
  □  HLS and DASH are the two manifest formats; CMAF lets one
     set of segments serve both
  □  SEGMENT LENGTH is the trade:
       shorter → faster startup and adaptation, more requests
       longer  → better compression, slower to adapt
     → 2–6 seconds is the usual range
  □  the client starts at a LOW rendition for fast startup
    and steps up as the buffer fills
```

**Adaptation is client-side**, which is the design's key property: the server
serves static files, and all the intelligence about network conditions lives where
the network conditions are observable.

## Why the CDN is the architecture

```text
  □  segments are IMMUTABLE and content-addressable →
     cacheable forever, no invalidation
  □  a popular video is served entirely from edge caches
  □  origin traffic is only cache misses — the long tail
```

```text
  the distribution is extreme

    the top 1% of videos are a large majority of watch time
    → a small cache holds most of the demand

  and for the long tail, ORIGIN SHIELD: a mid-tier cache
  between the edges and origin, so 200 edge misses become
  one origin fetch.
```

```text
  the cost levers, in order
    1. CDN hit rate
    2. CODEC efficiency
    3. per-title encoding
    4. not serving higher quality than the device can show
```

## Codecs

```text
  H.264 / AVC   universal support; least efficient
  H.265 / HEVC  ~50% better than H.264; licensing complexity
  VP9           royalty-free; broad browser support
  AV1           ~30% better than VP9; royalty-free;
                expensive to encode, now widely decodable
```

```text
  the trade: encoding cost (once) against bandwidth cost
  (per view, forever).

  → for popular content, an expensive AV1 encode pays back
    quickly
  → for the long tail, it may never
  → so: encode popular content in the efficient codec, and
    the tail in the cheap one
```

That asymmetry — encode once, serve many times — makes per-title and
popularity-tiered encoding straightforwardly worthwhile, and it is a decision
most first designs miss.

**Per-title encoding** is the other large lever: a static screencast needs far
fewer bits than an action sequence for the same perceived quality, so choosing the
bitrate ladder per video rather than globally saves a substantial fraction of
bandwidth at no quality cost.

## Live streaming

```text
  the differences that matter

    LATENCY       seconds matter; a 30-second delay is
                  unacceptable for interaction
    NO REWIND     the pipeline must keep up in real time
    TRANSCODE     must be real-time, so hardware encoders
    SEGMENTS      shorter (1–2 s), or LL-HLS / chunked CMAF
                  for sub-second
    SCALE         a spike to millions at a scheduled start
                  time
```

```text
  → and the scheduled spike is a capacity problem, not a
    streaming one: everyone arrives in the same 30 seconds
```

## Metrics that matter

```text
  □  STARTUP TIME — the strongest predictor of abandonment
  □  REBUFFER RATIO — time spent buffering ÷ watch time
  □  average bitrate delivered
  □  bitrate SWITCHES — frequent switching is visible and
     annoying
  □  playback failure rate
  □  CDN hit rate and egress cost per hour watched
```

Startup time is the one to optimise first: it correlates most strongly with
abandonment, and it is improved by short initial segments, a low starting
rendition and warm edge caches — all cheap.

## What to take away

1. Bandwidth economics dominate; the arithmetic settles the architecture before any
   component is drawn.
2. Upload direct to storage, and transcode chunks in parallel into a ladder of
   renditions.
3. Adaptation is client-side — the server serves immutable static segments, which
   is what makes them cacheable forever.
4. The CDN is the architecture, not an optimisation, and origin shield collapses
   long-tail misses.
5. Encoding cost is paid once and bandwidth per view forever, which makes
   popularity-tiered codecs and per-title encoding straightforwardly worthwhile.
6. Optimise startup time first — it is the strongest predictor of abandonment.

Next: metrics and time-series at scale.
