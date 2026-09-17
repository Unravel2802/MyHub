---
title: Governance and lineage
minutes: 17
summary: Catalogs, lineage, and knowing where a column came from — privacy and compliance's rules, made technically enforceable across an entire data platform.
---

The Privacy and Compliance chapter established the rules a system must
follow: data minimization, retention limits, the right to deletion. This
chapter is the infrastructure that makes those rules technically
ENFORCEABLE across a genuinely large, sprawling data platform — because a
rule nobody can actually verify or trace through the system isn't really a
rule, it's a hope.

## The problem at scale: nobody knows where a column actually came from

```text
  a warehouse with THOUSANDS of tables, built by DOZENS of
  different pipelines, over YEARS, by people who've since left
  the team — a column named `user_region` appears in FIFTEEN
  different downstream tables.

  → does it come from the user's SIGNUP address, their CURRENT
    billing address, or their LAST-KNOWN IP-geolocated
    location? WITHOUT lineage tracking, answering this requires
    someone MANUALLY tracing through pipeline code, transformation
    by transformation, hoping the relevant person who actually
    knows is still reachable and remembers — a genuinely
    common, real, and expensive problem at scale.
```

## Lineage: tracking data's actual path through the system

```text
  raw_events.user_id
       ↓ (joined with)
  users.region
       ↓ (transformed by models/user_region.sql)
  dim_users.region
       ↓ (aggregated by)
  dashboard: "Revenue by Region"

  → LINEAGE tracks this ENTIRE chain automatically — this is
    the Observability chapter's distributed-tracing idea (a
    span per hop through a system), applied to DATA flowing
    through TRANSFORMATIONS instead of a REQUEST flowing
    through services — "where did this number ultimately come
    from" becomes a traceable QUERY against tracked lineage
    metadata, rather than an archaeological dig through years
    of git history and pipeline code that may or may not still
    even exist.
```

```text
  → the CONCRETE, high-stakes payoff: when a data QUALITY issue
    IS found upstream (the Data Quality chapter's failed check,
    or a bug discovered after the fact), lineage answers
    "what downstream is AFFECTED" DIRECTLY and completely —
    without it, a genuinely serious upstream data bug's full
    downstream blast radius is essentially unknowable with any
    real confidence, which makes correctly and completely
    fixing it downstream, everywhere it actually spread,
    nearly impossible to do with confidence.
```

## Data catalogs: making data discoverable, not just correct

```text
  → a CATALOG is a searchable INVENTORY of what data EXISTS,
    where, with WHAT MEANING — table X contains customer
    orders, column Y is net revenue AS DEFINED in the
    analytics-engineering chapter's specific model, column Z is
    deprecated and superseded by a newer table entirely.

  → without a catalog, "does data about X already exist
    somewhere" is answered by asking around informally (Slack,
    word of mouth, whoever happens to remember) rather than by
    an actual, reliable, searchable SOURCE — which is precisely
    how the SAME analysis ends up being independently, wastefully
    rebuilt by three different teams who each had no reliable
    way to discover the other two had already solved this exact
    problem.
```

## Access control at the data layer

```text
  → the AuthN/AuthZ chapter's principles, applied specifically
    to DATA: not every column should be readable by every
    person with GENERAL warehouse access — PII columns
    specifically (the Privacy and Compliance chapter's
    territory) need ROW-level and COLUMN-level access control,
    not just table-level all-or-nothing access, since a table
    can perfectly reasonably contain BOTH freely-shareable
    aggregate metrics AND genuinely sensitive individual-level
    PII, side by side in the very same table.
```

```text
  → this is LEAST PRIVILEGE (the Security Foundations chapter),
    applied at exactly the granularity data governance actually
    needs: an analyst genuinely needs aggregate REVENUE numbers
    for their normal, everyday work — that same analyst rarely
    has any genuine business need for individual customers'
    RAW EMAIL ADDRESSES, and column-level control is what lets
    a system grant EXACTLY the first without also, as an
    unnecessary side effect, granting the second along with it.
```

## Retention and deletion, made technically enforceable

```text
  → the Privacy and Compliance chapter established data
    minimization and retention as PRINCIPLES — governance
    tooling is what makes them technically, mechanically
    ENFORCED rather than merely documented, hoped-for POLICY:
    an automated retention job that actually deletes data past
    its stated retention window, and — genuinely much harder —
    a "delete THIS user's data" request that lineage tracking
    can trace across EVERY downstream table the user's data
    ever actually propagated into, rather than relying on a
    human manually, and inevitably imperfectly, trying to
    remember every single place it might have ended up.
```

## What to take away

1. Without lineage tracking, "where did this number come from" requires a
   manual archaeological dig through pipeline code and hoping the relevant
   person still remembers — lineage makes it a traceable query instead.
2. Lineage's highest-stakes payoff is answering "what downstream is
   affected" when a data quality issue is found upstream, completely and
   directly, rather than leaving the true blast radius essentially unknowable.
3. A catalog makes existing data discoverable, preventing the same analysis
   from being independently, wastefully rebuilt by teams with no reliable
   way to discover it already exists.
4. Column-level (not just table-level) access control is least privilege
   applied at the granularity data governance actually needs — a table can
   hold both freely-shareable aggregates and genuinely sensitive PII side
   by side.
5. Governance tooling turns retention and deletion from documented policy
   into mechanical enforcement — an automated retention job, and lineage-
   traced deletion that reaches every downstream table a user's data ever
   propagated into.
