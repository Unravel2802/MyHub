---
title: The collaborative editing problem
minutes: 18
summary: Why a shared document cannot use a lock, and what convergence has to mean instead.
---

Two people typing in the same document is the hardest consistency problem in
ordinary software. Every keystroke is a write, latency must be zero, the network
will drop, and the result must be something both people recognise as their
document. None of the mechanisms so far — locks, leaders, transactions — survive
those requirements.

## Why the usual answers fail

```text
  LOCK THE DOCUMENT
    one editor at a time. this is not collaboration.

  LOCK A PARAGRAPH
    better, and still: whose paragraph? what if I edit across
    the boundary? and locks over a network need leases,
    fencing, and a round trip per acquisition.

  SEND TO A SERVER AND WAIT
    every keystroke costs a round trip. at 100 ms that is
    unusable — typing must be instantaneous locally.

  LAST WRITE WINS
    two people typing means one person's paragraph vanishes.
```

The requirements, stated together, rule out everything conventional:

```text
  1. LOCAL FIRST     a keystroke applies immediately, no network
  2. OFFLINE         editing continues with no connectivity
  3. CONVERGENT      everyone ends at the same document
  4. INTENTION-      the result reflects what each person MEANT,
     PRESERVING      not merely some agreed state
```

Requirement 1 alone forces the design: if the edit applies locally before anyone
else knows about it, then **concurrent conflicting edits are guaranteed**, not
possible. Everything else is about making that safe.

## Convergence is not enough

A subtlety worth getting straight early. Two systems can both converge and one
can be useless.

```text
  document: "hello"
  Alice inserts "!" at the end     → "hello!"
  Bob deletes "hello"              → ""

  CONVERGENT but wrong: both end at ""  (Bob's delete wins)
     — Alice's intention is lost entirely

  CONVERGENT and reasonable: both end at "!"
     — the delete removed what existed; the insert survives
```

Convergence says the replicas agree. **Intention preservation** says the agreed
result is one a human would accept. The second is a design goal rather than a
theorem, and it is where the genuine difficulty lives: there is no formal
definition of "what the user meant", so systems encode heuristics and the
heuristics are the product.

The classic demonstration:

```text
  document: "abc"
  Alice: insert "X" at position 1   → "aXbc"
  Bob:   delete character at 1      → "ac"

  applying both naively, in either order, gives different results.
  and neither is obviously "right" — did Alice mean to insert
  before "b", or at index 1 whatever is there?
```

That ambiguity is why positions cannot be integers, which is the central insight
of both approaches that follow.

## The index problem

```text
  "hello world"
   0123456789

  Alice: insert "big " at index 6      → "hello big world"
  Bob:   insert "!" at index 11        → "hello world!"

  Bob's index 11 was computed against the ORIGINAL string.
  after Alice's insert, index 11 points somewhere else entirely.

  applying Bob's operation verbatim gives:  "hello big !world"
```

An index is a position **relative to a document state**, and the moment another
edit lands, that state no longer exists. Every solution to collaborative editing
is a way of dealing with this, and there are exactly two families:

```text
  OPERATIONAL TRANSFORMATION
    keep the integer indices, and TRANSFORM incoming operations
    against the ones already applied locally

  CRDTs
    abandon integer indices, give every character a unique
    IMMUTABLE identity, and define positions relative to those
```

OT adjusts the operation to fit the new state. CRDTs make the operation
state-independent so no adjustment is needed. The next two chapters take each in
turn.

## What convergence requires, formally

For any approach to converge without coordination, the merge operation must have
three properties:

```text
  COMMUTATIVE    merge(a, b) = merge(b, a)
                 → order of arrival does not matter

  ASSOCIATIVE    merge(merge(a,b), c) = merge(a, merge(b,c))
                 → grouping does not matter

  IDEMPOTENT     merge(a, a) = a
                 → duplicate delivery does not matter
```

These three map exactly onto the three things an unreliable network does:
**reorder, batch, and duplicate.** A merge with all three properties is immune to
all of them, which is why it needs no coordination — the network's misbehaviour
cannot change the result.

That is the theoretical core of CRDTs, and it is worth noticing it is the same
list as the delivery-semantics chapter's requirements for a robust consumer. A
version-checked, order-insensitive handler is a small CRDT.

## Beyond text

The problem shape recurs far outside document editing:

```text
  □  a shopping cart edited on a phone and a laptop
  □  a task list synced across devices, edited offline
  □  a design canvas with several cursors
  □  a distributed counter (likes, views)
  □  a set of tags edited by several services
  □  a spreadsheet cell edited by two people
  □  local-first applications generally
```

The last is the important one. **Local-first software** — applications that keep
a full replica on the device, work offline, and sync when they can — is a design
movement built entirely on these techniques. The user's data lives on their
machine, the network is an optimisation, and the sync is a merge rather than an
upload.

## The two families, previewed

```text
                    OT                        CRDT
  ─────────────────────────────────────────────────────────────
  positions         integer indices           unique immutable ids
  mechanism         transform operations      commutative merge
                    against concurrent ones
  server            usually REQUIRED to       not required —
                    order operations          peer-to-peer works
  metadata          small (ops are compact)   larger (ids per element)
  correctness       transformation functions  merge properties are
                    are famously hard to      provable
                    get right
  used by           Google Docs, historically  Figma, Linear, Automerge,
                    most editors               Yjs, Riak, Redis CRDTs
```

The industry has largely moved toward CRDTs for new systems, for one reason: **OT
correctness is a research problem and CRDT correctness is a proof.** Several
published OT algorithms were later shown incorrect, and the transformation
functions must handle every pair of operation types correctly under every
interleaving. A CRDT's merge either has the three algebraic properties or it does
not, and that is checkable.

The counter-argument, which is real: CRDTs carry more metadata, and for text
specifically the metadata can dwarf the document. That is the subject of the
fourth chapter.

## What to take away

1. Local-first editing makes concurrent conflicting edits guaranteed rather than
   possible — every other requirement follows from that.
2. Convergence (replicas agree) and intention preservation (the agreed result is
   acceptable to a human) are different goals; the second has no formal
   definition and is where the difficulty lives.
3. An integer index is a position relative to a document state that no longer
   exists once another edit lands.
4. Commutative, associative and idempotent merges are immune to the three things
   an unreliable network does: reorder, batch, duplicate.
5. OT transforms operations to fit the new state; CRDTs give elements immutable
   identities so no transformation is needed.
6. CRDTs have largely won for new systems because their correctness is provable,
   at the cost of carrying more metadata.

Next: operational transformation — the original approach, and why it is so hard
to get right.
