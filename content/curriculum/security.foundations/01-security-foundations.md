---
title: Security foundations
minutes: 18
summary: Threat modeling and defense in depth — the mental model every other chapter in this track assumes you already have.
---

Every other chapter in this track has been referenced by name across
Backend, Infrastructure & Ops, and CS Foundations already — least privilege,
defense in depth, the attacker's view — because security isn't a separate
concern bolted onto a system afterward. It's a way of looking at a design
that this chapter makes explicit, so the rest of the track has a shared
vocabulary to build on.

## The attacker's view: assume, don't hope

```text
  the single mental shift underneath everything in this track:
  design as though an ATTACKER is actively looking for the gap,
  not as though users will only ever do what the UI intends.

    "users won't guess another user's URL"          ✗ HOPE
    "the authorization check runs regardless of      ✓ ASSUME
     what URL was guessed"                              an
                                                          attacker
                                                          WILL try
```

```text
  → this reframes nearly every design question: not "would a
    normal user do this," but "what happens if someone
    DELIBERATELY tries the thing the UI doesn't offer" — a
    request with a manually edited body, a URL with a guessed
    id, a script sending requests far faster than a human ever
    would. a system designed only for well-behaved input has,
    by construction, no plan for the input that actually
    matters most.
```

## Threat modeling: a structured way to ask "what could go wrong"

```text
  the practical exercise, usually run per system or per feature:

    1. WHAT are we building?      (a diagram of the system,
                                    its data flows, its trust
                                    boundaries)
    2. WHAT can go wrong?          (enumerate threats — STRIDE
                                    is a common checklist:
                                    Spoofing, Tampering,
                                    Repudiation, Information
                                    disclosure, Denial of
                                    service, Elevation of
                                    privilege)
    3. WHAT are we doing about it?  (a mitigation per
                                    significant threat)
    4. DID we do a good job?        (review — is the model
                                    actually complete, or did
                                    something get missed)
```

```text
  → the value isn't a perfect, exhaustive list — it's the
    STRUCTURED PROCESS forcing you to consider categories of
    attack (STRIDE's six letters) you wouldn't naturally think
    of unprompted. a system-design review that only asks
    "does it work" and never asks "what could go wrong"
    systematically misses an entire category of requirement.
```

## Trust boundaries: where the assumption changes

```text
  a TRUST BOUNDARY is any point where DATA CROSSES from a
  LESS-trusted context into a MORE-trusted one — user input
  arriving at your API, a request crossing from the public
  internet into your VPC (Practical Networking's boundary,
  security-specifically), a value read from a database that
  another process could have written.

  → EVERYTHING crossing a trust boundary is, by definition,
    UNTRUSTED until validated — this is precisely why the
    Serialization and Schemas chapter's "validate once, at the
    boundary" discipline exists: the boundary is exactly where
    trust actually changes, and validating anywhere else (too
    early, before the boundary; too late, after data has
    already been acted on) leaves a real gap.
```

## Least privilege: the default that limits the blast radius

```text
  → grant the MINIMUM access actually needed to do a job — not
    "the minimum access we can be bothered to configure," the
    minimum the task ACTUALLY requires, revisited over time as
    needs change (access that WAS needed and no longer is
    should be revoked, not left in place indefinitely "just in
    case").
```

```text
  → the value shows up specifically when something goes wrong,
    not when everything works: a compromised credential or a
    buggy service with BROAD permissions can do far more damage
    than one scoped narrowly — this is the Cloud Primitives
    chapter's IAM over-provisioning mistake, restated as the
    general principle it's an instance of.
```

## Defense in depth: no single layer is trusted alone

```text
  a WAF in front of the app + input validation IN the app +
  parameterized queries at the database layer + a database
  user with minimal table permissions

  → FOUR independent layers, each one attempting to stop the
    SAME category of attack (SQL injection, in this example)
    — the deliberate redundancy is the point: no SINGLE layer
    is trusted to be perfect, because none of them actually
    is. a bypass or bug in ANY ONE layer still leaves the
    others standing between an attacker and the actual damage.
```

```text
  → this is genuinely different from "just do the ONE best
    practice" — depth means MULTIPLE, independent, overlapping
    controls, specifically because any single control WILL
    eventually fail, get misconfigured, or be bypassed by a
    novel technique nobody anticipated when it was built.
```

## Security is a trade-off, not an absolute

```text
  PERFECT security (in the sense of zero risk) doesn't exist
  for any real, usable system — every control has a cost
  (development time, user friction, operational complexity),
  and the actual engineering question is always: is THIS
  control's cost justified by the RISK it reduces, for THIS
  specific system's actual threat model.

  → a bank's threat model and a hobby blog's threat model are
    genuinely different, and applying the bank's level of
    control to the blog (or vice versa) is a real engineering
    mistake in EITHER direction — over-securing wastes real
    effort and adds real friction for no corresponding benefit;
    under-securing leaves an actual gap. the right amount of
    security is a function of what's actually at risk, not a
    universal maximum to chase everywhere.
```

## What to take away

1. Design assuming an attacker will deliberately try what the UI doesn't
   offer, not hoping users only do what's intended — this reframes nearly
   every design question.
2. Threat modeling's value is the structured process (STRIDE's categories)
   forcing consideration of attack types you wouldn't naturally think of,
   not a claim of an exhaustive, perfect list.
3. Everything crossing a trust boundary is untrusted by definition — which
   is exactly why validating at the boundary, not before or after it, is
   the correct place to do it.
4. Least privilege limits blast radius specifically when something goes
   wrong — a compromised credential with broad permissions does far more
   damage than one scoped narrowly.
5. Defense in depth means multiple independent, overlapping controls
   because any single control will eventually fail — and the right amount
   of security is a trade-off tuned to a specific system's actual threat
   model, not a universal maximum.
