---
title: Operational transformation
minutes: 19
summary: Adjusting operations to fit a changed document, and why the correctness conditions are so demanding.
---

Operational transformation was the first workable answer to collaborative
editing, published in 1989, and it powered Google Docs and most collaborative
editors for two decades. Its idea is elegant. Its correctness conditions are
demanding enough that several published algorithms turned out to be wrong.

## The idea

Keep integer positions, and when a remote operation arrives that was generated
against a different document state, **transform it** so it has the intended
effect on the current state.

```text
  document: "abc"

  Alice: Insert("X", 1)     applied locally → "aXbc"
  Bob:   Insert("Y", 2)     applied locally → "abYc"

  Alice receives Bob's Insert("Y", 2).
  Her document is "aXbc". Applying it verbatim gives "aXYbc" —
  Y is now before "b", which is not where Bob put it.

  TRANSFORM it against Alice's own concurrent operation:
    Alice's insert was at position 1 ≤ 2, so everything after
    shifted right by one.
    Insert("Y", 2)  →  Insert("Y", 3)

  applying the transformed op:  "aXbYc"   ✓ correct
```

The transformation function is written per pair of operation types:

```python
def transform(op_a, op_b):
    """Transform op_a so it applies correctly to a document
    that has already had op_b applied."""
    if op_a.type == INSERT and op_b.type == INSERT:
        if op_b.pos < op_a.pos:
            return Insert(op_a.char, op_a.pos + 1)
        if op_b.pos > op_a.pos:
            return op_a
        # SAME POSITION — a tie. must be broken DETERMINISTICALLY,
        # and both sides must break it the same way, or they diverge.
        return (Insert(op_a.char, op_a.pos + 1)
                if op_a.site_id > op_b.site_id else op_a)

    if op_a.type == INSERT and op_b.type == DELETE:
        return Insert(op_a.char, op_a.pos - 1) if op_b.pos < op_a.pos else op_a

    if op_a.type == DELETE and op_b.type == INSERT:
        return Delete(op_a.pos + 1) if op_b.pos <= op_a.pos else op_a

    if op_a.type == DELETE and op_b.type == DELETE:
        if op_b.pos < op_a.pos:
            return Delete(op_a.pos - 1)
        if op_b.pos == op_a.pos:
            return NoOp()          # both deleted the same character
        return op_a
```

The tie-break comment is the first sign of trouble: **any ambiguity must be
resolved identically on every replica**, and site id is an arbitrary rule that
both sides happen to share. Miss one such case and the replicas diverge silently.

## The correctness conditions

OT's correctness is stated as two properties, and the second is what makes it
hard.

```text
  TP1  (convergence for two concurrent operations)

    applying a then transform(b, a)
    must equal
    applying b then transform(a, b)

    → both replicas reach the same document. manageable.
```

```text
  TP2  (transformation is itself order-independent)

    transform(transform(c, a), transform(b, a))
      must equal
    transform(transform(c, b), transform(a, b))

    → transforming an operation against two others gives the same
      result regardless of the order you transform against.
```

TP2 must hold for **every triple of operation types under every interleaving**,
and it is genuinely difficult. Several published OT algorithms were later shown to
violate it, producing divergence in specific three-way concurrent cases — the kind
of bug that appears once a month in production and cannot be reproduced.

## The central-server shortcut

The practical escape, and it is why almost every deployed OT system has a server.

```text
  a CENTRAL SERVER orders all operations.

  every client transforms only against operations the server has
  already sequenced — a linear history, not a partial order.

  → TP2 is NEVER NEEDED, because operations are never
    transformed against two concurrent ones
```

```text
  client A          SERVER            client B
     │                 │                 │
     ├── op1 ─────────▶│                 │
     │                 ├── op1 ─────────▶│
     │                 │◀──────── op2 ───┤
     │◀── op2' ────────┤  (transformed against op1)
```

Google Docs works this way (its Wave-derived algorithm is server-ordered), and
so does virtually every OT product. The cost is that the server is required —
there is no peer-to-peer or fully offline mode without solving TP2 properly.

Each client also keeps a buffer of its own unacknowledged operations, and
transforms incoming server operations against that buffer before applying them.
That buffer is what allows local edits to apply instantly while the server
catches up, and managing it is most of the client's complexity.

## Undo, and why it is hard here

```text
  Alice types "X", Bob types "Y", Alice presses undo.

  → undo must remove Alice's "X" — not the last operation
    globally, which was Bob's "Y"
```

Undo in a collaborative editor is **selective**: it removes one specific past
operation while keeping everything after it. That requires computing the inverse
of an operation and transforming it forward past all subsequent operations,
which multiplies the number of transformation cases and is a well-known source of
OT bugs.

## The honest assessment

```text
  STRENGTHS
    + compact operations — no per-character metadata
    + a small document stays small on the wire and on disk
    + mature; two decades of production use at very large scale
    + naturally handles rich text and structured operations

  WEAKNESSES
    - TP2 is hard; published algorithms have been wrong
    - a central server is required in practice
    - no peer-to-peer, and offline support is limited by the
      buffer of unacknowledged operations
    - every new operation type multiplies the transformation cases
      (n operation types → n² transformation functions)
    - selective undo is genuinely difficult
```

That n² growth is the practical killer for a rich editor. Adding "set bold",
"insert table", "move block" each requires transformation functions against every
existing type, and each is another chance to get TP2 wrong.

## When OT is still the right choice

Despite the industry drift toward CRDTs, OT remains defensible:

```text
  ✓  you already have a central server and always will
  ✓  documents are large and metadata overhead matters
  ✓  you are maintaining an existing OT system that works
  ✓  the operation set is small and stable
  ✗  peer-to-peer or serverless sync
  ✗  long offline periods
  ✗  a rapidly growing set of operation types
```

The pragmatic reading: **OT is a fine choice for a server-mediated editor with a
stable operation set, and a poor choice for anything local-first.** New systems
mostly choose CRDTs because the constraints have shifted — offline support and
peer sync are now expected, and memory is cheap enough that metadata overhead
matters less than correctness.

## What to take away

1. OT keeps integer positions and transforms incoming operations against
   concurrent ones so they have the intended effect on the current state.
2. Any ambiguity — such as two inserts at the same position — must be broken
   identically on every replica, or they diverge silently.
3. TP1 gives convergence for two concurrent operations; TP2 requires
   transformation to be order-independent for every triple, and is where published
   algorithms have been wrong.
4. A central server that linearises operations removes the need for TP2 entirely,
   which is why nearly every deployed OT system has one.
5. Selective undo requires inverting an operation and transforming it forward, and
   is a recurring source of bugs.
6. OT suits a server-mediated editor with a stable operation set; its n²
   transformation growth and server requirement rule it out for local-first
   systems.

Next: CRDTs — abandoning indices entirely so no transformation is needed.
