---
title: Technical writing
minutes: 14
summary: Design docs, RFCs, and commit messages written to survive their author leaving.
---

Code says what a system does. Documentation is the only place that says why —
and why is exactly what's gone once the person who made the decision leaves,
unless it was written down. This chapter is writing for that eventual reader,
who is often you, six months later, with no memory of the meeting where this
got decided.

## The design doc / RFC

```text
  the structure that consistently works, roughly:

    CONTEXT       what problem exists, and why it matters now
                  — not "we should use X," but the SITUATION
                  that makes a decision necessary

    OPTIONS        the alternatives seriously considered,
                   each with its real trade-offs — INCLUDING
                   the one you didn't pick, and why not

    DECISION        what was chosen, and the specific reasons
                   (not just "this is best," but "this,
                   because Y mattered more than Z here")

    CONSEQUENCES     what this decision costs, commits to, or
                    rules out later — the parts a reader six
                    months from now needs to know before
                    undoing it
```

```text
  → the OPTIONS section is the one people skip, and it's the
    one that matters most later: a reader wondering "why
    didn't we just do the simpler thing" needs the doc to
    already have that reader's exact question anticipated and
    answered — the alternative's real trade-off, not a
    strawman version dismissed in one line.
```

## Commit messages

```text
  Fix bug                          ✗ tells a future git-blame
                                       reader nothing

  Fix the race in checkout          better, but still says
                                       WHAT without WHY

  Guard checkout against a           tells a reader what
  double-submit race                  changed AND why it
                                      mattered — this is the
  Two rapid clicks on submit          rest of the message:
  could both pass validation          the actual mechanism,
  before either write landed,         so a future reader
  double-charging the customer.       doesn't have to
  Adds a client-side disable-         reconstruct the bug
  on-submit plus a server-side        from the diff alone
  idempotency key.
```

```text
  → the commit message is documentation that lives BESIDE the
    code forever, surfaced automatically by `git blame` on
    exactly the lines that changed — for a subtle fix, it's
    frequently the only place the REASONING survives at all,
    since the code itself only shows the result.
```

## READMEs

```text
  the job of a README is answering, IN ORDER, the questions a
  new reader actually has:

    1. what IS this (one or two sentences, not a feature list)
    2. how do I RUN it (the fewest commands that work)
    3. how is it STRUCTURED, if that's non-obvious
    4. where do I go for MORE (a docs folder, an architecture
       doc, a specific person/channel)
```

```text
  → a README that leads with an exhaustive feature list before
    "how do I run this" has the order backwards — a new
    reader's first question is nearly always "can I get this
    running," and everything else can wait.
```

## Writing for the reader who doesn't have your context

```text
  the single biggest failure mode in technical writing: writing
  as though the reader already knows what YOU know right now,
  mid-project, with every recent Slack thread fresh in memory.

    "Update the config as discussed"    ✗ discussed WHERE,
                                            update it HOW,
                                            which config

  → name the specific file, the specific values, the specific
    reasoning — a reader arriving cold (a new hire, or you in
    eight months) has none of the context that made the vague
    version feel sufficient when you wrote it.
```

## What to take away

1. A design doc's options section — including the alternative you didn't
   pick and why — is what a future reader actually needs; it's also the
   section most commonly skipped.
2. A commit message's real value is the why a diff alone can't show — for a
   subtle fix, it's often the only place the reasoning survives at all.
3. A README should answer "what is this" and "how do I run it" before
   anything else — a feature list up front has the reader's actual priority
   backwards.
4. Write for a reader with none of your current context, not the version of
   the reader who was in the meeting where this got decided.
5. Documentation is the only place a system's "why" survives past the person
   who made the decision leaving — code alone only ever shows the "what."
