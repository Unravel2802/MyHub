---
title: Operational ownership
minutes: 17
summary: "You build it, you run it" — the accountability structure the Incident Response chapter's mechanics assume already exists.
---

The Incident Response and Postmortems chapter covered how to actually
respond to an incident once one is happening. This chapter is the
structural question underneath that: WHO is on the hook for a 3am page, and
what makes that arrangement sustainable across months and years rather than
something that burns people out within a quarter.

## "You build it, you run it": the accountability shift

```text
  the OLD split: DEVELOPERS build a system and hand it off to a
  SEPARATE operations team, who runs it in production — the
  people making architectural decisions and the people paged at
  3am when those decisions cause a problem are DIFFERENT
  people, with genuinely different incentives.

  → the "you build it, you run it" model puts the SAME
    engineers on the hook for BOTH building AND operating —
    this is a genuine, deliberate INCENTIVE ALIGNMENT: an
    engineer who KNOWS they'll personally be the one paged for
    a fragile design has a real, direct, personal incentive to
    design it more robustly in the first place, in a way that a
    separate ops team simply never had the leverage to enforce
    from the outside.
```

## On-call: sustainable by design, not by heroics

```text
  → a rotation genuinely sustainable across MONTHS requires
    explicit, deliberate structure, not individual willpower or
    heroics from whoever happens to be on-call this week:

    ✓  a bounded SHIFT length (a week is common) with a clear
       HANDOFF to the next person
    ✓  COMPENSATION or explicit time-off for being on-call,
       recognizing it as REAL work, not a favor
    ✓  a genuine ESCALATION path for when the primary
       on-call is stuck, or the problem exceeds what they alone
       can reasonably handle
```

```text
  → the SLOs and Reliability Engineering chapter's TOIL concept
    applies directly here: an on-call rotation that's constantly,
    routinely paging for the SAME recurring, known issue is
    accumulating a specific, measurable, and genuinely fixable
    form of toil — and "we're used to it, it's just how it is"
    is precisely the failure mode that chapter warned about,
    treating chronic pain as an unavoidable, permanent fact of
    the job rather than a fixable, worth-fixing problem.
```

## Runbooks: institutional knowledge that survives someone being asleep

```text
  → a RUNBOOK (documented, step-by-step response for a KNOWN,
    previously-seen failure mode) is precisely the Technical
    Writing chapter's discipline applied to 3am incident
    response specifically — the person actually paged at 3am
    is, by definition, not at their sharpest, and a clear,
    tested, followable runbook turns "figure out a novel
    solution from first principles, exhausted, at 3am" into
    "follow these known, already-verified steps" for anything
    that's happened before and been documented since.
```

```text
  → a runbook that's never actually been TESTED (walked through
    for real, or at minimum reviewed carefully by someone other
    than its original author) is the SAME "untested backup is a
    hope, not a guarantee" problem the Running Databases in
    Production chapter already named — a runbook with a step
    that's silently, subtly wrong is discovered to be wrong at
    precisely the worst possible moment: during a live, real
    incident, by someone following it exactly as written and
    getting an unexpected result.
```

## Escalation: knowing when you're stuck, and asking sooner rather than later

```text
  → the recurring, damaging failure pattern: staying stuck,
    alone, on a hard problem far too long before escalating,
    out of a felt (but usually mistaken) sense that asking for
    help too early looks like a personal failure or an
    inadequacy.

  → the actual, correct framing: escalating PROMPTLY, once
    genuinely stuck, is the RESPONSIBLE choice, not a failure —
    the Incident Response chapter's mitigate-before-diagnose
    urgency applies directly: every additional minute spent
    stuck alone, before finally escalating, is a minute of
    ACTUAL, ONGOING user impact that escalating sooner could
    have shortened, regardless of how the delay might feel from
    the inside to the person stuck in it.
```

## Reducing operational burden is real, prioritizable engineering work

```text
  → automating away a recurring manual task, fixing the root
    cause of a recurring page (rather than the same person
    re-fixing the same symptom by hand every single time it
    recurs), or improving a system's genuine resilience so it
    pages LESS often in the first place, are all real, valuable
    engineering work — and this needs to be explicitly
    PRIORITIZED and scheduled, alongside feature work, or it
    perpetually loses out to whatever's more immediately
    visible and externally demanded, indefinitely, forever.
```

```text
  → this is the Platform and Developer Experience chapter's
    "measure toil so it becomes visible and prioritizable"
    discipline, applied specifically to on-call burden — an
    on-call rotation that's silently, gradually getting worse
    over time, with nobody tracking it explicitly, has no
    natural mechanism that reliably self-corrects on its own.
```

## What to take away

1. "You build it, you run it" aligns incentives directly — an engineer who
   knows they'll personally be paged for a fragile design has a real,
   personal reason to design it more robustly from the start.
2. A sustainable on-call rotation needs explicit structure (bounded shifts,
   real compensation, a genuine escalation path) — sustainability by design,
   not by individual heroics.
3. A runbook applies the technical-writing discipline to 3am response
   specifically, and an untested one is the same "hope, not a guarantee"
   problem an untested backup is — discovered wrong at the worst possible
   moment.
4. Escalating promptly once genuinely stuck is the responsible choice, not
   a personal failure — every minute spent stuck alone before escalating is
   a minute of ongoing user impact that escalating sooner would have
   shortened.
5. Reducing operational burden is real engineering work that needs explicit
   prioritization alongside feature work — the same toil-measurement
   discipline from platform engineering, applied to on-call specifically,
   since nothing self-corrects a silently worsening rotation on its own.
