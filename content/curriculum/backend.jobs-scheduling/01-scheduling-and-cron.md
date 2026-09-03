---
title: Scheduling and cron
minutes: 15
summary: Recurring work, and the distributed-lock problem that shows up the moment more than one instance is running the schedule.
---

Scheduling looks like the simplest part of a backend — run this every hour —
until more than one instance of the app is running, at which point "every
hour" quietly becomes "every hour, from every instance, simultaneously" unless
something explicitly prevents it.

## The single-instance illusion

```text
  a single cron job on a single server: trivial. it runs, it
  finishes, the next tick fires an hour later.

  the SAME job, deployed with 3 app instances for redundancy:

    instance A: cron fires the job
    instance B: cron fires the SAME job
    instance C: cron fires the SAME job

    → the job that was meant to send one digest email now
      sends three
```

```text
  → any recurring job on more than one instance needs a
    DISTRIBUTED LOCK: whichever instance's cron fires first
    acquires the lock and runs; the others see the lock held
    and skip this tick.

    acquire_lock("daily-digest", ttl=10min)
      if acquired: run the job, release on completion
      if not:      skip — someone else has it
```

```text
  → the lock needs a TTL, not just an acquire/release pair —
    if the instance holding the lock crashes mid-job, an
    unbounded lock never releases and the job never runs
    again, on any instance, until someone intervenes by hand.
```

## Drift

```text
  "run every 60 seconds" implemented as sleep(60) BETWEEN
  runs drifts: if the job itself takes 5 seconds, the actual
  interval is 65 seconds, and that error compounds over a
  long-running process.

  → schedule against a FIXED CLOCK (the next :00/:05/:10
    boundary, or a cron expression evaluated against wall-
    clock time), not against "N seconds after the last run
    finished".
```

## Missed runs

```text
  the server hosting the scheduler is down from 2:58 to 3:04.
  the 3:00 job never fires.

  AT-MOST-ONCE     the missed run is simply lost — acceptable
  (fire and forget)  for work where a missed tick doesn't
                     matter (a routine cache warm)

  CATCH-UP          on restart, check "when did this last
                     successfully run" and fire once for the
                     missed tick(s) — needed for anything
                     where a gap is a real problem (a daily
                     billing job that MUST run once per day,
                     eventually, even if delayed)
```

```text
  → decide explicitly which behaviour a given job needs.
    the framework/library default is usually at-most-once,
    silently, which is wrong for the jobs where a missed run
    is a compliance or financial issue.
```

## Exactly-once-ish execution

```text
  true exactly-once is not achievable in general — the same
  underlying limit as
  the Queues & Async Jobs chapter's at-least-once
  delivery. the practical target is "exactly once, or
  detectably zero times, never silently more than once":

    a job crashes mid-run, AFTER partially completing side
    effects, BEFORE marking itself done → on retry (or the
    next tick, if the lock's TTL expired), it runs again

  → make the job's body IDEMPOTENT, the same discipline as a
    queue handler — check "have I already sent today's
    digest" before sending, not just "is it time to send".
```

## Timezone-aware scheduling

```text
  a job scheduled for "9am" needs to specify WHOSE 9am, and
  in which representation:

    "9am UTC"           unambiguous, but drifts relative to
                          any specific region's local morning
                          across DST transitions
    "9am America/New_York"  correct for that region's actual
                             morning, but the job's UTC
                             trigger time SHIFTS by an hour
                             twice a year (see
                             the Time, Dates & Money chapter's
                             DST section)
```

```text
  → most scheduling libraries offer both; pick UTC unless the
    job's purpose specifically requires local-time alignment
    (a "good morning" notification genuinely needs to land
    at the recipient's local morning, DST shift and all).
```

## What to take away

1. Any recurring job running on more than one instance needs a distributed
   lock, or "every hour" becomes "every hour, from every instance,
   simultaneously".
2. The lock needs a TTL — an unbounded lock held by a crashed instance never
   releases, and the job silently stops running on any instance.
3. Schedule against a fixed clock boundary, not "N seconds after the last run
   finished", or the interval drifts by however long each run takes.
4. Decide explicitly whether a missed run should be dropped (at-most-once) or
   caught up on restart — the library default is usually at-most-once,
   which is wrong for jobs where a gap is a compliance or financial issue.
5. A scheduled job's body needs the same idempotency discipline as a queue
   handler, since exactly-once execution isn't achievable in general.
