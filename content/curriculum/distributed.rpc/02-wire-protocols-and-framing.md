---
title: Wire protocols and framing
minutes: 22
summary: How bytes become messages, why head-of-line blocking shaped a generation of protocols, and how to choose.
---

Two processes exchanging structured data have to agree on more than a schema.
They must agree on where one message ends and the next begins, how many
conversations can share a connection, who may speak first, and what happens when
a packet is lost. Those decisions are the protocol, and they determine what
shapes of communication are even possible.

## Framing: the problem underneath everything

TCP gives you a **byte stream**, not messages. It guarantees the bytes arrive in
order, and nothing else. If you write two messages, the reader may receive them
in one read, or split across five reads, or glued together with half of a third.

```text
  sender writes:   [message A][message B]

  receiver may read:
    "[message A][mess"        ← one read, one and a half messages
    "age B]"                  ← the rest

  or:
    "[me" "ssage A][message B]"
```

So every protocol on TCP must add **framing** — a way to find message
boundaries. The three approaches:

```text
  1. LENGTH PREFIX          [4-byte length][payload...]
     fast, unambiguous, needs the length known before writing
     used by: gRPC, Thrift, Redis, most binary protocols

  2. DELIMITER              payload\r\n
     simple, human-readable, requires escaping the delimiter in content
     used by: HTTP/1.1 headers, SMTP, line-based protocols

  3. SELF-DESCRIBING        the encoding itself says where it ends
     e.g. a JSON parser knows the object closed at the matching brace
     used by: newline-delimited JSON streams (with a delimiter as backup)
```

HTTP/1.1 uses a delimiter for headers and then a length prefix
(`Content-Length`) for the body — or chunked encoding, which is a sequence of
length-prefixed chunks, for when the length is not known in advance. That mix is
the source of a nasty security bug class: **request smuggling**, where a proxy
and an origin server disagree about which framing rule applies, and an attacker
crafts a request that one sees as one message and the other sees as two.

## Head-of-line blocking, at three layers

The defining problem of the last two decades of protocol design, and it appears
at three different layers with three different fixes.

**HTTP/1.1: one request at a time per connection.**

```text
  connection: [────req A────][──req B──][─req C─]
                   slow           fast      fast

  B and C wait for A even though they are unrelated
```

Browsers worked around this by opening six connections per host, and web
developers worked around *that* with sprite sheets and file concatenation —
an entire generation of build tooling existed to fight a protocol limitation.

**HTTP/2: multiplexed streams, but still one TCP connection.**

```text
  connection: [A₁][B₁][C₁][A₂][C₂][B₂][A₃]...
              interleaved frames, each tagged with a stream ID
```

Application-layer head-of-line blocking is solved: a slow response no longer
blocks others. But TCP still guarantees in-order delivery of *bytes*, so a
single lost packet stalls every stream sharing that connection until it is
retransmitted.

```text
  packet loss on a shared TCP connection:

    A₁ B₁ [LOST] A₂ C₁ B₂ ...
                  ▲
    everything after the gap is buffered in the kernel and delivered
    to NOBODY until the retransmit arrives — including streams whose
    data made it through fine
```

On a clean data-centre network this rarely matters. On a mobile network with
2% packet loss it matters enormously, and HTTP/2 can be *slower* than HTTP/1.1
with six connections there.

**HTTP/3 (QUIC): streams are independent all the way down.**

QUIC runs over UDP and implements its own reliability *per stream*, so a lost
packet only stalls the stream it belonged to. It also folds the transport and
TLS handshakes into one round trip, and identifies connections by an ID rather
than the four-tuple — so a phone switching from Wi-Fi to cellular keeps the
connection instead of starting over.

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Transport | TCP | TCP | UDP (QUIC) |
| Concurrency | 1/connection | multiplexed | multiplexed |
| App-layer HOL blocking | yes | no | no |
| Transport HOL blocking | n/a | **yes** | no |
| Handshake round trips | 2–3 | 2–3 | 1 (0 on resume) |
| Header compression | none | HPACK | QPACK |
| Connection migration | no | no | yes |

## Text versus binary encoding

| | Text (JSON) | Binary (Protobuf) |
| --- | --- | --- |
| Size | baseline | 30–60% smaller typically |
| Encode/decode speed | baseline | 2–10× faster |
| Human-readable on the wire | yes | no |
| Schema required | no | yes |
| Tooling (curl, browser devtools) | universal | needs the schema |
| Numeric precision | ambiguous (JS floats) | exact, typed |
| Forward/backward compatibility | by convention | by design (field numbers) |

The size difference comes from removing field names from every message. JSON
sends `{"user_id":12345,"active":true}` — 31 bytes, most of it the same keys as
every other message. Protobuf sends the field *number* and a varint: about 5
bytes.

```text
  JSON:      {"user_id":12345,"active":true}
             └──────────── 31 bytes ────────┘

  Protobuf:  08 B9 60 10 01
             │  └───┘  │  └─ value: true
             │    │    └──── field 2, varint
             │    └───────── value: 12345 (varint)
             └────────────── field 1, varint
             └── 5 bytes ──┘
```

The honest trade: **binary formats cost you debuggability**. You cannot `curl`
an endpoint and read the answer, browser devtools show you nothing useful, and a
malformed message is opaque. That cost is real and is why JSON over HTTP remains
correct for public APIs and low-volume internal ones, and why gRPC's reflection
service and `grpcurl` exist to claw some of it back.

**The precision issue deserves emphasis.** JSON has one number type, and
JavaScript parses it as a 64-bit float, which represents integers exactly only up
to 2⁵³. A 64-bit ID serialised as a JSON number and read by a browser silently
loses precision:

```text
  sent:      9007199254740993
  received:  9007199254740992     ← off by one, no error anywhere
```

Every ID that may cross into JavaScript should be a **string** in JSON. This bug
is silent, data-dependent, and appears in production years after the API was
written.

## The four call shapes

Once a protocol supports multiplexed, bidirectional streams, RPC is not limited
to one-request-one-response. gRPC exposes four shapes, and choosing correctly is
a design decision:

```text
  UNARY                  client ──req──▶ server
                                ◀─res──
    the default. use unless you need otherwise.

  SERVER STREAMING       client ──req──▶ server
                                ◀─res──
                                ◀─res──
                                ◀─res──
    large result sets, subscriptions, progress updates.
    lets the client start processing before the server finishes.

  CLIENT STREAMING       client ──req──▶ server
                                ──req──▶
                                ──req──▶
                                ◀─res──
    uploads, batched metrics, anything the client produces incrementally.

  BIDIRECTIONAL          client ◀─────▶ server
    chat, live collaboration, long-lived control channels.
```

Server streaming is the most under-used. Returning 100,000 rows as one unary
response means the server buffers all of it, the client waits for all of it, and
both hold the whole set in memory. Streaming it means constant memory on both
sides and first results in milliseconds. Any endpoint whose response size is
unbounded should stream or paginate — a unary endpoint returning "all of them"
is a memory incident waiting for a large customer.

## Choosing a protocol

| Situation | Choice |
| --- | --- |
| Public API, third-party consumers | JSON over HTTP/1.1 or /2 |
| Internal service-to-service, high volume | gRPC (Protobuf over HTTP/2) |
| Browser client | JSON over HTTP; gRPC-Web if you must |
| Streaming server→client to a browser | Server-Sent Events, or WebSocket |
| Bidirectional, low latency, browser | WebSocket |
| Mobile client, lossy network | HTTP/3 where available |
| Very high throughput, same data centre | gRPC, or a custom binary protocol |
| Fire-and-forget, decoupled | Not RPC — a message broker |

Two practical notes. **gRPC does not work natively in browsers** because
browsers do not expose the HTTP/2 framing layer to JavaScript; gRPC-Web needs a
proxy that translates, which is real operational weight. And **HTTP/2 to a
single backend behind a naive L4 load balancer will not balance**: one long-lived
connection carries every request, so it all lands on one instance. This is a
surprisingly common production incident, and the fix is an L7 load balancer that
balances at the request level, or client-side load balancing.

## What to take away

1. TCP is a byte stream, so every protocol needs framing. Length prefixes are
   the usual answer; disagreement about framing rules is what request smuggling
   exploits.
2. Head-of-line blocking appears at the application layer (HTTP/1.1), at the
   transport layer (HTTP/2 over TCP), and is only fully removed by QUIC.
3. Binary encodings are smaller and faster and cost you the ability to read the
   wire. That cost is why JSON remains right for public APIs.
4. JSON numbers are JavaScript floats. Send 64-bit IDs as strings.
5. Streaming shapes are under-used; any endpoint with an unbounded response
   should stream or paginate rather than buffer.
6. HTTP/2's long-lived connections defeat L4 load balancing — balance at L7 or
   in the client.

Next: delivery semantics — at-most-once, at-least-once, and why exactly-once is
a claim you should always interrogate.
