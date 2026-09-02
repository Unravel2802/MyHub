---
title: Building a collaborative application
minutes: 19
summary: The parts a CRDT does not give you — presence, undo, persistence, permissions and history.
---

A CRDT library solves convergence. A collaborative product needs a good deal more
than convergence, and the remaining parts are where most of the engineering time
goes. This chapter is what surrounds the data structure.

## The architecture

```text
  ┌──────── client ────────┐         ┌──────── client ────────┐
  │  local CRDT replica    │         │  local CRDT replica    │
  │  ├ edits apply         │         │                        │
  │  │  INSTANTLY          │         │                        │
  │  ├ local persistence   │         │                        │
  │  └ awareness state     │         │                        │
  └───────────┬────────────┘         └───────────┬────────────┘
              │                                  │
              └────────── sync server ───────────┘
                     relays updates; may or may
                     not understand the document
```

The property that shapes everything: **the client is the source of truth for its
own edits.** The server relays and persists; it does not arbitrate. That is what
makes offline work, and it is the main structural difference from an OT design.

The sync server can be genuinely dumb — a relay plus a durable log of updates —
which is a real operational advantage: it needs no document logic, so it never
needs to be upgraded in lockstep with clients.

## Presence and awareness

Cursors, selections and "who is here" are **not** part of the document, and
putting them in the CRDT is a common early mistake.

```text
  DOCUMENT STATE                    AWARENESS STATE
  ──────────────                    ───────────────
  persistent                        ephemeral
  every change matters              only the latest matters
  must converge                     stale entries are discarded
  in the CRDT                       NOT in the CRDT — a separate
                                    channel with a TTL
```

Cursor positions change on every keystroke. Storing them in the document would
add an update per keypress per user to a structure whose whole history is
retained. Awareness is a separate, lossy, last-write-wins channel with a
heartbeat, and entries expire when a client stops reporting.

**Cursor positions must be expressed as CRDT identities**, not integer offsets —
otherwise a remote insert moves everyone's cursor to the wrong place. This is the
index problem from the first chapter, reappearing where you least expect it, and
libraries provide "relative position" types precisely for it.

## Undo

Undo in a collaborative document must be **local** — undo my last change, not the
document's last change, which might be someone else's.

```text
  Alice types "X"
  Bob types "Y"
  Alice presses undo   →  must remove "X", not "Y"
```

The CRDT implementation is more tractable than OT's: each client keeps a stack of
the operations *it* generated, and undo applies the inverse of one of them —
which is itself a normal operation that merges like any other. No transformation
past subsequent operations is needed, because CRDT operations are already
position-independent.

The subtleties that remain:

```text
  □  scope — undo my changes, or my changes in this region?
  □  undoing an insert someone else has since edited
  □  redo after concurrent changes
  □  whether undo should be undoable by others (usually: no)
```

Most libraries provide an undo manager scoped to a client id, and this is worth
using rather than reimplementing.

## Persistence

```text
  CLIENT SIDE
    IndexedDB / SQLite — the document must survive a refresh,
    and must be available offline

  SERVER SIDE
    an append-only log of updates, plus periodic SNAPSHOTS

    ┌──────────────────────────────────────────┐
    │ snapshot @ update 5,000                  │
    │ then updates 5,001 ... 5,432             │
    └──────────────────────────────────────────┘

    a new client loads the snapshot and applies the tail,
    rather than replaying the whole history
```

Snapshotting is not optional for a long-lived document: replaying 100,000 updates
to open a file is a multi-second load. Snapshot on a schedule or an update count,
and keep enough of the log to serve clients that are behind — the same reasoning
as consensus log compaction.

## Access control

The hardest unsolved-ish part, and worth being clear-eyed about.

```text
  a CRDT converges by construction. it has no concept of
  "this edit was not allowed".

  a malicious client can generate ANY update and it will merge.
```

So permissions must be enforced **outside** the data structure:

```text
  SERVER-VALIDATED
    the sync server checks each update against permissions
    before relaying or persisting it
    → requires the server to understand the document, giving up
      the "dumb relay" advantage
    → the practical choice for most products

  CRYPTOGRAPHIC
    updates are signed; clients reject unauthorised ones
    → works peer-to-peer, and is a research area rather than
      a solved problem
```

**Fine-grained permissions are genuinely hard.** "Alice may edit section 3" is
difficult when sections are not stable objects — a section is a range of
identities that other people are concurrently editing, so its boundaries are
themselves in flux. Most products settle for document-level permissions (view,
comment, edit) for this reason, and that is a reasonable engineering answer rather
than a compromise to be embarrassed about.

## Versioning and history

The whole update history is present, which enables features that are otherwise
expensive:

```text
  ✓  time travel — reconstruct any past state
  ✓  attribution — who wrote each character
  ✓  named versions / checkpoints
  ✓  diffs between two points

  ✗  branching and merging like git is NOT free — CRDTs merge
     automatically and continuously, which is the opposite of
     git's model of explicit divergence and deliberate merge
```

That last point is worth stating because it surprises people who expect
git-shaped behaviour. A CRDT does not have branches; it has one continuously
converging state. Building explicit branches on top means keeping separate
documents and defining your own merge, which is back to the same problem.

## Choosing a library

```text
  Yjs        the most mature and the fastest. rich ecosystem of
             editor bindings, providers (WebSocket, WebRTC, IndexedDB).
             binary format, very compact. JS-first.

  Automerge  JSON-like documents, strong history and time-travel
             support, Rust core with bindings. cleaner data model,
             historically heavier — much improved recently.

  Loro       newer Rust implementation, competitive performance,
             good history support.

  Y-CRDT     Rust port of Yjs, for non-JS platforms.
```

**Do not implement your own.** A CRDT's correctness rests on proved algebraic
properties, and a sequence CRDT in particular is subtle enough that the published
algorithms took years to get right. The libraries above are tested against
adversarial interleavings in a way a bespoke implementation will not be.

## The checklist for a real product

```text
  □  awareness on a separate ephemeral channel, with a TTL
  □  cursors expressed as CRDT-relative positions
  □  local persistence, so a refresh loses nothing
  □  server snapshots plus a log tail
  □  client-scoped undo
  □  permissions enforced at the sync server
  □  a size cap and tombstone GC strategy for long-lived documents
  □  a plan for schema evolution — documents outlive app versions
  □  offline conflict UX: what does the user SEE after two weeks
     offline? merging silently may not be acceptable
```

The last two are the ones teams discover late. **Document schema evolution** is
the harder version of the messaging topic's problem: a document written by v1 of
your app must be readable by v5, and there is no re-encoding step because clients
hold their own replicas.

And the offline UX question is a product decision that the technology quietly
makes for you if you do not make it: a CRDT will merge two weeks of divergent
editing silently and convergently, and whether that is the right user experience
is not a question the library can answer.

## What to take away

1. The client is the source of truth for its own edits; the sync server relays and
   persists rather than arbitrating, which is what makes offline work.
2. Presence and cursors are ephemeral and belong on a separate lossy channel —
   and cursor positions must be CRDT identities, not offsets.
3. Undo is client-scoped and, unlike in OT, needs no transformation because CRDT
   operations are already position-independent.
4. Long-lived documents need server snapshots plus a log tail, or opening a file
   replays the entire history.
5. CRDTs have no concept of an unauthorised edit — permissions must be enforced at
   the sync server, and fine-grained ranges are genuinely hard.
6. Use a mature library; and decide deliberately what the user sees after a long
   offline period, because otherwise the library decides for you.

That completes collaborative editing. Next in the track: **cluster scheduling** —
deciding which machine runs which work.
