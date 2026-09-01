---
title: Why replicate, and the three architectures
minutes: 19
summary: Four different goals that all get called "replication", and the three shapes that serve them.
---

"We should replicate the database" is four different projects wearing one name,
and they want different architectures. Getting the goal explicit first is what
stops a team building a read-scaling setup and then discovering it does not
survive a data-centre failure.

## The four goals

**1. Availability.** Survive a machine, rack, zone or region failing. Requires
copies in separate failure domains, and requires that a copy can *take over* —
which is a different problem from having the data.

**2. Read throughput.** Serve reads from many machines. Works only when reads
vastly outnumber writes, because every replica must apply every write. Ten
replicas do not give you ten times the write capacity; they give you ten times
the write *work*.

**3. Latency.** Put a copy near the user. A read from a local replica is 1 ms
where a cross-continent read is 150 ms.

**4. Durability.** Survive losing a disk. Distinct from availability: a backup
gives durability without availability, and a replica in the same rack gives
neither against a rack failure.

These pull in different directions, and knowing which one you are buying tells
you what to give up:

```text
  availability   → needs replicas in SEPARATE failure domains
  read scaling   → needs many replicas, tolerates them being stale
  latency        → needs replicas near users, i.e. far from each other
  durability     → needs writes on stable storage in >1 place BEFORE ack
```

Note the tension between 3 and everything: replicas near users are far apart, so
keeping them consistent costs the speed of light. That is the trade the whole
rest of the track keeps returning to.

And the thing replication does **not** give you:

> **Replication is not backup.** A replica faithfully reproduces `DROP TABLE
> orders` in under a second. It protects against hardware failure, never against
> a bad deploy, a buggy migration, or ransomware. You need both, and you need to
> have restored from the backup recently enough to know it works.

## The three architectures

Every replication system is one of these three, or a hybrid.

```text
  SINGLE LEADER                MULTI LEADER              LEADERLESS

      ┌───┐                    ┌───┐   ┌───┐            ┌───┐ ┌───┐ ┌───┐
   ┌─▶│ L │◀── writes          │ L │◀─▶│ L │◀ writes    │ N │ │ N │ │ N │
   │  └─┬─┘                    └─┬─┘   └─┬─┘            └─┬─┘ └─┬─┘ └─┬─┘
   │    │                        │       │                └──┬──┴──┬──┘
   │  ┌─▼─┐  ┌───┐             ┌─▼─┐   ┌─▼─┐                 │     │
   │  │ F │  │ F │             │ F │   │ F │            client writes to
   │  └───┘  └───┘             └───┘   └───┘            and reads from
   │   reads  reads                                     SEVERAL nodes

  one node accepts writes      several accept writes    no leader at all
  conflicts impossible         conflicts guaranteed     conflicts likely
  Postgres, MySQL, MongoDB     multi-region MySQL,      Dynamo, Cassandra,
  Kafka partitions             CouchDB, CRDTs           Riak, S3
```

| | Single leader | Multi leader | Leaderless |
| --- | --- | --- | --- |
| Write conflicts | impossible | must be resolved | must be resolved |
| Write availability | lost during failover | high | high |
| Local write latency | one region only | every region | every region |
| Operational complexity | low | **high** | medium |
| Ordering | total, per leader | per-leader only | none inherent |

**Default to single leader.** It is what every relational database does, it makes
conflicts structurally impossible, and it gives you a total order for free. Move
off it only when a specific requirement forces you: writes must continue during a
partition, or writes must be local in several regions. Those are real
requirements, and they are rarer than the architectural enthusiasm for
multi-master suggests.

## What actually gets replicated

The choice of *what* to ship between nodes has consequences people meet later.

**Statement-based** — send the SQL. Compact, and broken by anything
non-deterministic:

```sql
UPDATE orders SET updated_at = NOW() WHERE id = 7;
-- executes at a different instant on each replica → divergence
```

`NOW()`, `RANDOM()`, `UUID()`, auto-increment interactions, and triggers all
produce different results on the replica. MySQL supported this and then largely
moved away from it for exactly these reasons.

**Write-ahead log shipping** — send the physical log the storage engine already
writes. Efficient and exact, because it describes byte-level page changes.

```text
  WAL: "page 4711, offset 128, write these 46 bytes"
```

The cost is that it is tied to the storage format, so **the leader and follower
must run compatible versions**. This is why a Postgres major-version upgrade
cannot be done by simply upgrading the replica first — physical replication does
not work across major versions, and you need logical replication or a dump.

**Logical (row-based)** — send the rows that changed, in a format independent of
storage layout.

```text
  UPDATE orders: id=7, before {status:'paid'}, after {status:'shipped'}
```

Larger than physical replication, and decoupled from the storage engine — which
is what makes cross-version replication, and replication into a *different*
system, possible. This is the mechanism behind change data capture: Debezium
reads Postgres's logical replication stream and publishes to Kafka, letting a
search index or a data warehouse follow the database without any application
code.

**Application-level (dual writes)** — the application writes to both stores.

```python
db.save(order)
search_index.save(order)     # ← crash here and they diverge, permanently
```

This looks simplest and is the one to avoid. There is no transaction spanning the
two, so any failure between them leaves permanent divergence with nothing to
detect it. Use CDC from the database's own log instead — the log is already the
source of truth, and reading it means the two can never disagree about what
happened.

## Synchronous, asynchronous, and the middle

The single most consequential setting in any replication system: **when does the
leader tell the client "committed"?**

```text
  SYNCHRONOUS                        ASYNCHRONOUS

  client ──write──▶ L                client ──write──▶ L
                    │                                  │  ack immediately
                    ├──▶ F (ack)                       ├──▶ F (eventually)
                    │                                  │
         ◀──ack──── ┘  only after F                    ◀─ ack (before F)

  no data loss on leader failure     leader failure loses recent writes
  write latency = slowest replica    write latency = leader only
  a slow replica blocks ALL writes   a slow replica affects nobody
  a dead replica blocks ALL writes   a dead replica affects nobody
```

The asymmetry is stark and it is why **fully synchronous replication to all
replicas is almost never used**: it makes availability *worse*, because now every
replica is a single point of failure for writes. One slow disk anywhere stalls
the entire system.

**Semi-synchronous** is the practical middle: acknowledge when *at least one*
(or a quorum of) replicas has the write.

```text
  leader + 2 followers, wait for 1 follower

  ✓ survives leader failure with no data loss
  ✓ one slow follower does not block (the other one acks)
  ✓ write latency = second-fastest node, not slowest
```

This is Postgres's `synchronous_standby_names` with `ANY 1 (...)`, MySQL's
semi-sync, and the shape of every quorum system. It is the default worth reaching
for when the data matters.

The honest arithmetic on async: with asynchronous replication, a leader failure
loses every write not yet shipped. At 100 ms of replication lag and 1,000
writes/second, that is **100 acknowledged writes gone**, and the clients were
told they succeeded. Whether that is acceptable is a product decision — it is
fine for a view counter, not for orders — but it must be a *decision*, because
the default in most systems is async.

## Chain and other topologies

How replicas are wired matters at scale:

```text
  STAR (leader → all)          CHAIN                  TREE

     L                          L → F → F → F          L
   ↙ ↓ ↘                                             ↙   ↘
  F  F  F                                           F     F
                                                   ↙ ↘   ↙ ↘
                                                  F   F F   F

  simple; leader's outbound     lowest leader load;     used at large
  bandwidth is the limit        lag accumulates         replica counts
                                per hop; a middle
                                node failing breaks
                                the chain
```

With 50 replicas, a star topology means the leader sends every write 50 times,
and its network becomes the bottleneck long before its CPU does. Trees or chains
fan the work out. The trade is failure handling: a broken link in a chain stalls
everything behind it, so systems using them need explicit repair logic.

## What to take away

1. "Replication" names four different goals — availability, read throughput,
   latency, durability — that want different arrangements. Decide which one first.
2. Replication is not backup: it reproduces your mistakes faithfully and
   immediately.
3. Single leader is the default because conflicts become structurally impossible
   and ordering is free. Move off it only for a specific requirement.
4. Physical WAL shipping is efficient but version-locked; logical replication is
   what enables cross-version and cross-system flows like CDC.
5. Application-level dual writes have no transaction spanning them and diverge
   permanently on any failure — use CDC from the log instead.
6. Fully synchronous replication makes availability worse; semi-synchronous —
   ack when one replica or a quorum has it — is the practical choice when data
   matters.

Next: leader-follower replication in detail, and the lag that makes a replica's
answers wrong.
