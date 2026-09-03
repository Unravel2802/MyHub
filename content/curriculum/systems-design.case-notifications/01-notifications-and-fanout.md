---
title: "Case: notifications and fan-out"
minutes: 18
summary: Delivering to millions of devices across channels, and the deduplication that keeps users.
---

Design a notification system: push, email and SMS, triggered by events, delivered
to millions of devices, respecting preferences and quiet hours. The hard parts are
not delivery — they are deduplication, preference evaluation and not becoming the
reason people uninstall the app.

## Requirements

```text
  FUNCTIONAL   multi-channel · templated · scheduled ·
               batched digests · preferences · quiet hours
  NON-FUNCTIONAL
    high throughput bursts (a broadcast to 50M users)
    at-least-once delivery, deduplicated at the device
    respect user preferences ABSOLUTELY
    per-user rate limits
```

```text
  50M users, 5 notifications/day = 250M/day ≈ 3,000/s
  a broadcast: 50M in a few minutes = ~200,000/s peak

  → the burst is the design constraint, not the average
```

## The pipeline

```text
  event ──▶ [trigger] ──▶ [preference filter] ──▶ [rate limit]
        ──▶ [dedupe] ──▶ [template render] ──▶ [channel router]
        ──▶ [provider] ──▶ device
                        └─▶ [delivery tracking]
```

```text
  every stage can DROP a notification, deliberately.
  → and each drop should be counted, so "why didn't I get
    it" is answerable
```

## Preferences

```text
  evaluated in order, most specific first

    1. global opt-out              → drop everything
    2. per-channel                 → "no SMS"
    3. per-category                → "no marketing"
    4. per-entity                  → "mute this thread"
    5. quiet hours (in the USER'S timezone)
    6. frequency caps
```

```text
  □  preferences are checked at SEND time, not at trigger
     time — a user may have opted out in between
  □  TRANSACTIONAL notifications (a password reset, a
     security alert) bypass marketing preferences, and the
     distinction must be explicit in the schema
  □  quiet hours require the user's timezone, and a
     notification scheduled across a DST boundary needs care
```

Getting the transactional/marketing split wrong in either direction is a legal
problem in one direction and a support problem in the other, so it belongs in the
data model rather than in conditional logic.

## Deduplication

The part users notice most:

```text
  the same event reaching a user twice — from a retry, from
  two triggers, from a fan-out re-run.

  → a dedup key per (user, event, channel), stored with a
    TTL longer than the longest retry path
  → checked atomically, per the transactions topic
```

```text
  and the COALESCING that matters more

    5 likes on a post in 10 minutes
      ✗ 5 notifications
      ✓ "Alice and 4 others liked your post"

    → a short buffering window per (user, notification type)
    → aggregate, then send once
```

```text
  and DIGESTS for low-urgency categories

    accumulate over hours; send one summary
    → far fewer notifications, higher engagement per
      notification
```

**Coalescing is the highest-value feature in a notification system** and is
frequently absent from a first design. The failure it prevents — a burst of
individually-correct notifications that makes a user disable them all — is
permanent and unrecoverable.

## Channels

```text
  PUSH (APNs / FCM)
    fastest, cheapest, requires an app and a token
    → tokens EXPIRE and become invalid; handle the
      "unregistered" response by deleting the token, or you
      accumulate dead tokens and waste quota

  EMAIL
    universal, slow, deliverability is its own discipline
    → SPF/DKIM/DMARC, warm-up, bounce and complaint handling
    → a high complaint rate damages your sending reputation
      for everything

  SMS
    highest delivery rate, highest cost, strictest regulation
    → for transactional and 2FA only, realistically

  IN-APP
    no delivery guarantee; read when the user opens
```

```text
  the router picks a channel from urgency, preference and
  cost — with fallback:
    push → if no token or not opened in N minutes → email
```

## The broadcast burst

```text
  50M notifications in a few minutes.

  □  the trigger enqueues ONE job, not 50M
  □  a fan-out worker expands it in BATCHES, checkpointing
     progress so a crash resumes
  □  RATE LIMIT toward each provider — they have quotas, and
     exceeding them gets you throttled or blocked
  □  and SPREAD it: sending 50M at once produces a
     simultaneous traffic spike on your own API when
     everyone taps
```

That last point is a self-inflicted incident worth designing against: a
notification is a request to 50M people to open your app at the same second.

## Delivery tracking

```text
  QUEUED → SENT → DELIVERED → OPENED → CLICKED
                     │
                  BOUNCED / FAILED
```

```text
  □  provider webhooks report delivery and bounces
  □  HARD bounces (invalid address) → stop sending, permanently
  □  SOFT bounces (mailbox full) → retry with backoff
  □  complaint (marked as spam) → immediate opt-out
```

## Templates

```text
  □  versioned, reviewed, and localised
  □  variables validated against the template — a missing
     variable rendering as "Hi {name}" is a visible failure
  □  a PREVIEW and test-send path
  □  and rendering happens at SEND time, so the content
     reflects current data
```

## What to take away

1. The burst, not the average, is the design constraint — a broadcast is two orders
   of magnitude above steady state.
2. Evaluate preferences at send time, most specific first, and put the
   transactional/marketing distinction in the schema rather than in logic.
3. Coalescing multiple events into one notification is the highest-value feature and
   is usually missing from a first design.
4. Push tokens expire — handle the unregistered response or accumulate dead tokens;
   email deliverability is its own discipline with lasting reputation effects.
5. Expand a broadcast in checkpointed batches, rate-limited per provider, and spread
   it so you do not create your own traffic spike.
6. Hard bounces stop permanently, soft bounces retry, and complaints opt out
   immediately.

Next: geospatial queries.
