---
title: Licensing and open source
minutes: 13
summary: Copyleft vs permissive, and the dependency obligations that turn a license choice into an actual legal question.
---

Every dependency in a project came with a license, whether anyone read it or
not, and that license is a real legal constraint on what you can do with the
code — not a formality. This chapter is enough to recognize the questions
that need a real answer, not enough to substitute for one.

## Permissive vs copyleft

```text
  PERMISSIVE (MIT, Apache 2.0, BSD)
    → use, modify, distribute, even in CLOSED-SOURCE
      commercial software, with minimal obligation (usually:
      keep the license notice, and for Apache 2.0, don't use
      the project's trademark to imply endorsement)

  WEAK COPYLEFT (LGPL, MPL)
    → modifications to the LICENSED FILES themselves must be
      shared under the same license if distributed — but
      code that merely LINKS to it (without modifying it)
      often stays under its own license

  STRONG COPYLEFT (GPL, AGPL)
    → any work that INCORPORATES or LINKS the code becomes
      subject to the SAME license when distributed — the
      "viral" property that gives copyleft its reputation

    AGPL specifically extends this to a SERVICE offered over a
    network, not just DISTRIBUTED code — running a modified
    AGPL program as a hosted service triggers the same
    obligation that shipping a binary would under GPL
```

```text
  → the practical trigger is almost always DISTRIBUTION (or,
    for AGPL, network use) — internal, never-distributed use
    of GPL code inside a company generally does not trigger
    the share-alike obligation, which is why the license
    matters enormously more for something you SHIP than for
    an internal tool nobody outside the company ever touches.
```

## Why this reaches legal, not just engineering

```text
  the question "can we depend on this library" is a LEGAL
  question the moment the answer depends on:

    ✗  are we distributing our own code that links to a
       copyleft dependency?
    ✗  does our LICENSE MODEL (say, closed-source commercial)
       conflict with an obligation the dependency imposes?
    ✗  does a dependency's license have a PATENT clause that
       interacts with our own patents?

  → an individual engineer picking a dependency because "it
    has the most GitHub stars" can accidentally create a real
    legal exposure — this is exactly why many companies
    maintain an APPROVED dependency license list (permissive
    only, or specific approved exceptions) rather than leaving
    it to per-engineer judgment.
```

```text
  this project's own CLAUDE.md approved-dependency list is a
  small-scale version of the same discipline — for a different
  reason here (architectural consistency, not license risk),
  but the SHAPE — a pre-approved list rather than picking
  per-task — is the same pattern licensing compliance uses at
  larger scale.
```

## Dependency obligations beyond the license text

```text
  ATTRIBUTION      many licenses (including permissive ones)
                   require keeping the license notice/
                   copyright header — a build step that
                   strips comments can accidentally strip this

  LICENSE           a project depending on hundreds of
  AGGREGATION        packages transitively pulls in HUNDREDS
                   of licenses — a license SCANNER (checking
                   the full dependency tree, not just direct
                   dependencies) is how real projects catch a
                   copyleft dependency introduced three levels
                   deep, that nobody deliberately chose
```

## Contributing to open source

```text
  a CONTRIBUTOR LICENSE AGREEMENT (CLA), where a project
  requires one, grants the project the right to use your
  contribution under its license (and sometimes to relicense
  it later) — reading what you're agreeing to matters more
  for a CLA than for using someone else's code, since here
  you're the one granting rights away.
```

```text
  → contributing CODE WRITTEN AS PART OF YOUR JOB may not even
    be yours to license — many employment agreements assign
    IP created using company time/resources to the employer;
    check before contributing something built at work to an
    outside project.
```

## What to take away

1. Copyleft's obligation is almost always triggered by distribution (or, for
   AGPL, offering the code as a network service) — internal-only use
   generally doesn't trigger it, which is why the license matters far more
   for shipped code than for an internal tool.
2. "Can we depend on this" becomes a legal question the moment the answer
   depends on your own distribution model or a patent clause — which is why
   many companies maintain a pre-approved dependency license list.
3. Attribution requirements can be violated accidentally by a build step that
   strips comments/headers, not just by a deliberate choice to ignore them.
4. A license scanner over the full transitive dependency tree is how real
   projects catch a copyleft dependency introduced several levels deep that
   nobody chose deliberately.
5. Code written as part of a job may not be yours to contribute or relicense
   — check your employment agreement's IP assignment before contributing
   work-adjacent code to an outside project.
