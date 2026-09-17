---
title: Design docs and technical review
minutes: 17
summary: A document written to get a decision made — the Technical Writing chapter's RFC structure, run as an actual live review process.
---

The Technical Writing chapter already covered a design doc's structure —
context, options, decision, consequences. This chapter is what happens
around that document: running the review it's meant to trigger, disagreeing
productively inside it, and the specific, recurring ways a review process
goes wrong even when the document itself is well written.

## A design doc exists to get a decision made, not to record one already made

```text
  → the most common, most damaging failure: writing the doc
    AFTER the decision is already, privately made, and using
    the "review" purely as a RUBBER STAMP — this defeats the
    entire actual point. a genuine review needs to happen while
    the decision is STILL GENUINELY OPEN, with real, examinable
    reasoning that a reviewer could plausibly still change, not
    a performance of consultation for a choice that's already
    been locked in behind the scenes.
```

```text
  → the honest, practical test: could this specific review
    ACTUALLY change the outcome? if the answer is genuinely no
    — the decision is already effectively made, immovably, no
    matter what anyone says in review — then what's happening
    isn't really a review, whatever it's formally called; it's
    an announcement wearing a review's clothing.
```

## Running a review: the facilitator's actual job

```text
  → a review MEETING (as opposed to written async comments)
    needs an explicit FACILITATOR whose job is specifically
    making sure the RIGHT QUESTIONS get asked — not merely
    letting the loudest or most senior person in the room set
    the entire direction of discussion by default, simply
    because nobody else happened to speak up first.
```

```text
  ✓  has every GENUINE alternative actually been considered,
     including the ones the document didn't happen to mention
  ✓  what happens if a core ASSUMPTION in the doc turns out to
     be wrong — is the whole plan fragile to that, or does it
     degrade gracefully
  ✓  who's ACTUALLY going to build this, and do THEY have real,
     substantive concerns that haven't been surfaced yet
```

## Disagreeing well, inside a formal review specifically

```text
  → the Working in a Team chapter's "state the reasoning, not
    just the position" discipline applies here with EVEN MORE
    force, specifically because a design REVIEW is where the
    COST of a wrong decision is still cheap to fix — this is
    genuinely the highest-leverage moment for productive
    disagreement in an entire project's whole lifecycle: a
    concern raised HERE, before any code exists yet, costs a
    conversation; the identical concern raised after
    IMPLEMENTATION costs a rewrite.
```

```text
  "I don't like this approach"              ✗ a REACTION, not
                                                 an examinable
                                                 argument —
                                                 nothing for the
                                                 author to
                                                 actually engage
                                                 with or respond
                                                 to

  "this approach doesn't handle the           ✓ a SPECIFIC,
  concurrent-write case — what happens          EXAMINABLE
  if two requests hit this at the same           concern the
  time?"                                          author can
                                                    directly
                                                    respond to,
                                                    confirm, or
                                                    push back on
                                                    with actual
                                                    reasoning
```

## The bikeshedding trap: cheap-to-discuss things crowd out expensive ones

```text
  → PARKINSON'S LAW OF TRIVIALITY, playing out concretely and
    predictably in an actual review: a genuinely deep,
    substantive architectural question gets FIVE minutes of
    discussion (it's hard, unfamiliar, and uncomfortable to
    engage with directly) — a naming convention or a formatting
    preference gets THIRTY (everyone has an immediate,
    low-effort opinion on THAT, and it's easy and comfortable
    to voice).
```

```text
  → the practical fix: a facilitator EXPLICITLY steering
    discussion time toward the questions that actually MATTER
    most for THIS specific decision — and, separately,
    resolving genuinely trivial disagreements (a naming
    convention with no real stakes either way) QUICKLY, by
    simple facilitator judgment call, rather than letting them
    consume review time genuinely proportional to how
    CONSEQUENTIAL the underlying question actually is.
```

## When review reveals the doc itself needs more work

```text
  → sometimes a review surfaces that the DOCUMENT itself isn't
    actually ready for a real decision yet — missing a genuine
    alternative that should have been considered, an unexamined
    assumption nobody had actually verified, a consequence
    nobody had thought through carefully.

  → this is a GOOD outcome, not a failed review, even though it
    doesn't feel that way in the room — this is EXACTLY the
    Technical Writing chapter's "the options section is what
    saves someone later" point, caught and fixed BEFORE
    publication rather than discovered by a confused reader
    months afterward, wondering why the simpler alternative was
    never even considered.
```

## What to take away

1. A design doc's review needs to happen while the decision is still
   genuinely open — a review of an already-decided choice is an
   announcement wearing a review's clothing, not a real review.
2. A review meeting's facilitator job is ensuring the right questions get
   asked, not letting the loudest or most senior voice in the room set the
   direction by default.
3. Stating reasoning rather than a bare reaction matters even more in a
   design review than elsewhere — a concern raised here costs a
   conversation; the same concern raised after implementation costs a
   rewrite.
4. Parkinson's law of triviality plays out predictably in real reviews —
   deep architectural questions get too little time and trivial ones get
   too much, which is why a facilitator steers time toward what actually
   matters.
5. A review that reveals the document itself isn't ready — a missing
   alternative, an unexamined assumption — is a good outcome, not a failed
   review, since it's the exact gap the Technical Writing chapter's options
   section exists to catch before publication.
