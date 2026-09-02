---
title: The eight fallacies in practice
minutes: 22
summary: Each false assumption, the bug it produces, and what the code looks like when you stop making it.
---

The eight fallacies are usually quoted as a list and then forgotten. They are
more useful as a **checklist for reviewing a design**, because each one maps to
a specific defect that appears in real code. This chapter walks through them in
that form: the assumption, the failure it causes, and the change that removes it.

## 1. The network is reliable

**The assumption:** if I send a request, it arrives; if I get no error, it
worked.

**What actually happens:** packets are dropped, connections are reset, a switch
reboots, a cable is unplugged, a security group changes, DNS returns something
stale. Cloud providers publish single-digit-percentage error rates for
cross-zone calls under load, and the number is never zero.

**The bug it produces** — the unhandled remote call:

```python
def place_order(cart):
    order = db.insert(cart)          # succeeded
    inventory.reserve(order.items)   # ← throws. now what?
    email.send(order.customer)       # never runs
    return order
```

The order exists, the stock was never reserved, and nobody was told. The system
is now inconsistent and nothing recorded that fact.

**The fix** is not a `try/except` around each line; it is deciding, per call,
what "failed" means:

```python
def place_order(cart):
    order = db.insert(cart, status="pending")   # durable record FIRST
    outbox.enqueue("reserve_stock", order.id)   # same transaction as the insert
    outbox.enqueue("send_confirmation", order.id)
    return order
    # a worker drains the outbox with retries; the order's status is the truth
```

The pattern — write the intent durably, then act on it asynchronously with
retries — is the **transactional outbox**, and it is the standard answer to
"this call might not happen". You will meet it again in distributed transactions.

## 2. Latency is zero

**The assumption:** a call to another service is roughly as cheap as a call to
another class.

**What actually happens:** an in-process call is ~1 ns. A call within a data
centre is ~500 µs. That is a factor of **500,000**.

```text
  in-process call     ▏                                  1 ns
  memory read         ▏                                100 ns
  SSD read            ▎                                100 µs
  same-DC round trip  ▊                                500 µs
  cross-region        ██████████████████████████        70 ms
  cross-continent     ████████████████████████████████ 200 ms
```

**The bug it produces** — the N+1 over the network, which is the single most
common performance defect in service architectures:

```python
orders = order_service.list(user_id)          # 1 call
for o in orders:                              # 200 orders
    o.product = product_service.get(o.sku)    # 200 more calls
# 201 round trips × 2 ms = 400 ms of pure network
```

**The fix** is to batch, and to design APIs that make batching possible:

```python
orders = order_service.list(user_id)
skus = {o.sku for o in orders}
products = product_service.get_many(skus)     # ONE call
```

Two round trips instead of 201. Note that the API had to *offer* `get_many` —
a service whose interface only supports single-item fetches has forced its
callers into N+1 forever. Designing for batch access is an API responsibility.

## 3. Bandwidth is infinite

**The assumption:** payload size does not matter much.

**What actually happens:** it dominates once payloads get large, and it costs
money on cross-zone and egress traffic. Serialisation and deserialisation CPU is
frequently a bigger cost than the transfer itself.

**The bug it produces** — `SELECT *` over the wire. An endpoint returns the full
object because it was easy, the client uses two fields, and you are moving 40 KB
per item to display a list of names.

**The fix:** field selection (GraphQL's central argument, and why `?fields=` and
sparse fieldsets exist in REST), pagination that is mandatory rather than
optional, compression, and a binary format when volume justifies it. Ask what
the *response size at p99* is, not just the latency.

## 4. The network is secure

**The assumption:** traffic inside the perimeter is trustworthy.

**What actually happens:** a single compromised pod, a misconfigured security
group, a leaked credential, or a supplier's breach puts an attacker inside. The
perimeter model fails the moment anything crosses it.

**The bug it produces:** internal services with no authentication, because "only
our services can reach it" — until a server-side request forgery in a public
endpoint lets an attacker make requests *from* inside.

**The fix** is zero trust: every call authenticated and encrypted regardless of
origin. mTLS between services, short-lived credentials, per-service identity,
and authorisation checks at every service rather than only at the gateway.

## 5. Topology doesn't change

**The assumption:** the set of machines, and their addresses, is stable.

**What actually happens:** autoscaling adds and removes instances, containers
are rescheduled onto different hosts, deploys roll, spot instances are reclaimed
with two minutes' notice. In a Kubernetes cluster the topology changes
constantly by design.

**The bug it produces** — the cached IP address:

```python
BACKEND = socket.gethostbyname("payments.internal")   # resolved ONCE at import
```

The pod behind that address is replaced during the next deploy, and this process
keeps sending to an address that no longer answers, until it is restarted.

**The fix:** resolve through service discovery on each use (or with a short TTL),
honour DNS TTLs rather than caching forever, use health checks to remove dead
endpoints from a pool, and drain connections gracefully on shutdown so in-flight
requests finish.

## 6. There is one administrator

**The assumption:** someone understands the whole system and can coordinate a
change across it.

**What actually happens:** different teams own different services, on different
release cadences, with different on-call rotations, and increasingly you depend
on third parties nobody in your company controls.

**The bug it produces:** the coordinated deploy. A change that requires service
A and service B to ship simultaneously, which means a maintenance window, which
means it happens at 2am, which means it happens badly.

**The fix** is versioned, backward-compatible contracts and the
**expand/contract** pattern:

```text
  1. EXPAND   add the new field; both old and new readers work
  2. MIGRATE  deploy writers that populate it; backfill existing data
  3. MIGRATE  deploy readers that use it
  4. CONTRACT remove the old field, once nothing reads it

  at every step, any mix of old and new versions is running and correct
```

Four boring deploys instead of one dangerous one. This is the same shape as a
zero-downtime schema migration, and for the same reason: you cannot change two
independently deployed things at the same instant.

## 7. Transport cost is zero

**The assumption:** moving data is free in CPU and in money.

**What actually happens:** serialisation costs real CPU — JSON encoding can
consume a substantial share of a service's cycles at high request rates — and
cross-zone and egress bytes are line items on a cloud bill that regularly
surprise people.

**The bug it produces:** chatty service meshes that spend more compute on
serialisation than on business logic, and an architecture whose data-transfer
bill exceeds its compute bill.

**The fix:** binary formats where volume warrants (Protobuf, Avro), compression,
keeping chatty pairs of services in the same zone, and — most effective — not
splitting two components that talk constantly. If A calls B on every request and
they share a data model, they may want to be one deployable.

## 8. The network is homogeneous

**The assumption:** all links, machines and clients behave the same.

**What actually happens:** you have a fast local network, a slower cross-zone
link, a much slower cross-region link, and clients on 3G in a tunnel. Different
services run different language runtimes with different timeout defaults,
different TLS versions, and different ideas about what a JSON number is.

**The bug it produces:** one timeout value used everywhere. Two seconds is
generous for a local call and far too short for a cross-region one, so you get
spurious failures on the slow path and unbounded waits on the fast one.

**The fix:** timeouts derived from measured p99 per dependency, deadline
propagation so a budget is shared down a call chain rather than reset at each
hop, and explicit schemas at boundaries so two runtimes cannot disagree about
what a 64-bit integer is. (They will. JavaScript's `Number` loses precision above
2⁵³, which is why every ID that crosses into a browser should be a string.)

## Using this as a review checklist

The practical form. For each remote call in a design, ask:

```text
  □  What happens if this never returns?
  □  Is this inside a loop?  (fallacy 2)
  □  How big is the p99 response?  (fallacy 3)
  □  Is the callee authenticated and authorised?  (fallacy 4)
  □  How is the address resolved, and how often?  (fallacy 5)
  □  Can the caller and callee deploy independently?  (fallacy 6)
  □  What does this cost per million calls, in CPU and dollars?  (fallacy 7)
  □  Where did this timeout number come from?  (fallacy 8)
```

Eight questions, and they will find more real defects in an hour of design
review than a week of load testing.

## What to take away

1. Each fallacy is true inside one process and false between two — which is why
   they are so easy to carry across the boundary without noticing.
2. Fallacy 1's answer is durability before action: write the intent, then act
   with retries. The transactional outbox is the standard shape.
3. Fallacy 2's signature bug is the N+1 over the network, and preventing it is an
   API design responsibility, not only a caller discipline.
4. Fallacy 5 means addresses are not stable; resolve through discovery and drain
   connections on shutdown.
5. Fallacy 6 means you can never change two independently deployed things at
   once — expand/contract is the general answer.
6. The eight make a better review checklist than a list to memorise.

Next: partial failure — the one property with no single-process analogue, and
why "did it work?" can be genuinely unanswerable.
