---
title: Working in a team
minutes: 17
summary: Async communication and code ownership — the coordination mechanisms that replace a hallway conversation once a team is too big, or too spread out, for one.
---

A two-person team can coordinate by talking. Once a team grows past a
handful of people, or spans time zones, that stops working — and the
mechanisms this chapter covers (async-first communication, explicit
ownership, structured disagreement) exist specifically to replace what a
hallway conversation used to handle informally, at a scale where informal
stops being reliable.

## Async-first: writing for someone who isn't there yet

```text
  SYNCHRONOUS default    "let's hop on a call to discuss this"
                        — works when everyone's awake and
                        available at the SAME time; breaks down
                        completely across timezones, or when
                        someone's heads-down and shouldn't be
                        interrupted

  ASYNC-FIRST default      write it down, clearly enough that
                        someone reads it LATER and has
                        everything they need, without a live
                        conversation being REQUIRED to fill in
                        the gaps
```

```text
  → this is the Technical Writing chapter's discipline, applied
    to day-to-day team communication rather than to a formal
    design doc — a Slack message or a PR description written
    for someone reading it six hours later (a different
    timezone, someone who was in a meeting) needs the SAME
    completeness a good commit message needs: the full context,
    not "as we discussed" referencing a conversation the reader
    wasn't actually part of.
```

## Code ownership: a spectrum, not a binary

```text
  STRONG OWNERSHIP        one person/team OWNS a codebase area;
                         changes to it need explicit review
                         from the owner — clear accountability,
                         but a potential bottleneck if the
                         owner is unavailable

  COLLECTIVE OWNERSHIP      anyone can change anything, no
                         single required reviewer — no
                         bottleneck, but a real risk of nobody
                         actually feeling DEEPLY accountable for
                         any one specific area's overall health
```

```text
  → most real, functioning teams land somewhere BETWEEN these
    two extremes, and DELIBERATELY so — strong ownership for
    genuinely CRITICAL, high-blast-radius systems (this
    project's own migrations and published contracts, kept
    under tighter review specifically because getting them
    wrong is expensive) and looser, more collective ownership
    for lower-stakes application code where a bottleneck would
    cost more than the accountability gap it prevents.
```

## Disagreement: the productive kind, and the kind that just stalls

```text
  "I think we should use approach A"     ✗ a POSITION stated
                                              without its
                                              REASONING — invites
                                              a counter-position,
                                              not a genuine,
                                              examinable
                                              discussion

  "I think A, because it handles the       ✓ a position WITH
  edge case where X happens — does B           its reasoning
  actually handle that case too?"               attached, which
                                                  invites an
                                                  actual
                                                  substantive
                                                  response rather
                                                  than a
                                                  restated
                                                  counter-opinion
```

```text
  → this is the Code Review chapter's "phrase a concern as a
    grounded question" discipline, applied to team disagreement
    generally, not only to reviewing a diff — stating the
    REASONING behind a position (not just the position itself)
    is what turns a disagreement into something that can
    actually be RESOLVED through discussion, rather than two
    people simply repeating their own conclusions at each other,
    louder, with no new information exchanged either way.
```

## Disagree and commit: what happens after a decision is genuinely made

```text
  → after a genuine, real discussion, a decision gets made —
    and it WON'T match everyone's individual preference, every
    single time, by the very nature of there being more than
    one person with an opinion in the room.

  → "DISAGREE AND COMMIT": once a decision is actually made,
    everyone commits to executing it FULLY, even those who
    argued for a different approach during the actual
    discussion — the alternative (quietly under-executing a
    decision you personally disagreed with, or re-litigating it
    repeatedly after the fact, at every subsequent opportunity)
    is what genuinely paralyzes a team's ability to move at all,
    far more than any specific decision being imperfect ever
    could on its own.
```

## Timezones: a real, structural constraint, not just an inconvenience

```text
  → a team spanning multiple timezones has a genuinely SMALLER
    window of actual real-time OVERLAP than a co-located team
    does — this is a real, structural constraint worth
    designing communication norms AROUND deliberately, not
    treating as a minor inconvenience to be worked around
    informally, case by case, as it happens to come up.
```

```text
  → the practical response: default to ASYNC for anything that
    genuinely CAN be async (most things actually can, once
    written clearly enough), and reserve the SCARCE overlap
    window specifically for what genuinely NEEDS real-time,
    synchronous discussion (a decision with real, examined
    disagreement that async back-and-forth is visibly failing
    to resolve) — treating the overlap window as a scarce,
    valuable resource rather than defaulting to filling it with
    routine status updates that could just as easily have been
    written down instead.
```

## What to take away

1. Async-first communication is the technical-writing discipline applied to
   day-to-day coordination — writing with the full context a reader six
   hours and a timezone away actually needs, not referencing a conversation
   they weren't part of.
2. Code ownership is a spectrum, and most functioning teams deliberately
   land between the extremes — strong ownership for critical, high-blast-
   radius systems, looser collective ownership where a bottleneck would
   cost more than the accountability gap.
3. Stating the reasoning behind a position, not just the position itself,
   is what turns disagreement into something resolvable through discussion
   rather than two people repeating conclusions louder at each other.
4. Disagree and commit means fully executing a decision even after arguing
   for a different one — the alternative of quiet under-execution or
   repeated re-litigation paralyzes a team far more than any single
   imperfect decision does.
5. A distributed team's real-time overlap window is a genuinely scarce
   resource — defaulting to async for what can be async, and reserving
   overlap for what actually needs synchronous discussion, is the practical
   response to that structural constraint.
