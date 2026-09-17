---
title: How software gets built
minutes: 17
summary: Process exists to serve a specific coordination problem — the moment it stops serving one, it's become ceremony.
---

Every process this chapter covers — standups, sprints, estimation, planning
— was invented to solve a real coordination problem a team actually had.
The failure mode this whole chapter is built around isn't "too much
process" or "too little" — it's process that outlived the problem it was
invented for, still being followed out of habit long after anyone
remembers why.

## Agile as a response to a real, specific failure

```text
  the thing Agile was a REACTION to: WATERFALL — gather ALL
  requirements upfront, design the ENTIRE system, build it,
  THEN show it to the customer, months or years later.

  → the failure this produces isn't hypothetical: requirements
    gathered eighteen months before delivery are frequently
    WRONG by delivery time — the market moved, the customer's
    actual need turned out different from what they described
    in that first conversation, or a competitor shipped
    something that changed what "good enough" even means.
    Waterfall has NO mechanism for correcting course until the
    very end, by which point the cost of being wrong is the
    ENTIRE project.
```

```text
  → Agile's actual core idea, underneath all the specific
    named methodologies: get something real in front of a
    user SOONER, and use what you learn to correct course
    BEFORE the mistake compounds for eighteen more months. every
    specific ceremony below exists in service of that one idea
    — and is worth keeping only as long as it's actually
    serving it.
```

## Sprints and iterations: bounding the cost of being wrong

```text
  → a SPRINT (a fixed, short time-boxed period — commonly one
    or two weeks) bounds how long the team can be building
    something before checking whether it's still the RIGHT
    thing — this is a direct, deliberate response to
    Waterfall's failure mode: instead of one eighteen-month bet,
    it's dozens of two-week bets, each one correctable based on
    what was actually learned from the last.
```

## Standups: a genuinely narrow tool, frequently misused

```text
  the STATED purpose: surface BLOCKERS quickly, so they get
  resolved in hours, not days — "I'm stuck on X" said out loud
  to the team gets help faster than staying silently stuck
  until a weekly status meeting.

  → the common, real failure mode: a standup that's actually a
    STATUS REPORT to a manager (going around the room, everyone
    reciting what they did yesterday, in order, to an audience
    that's mostly just waiting for their own turn) — this is
    the EXACT ceremony-without-purpose trap this chapter opened
    with: the meeting still happens, daily, on schedule, having
    quietly stopped doing the one thing it actually existed to
    do.
```

## Estimation: the practice everyone hates, for real, structural reasons

```text
  → software estimation is GENUINELY, STRUCTURALLY hard, not
    merely something engineers are bad at through some personal
    failing — a task's actual complexity is often not knowable
    until you're PARTWAY into it (this is the Computability and
    NP-Completeness chapter's uncertainty, showing up in project
    planning rather than in a formal complexity class): "how
    long will this take" frequently can't be answered accurately
    until a meaningful fraction of "this" has already been done.
```

```text
  → STORY POINTS (relative, unitless effort — "this is about as
    big as that OTHER thing we did last month") exist
    specifically to sidestep the FALSE PRECISION of hour-based
    estimates, which look confidently precise ("6.5 hours") while
    being, underneath, exactly as uncertain as a relative
    comparison — the number just LOOKS more scientific than it
    actually is. points are an honest admission of uncertainty
    disguised as an estimate; hours are dishonest precision
    disguised as the same thing.
```

## Scope creep: the failure that shows up gradually, not all at once

```text
  → "just one more small thing" — a single instance is
    genuinely, individually reasonable, almost every time it
    happens — the actual PROBLEM is the CUMULATIVE effect: ten
    individually-reasonable additions, each one seeming small in
    isolation, together can double a project's actual scope
    without anyone ever making one single decision that,
    examined on its own, looks unreasonable.
```

```text
  → the fix isn't "say no to every addition" (some genuinely
    ARE worth adding) — it's making the TRADE-OFF EXPLICIT,
    every single time: "yes, we can add that — here's what it
    pushes out, or what date it moves" — this is the Capacity
    Planning and Cost chapter's headroom idea, applied to a
    project's timeline instead of a system's compute capacity:
    there IS a finite budget, and every addition genuinely
    spends some of it, whether or not anyone says so out loud.
```

## Process vs. ceremony: the actual test

```text
  the test this entire chapter has been building toward: for
  ANY given process (this standup, this specific estimation
  ritual, this exact sprint-planning meeting) — does it
  STILL solve the coordination problem it was ORIGINALLY
  adopted for, for THIS team, right now, today?

  → a process that made genuine sense for a 5-person team can
    become actively HARMFUL for a 50-person one (it doesn't
    scale) — and a process built for a 50-person team is often
    absurd overhead for a 5-person one (it was never needed at
    that size in the first place). the RIGHT amount and kind of
    process is a function of the team's actual current size,
    its risk profile, and its own specific coordination needs —
    never a fixed, universal, one-size-fits-every-team answer.
```

## What to take away

1. Agile's core idea — get something real in front of a user sooner, use
   what's learned to correct course — is a direct, deliberate response to
   Waterfall's failure mode of an eighteen-month bet that can only be
   discovered wrong at the very end.
2. A standup's real purpose is surfacing blockers quickly, not delivering a
   status report to a manager — the moment it becomes the latter, it's kept
   its schedule while losing its actual function.
3. Estimation is structurally hard, not a personal engineering failing — a
   task's true complexity is often unknowable until you're partway into it.
4. Scope creep's danger is cumulative, not individual — ten reasonable
   additions can double a project's scope without any single decision
   looking unreasonable in isolation, which is why the trade-off needs to
   be made explicit every time, not just judged case by case.
5. The test for any process is whether it still solves the coordination
   problem it was adopted for, for this specific team, right now — the
   right amount of process scales with team size and risk, never a fixed
   universal answer.
