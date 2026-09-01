import type {
  Tier,
  Topic,
  TopicId,
  Track,
} from "@/src/modules/curriculum/types";

// The syllabus: thirteen tracks, each a small prerequisite graph.
//
// CODE, not a table — same call as roadmapCatalog.ts and achievementCatalog.ts.
// Adding a topic is a commit, because the graph's shape is an editorial claim
// ("you should understand replication before consensus") and editorial claims
// belong in review, not in a form.
//
// Two rules held throughout:
//
//   1. A topic is a THING YOU CAN LEARN, not a chapter. Chapters live on disk
//      under content/curriculum/<topicId>/ and appear as they get written, so
//      the graph can be complete on day one while the prose fills in behind it.
//   2. Prereqs are the ones that genuinely block understanding, not everything
//      vaguely upstream. An edge you would ignore in practice makes the whole
//      graph advisory, and then none of them get read.
//
// Cross-track prereqs are allowed and are meaningful ("Transformers needs
// Linear Algebra"), but only same-track edges are DRAWN — see types.ts.

// Positional helper rather than object literals: 159 topics of
// `{ id: ..., trackId: ..., label: ... }` is a file nobody rereads. trackId is
// derived from the id's prefix so the two can never disagree.
function t(
  id: TopicId,
  label: string,
  tier: Tier,
  prereqs: readonly TopicId[],
  summary: string,
): Topic {
  return { id, trackId: id.split(".")[0], label, summary, tier, prereqs };
}

// Thirteen tracks, eleven hues (moduleHues.ts). Two tracks therefore share a
// hue with another; the pairs chosen are the ones furthest apart in the picker
// list, since a track's hue only ever has to distinguish it from its
// neighbours in that list and from nothing at all in the graph, where one
// track is on screen at a time.
export const TRACKS: readonly Track[] = [
  {
    id: "foundations",
    label: "CS Foundations",
    blurb:
      "The layer under every other track: how a machine, a program and a network actually work.",
    hue: "cyan",
  },
  {
    id: "craft",
    label: "Software Craft",
    blurb:
      "Writing code other people — including future you — can change without fear.",
    hue: "amber",
  },
  {
    id: "backend",
    label: "Backend Engineering",
    blurb: "Servers, data, and the contracts between them.",
    hue: "blue",
  },
  {
    id: "frontend",
    label: "Frontend Engineering",
    blurb:
      "The browser as a runtime, and building interfaces that hold up in it.",
    hue: "fuchsia",
  },
  {
    id: "distributed",
    label: "Distributed Systems",
    blurb:
      "What changes once one machine becomes many and the network can lie.",
    hue: "violet",
  },
  {
    id: "systems-design",
    label: "Systems Design",
    blurb:
      "Turning requirements into an architecture, out loud, under time pressure.",
    hue: "teal",
  },
  {
    id: "infra",
    label: "Infrastructure & Ops",
    blurb: "Getting code to production and keeping it alive there.",
    hue: "orange",
  },
  {
    id: "security",
    label: "Security",
    blurb: "How systems get broken, and the defences that actually hold.",
    hue: "rose",
  },
  {
    id: "data",
    label: "Data Engineering",
    blurb: "Moving data reliably from where it happens to where it's analysed.",
    hue: "lime",
  },
  {
    id: "ml-foundations",
    label: "ML Foundations",
    blurb: "The maths and the classical models everything newer is built on.",
    hue: "emerald",
  },
  {
    id: "deep-learning",
    label: "Deep Learning",
    blurb: "Neural networks from backprop to diffusion.",
    hue: "accent",
  },
  {
    id: "llm",
    label: "LLMs & Frontier AI",
    blurb:
      "How today's frontier models are built, adapted, evaluated and put to work.",
    hue: "violet",
  },
  {
    id: "ml-systems",
    label: "ML Systems & MLOps",
    blurb:
      "The engineering around a model: data, training infra, serving, and the cost of both.",
    hue: "blue",
  },
];

const foundations: Topic[] = [
  t(
    "foundations.programming",
    "Programming Fundamentals",
    "foundational",
    [],
    "Values, control flow, functions, memory, and what a program is to the machine running it.",
  ),
  t(
    "foundations.discrete-math",
    "Discrete Mathematics",
    "foundational",
    [],
    "Logic, sets, combinatorics, graphs and induction — the vocabulary algorithms are stated in.",
  ),
  t(
    "foundations.data-structures",
    "Data Structures",
    "foundational",
    ["foundations.programming"],
    "Arrays, hash tables, trees, heaps, graphs, and the access patterns each one is good at.",
  ),
  t(
    "foundations.complexity",
    "Complexity & Analysis",
    "foundational",
    ["foundations.data-structures", "foundations.discrete-math"],
    "Big-O, amortized analysis, and reasoning about cost before you measure it.",
  ),
  t(
    "foundations.algorithms",
    "Algorithms",
    "core",
    ["foundations.complexity"],
    "Sorting, searching, graph traversal, dynamic programming, greedy methods and their proofs.",
  ),
  t(
    "foundations.architecture",
    "Computer Architecture",
    "core",
    ["foundations.programming"],
    "CPUs, caches, memory hierarchy, branch prediction — why identical big-O runs at different speeds.",
  ),
  t(
    "foundations.os",
    "Operating Systems",
    "core",
    ["foundations.architecture"],
    "Processes, threads, scheduling, virtual memory, file systems and syscalls.",
  ),
  t(
    "foundations.concurrency",
    "Concurrency & Parallelism",
    "advanced",
    ["foundations.os"],
    "Race conditions, locks, atomics, memory models, async runtimes and the bugs unique to each.",
  ),
  t(
    "foundations.networking",
    "Computer Networking",
    "core",
    ["foundations.os"],
    "The stack from Ethernet to HTTP: IP, TCP, UDP, DNS, TLS and what each layer guarantees.",
  ),
  t(
    "foundations.databases",
    "Database Internals",
    "advanced",
    ["foundations.data-structures", "foundations.os"],
    "B-trees, LSM trees, buffer pools, write-ahead logs, query planning and MVCC.",
  ),
  t(
    "foundations.compilers",
    "Languages & Compilers",
    "advanced",
    ["foundations.data-structures"],
    "Parsing, type systems, IRs, code generation, garbage collection and interpreters.",
  ),
  t(
    "foundations.numbers",
    "Numbers & Encoding",
    "foundational",
    ["foundations.programming"],
    "Integer widths, floating point, Unicode, endianness and the classic bugs each produces.",
  ),
];

const craft: Topic[] = [
  t(
    "craft.version-control",
    "Git & Version Control",
    "foundational",
    [],
    "Commits as a DAG, branching models, rebase vs merge, bisect, and recovering from mistakes.",
  ),
  t(
    "craft.clean-code",
    "Clean Code & Naming",
    "foundational",
    [],
    "Functions, naming, comments that earn their place, and code written to be read.",
  ),
  t(
    "craft.type-design",
    "Designing with Types",
    "core",
    ["craft.clean-code"],
    "Making illegal states unrepresentable: unions, invariants, parse-don't-validate.",
  ),
  t(
    "craft.oop-design",
    "OOP & Design Principles",
    "core",
    ["craft.clean-code"],
    "Encapsulation, composition over inheritance, SOLID, and where each principle stops applying.",
  ),
  t(
    "craft.functional",
    "Functional Programming",
    "core",
    ["craft.clean-code"],
    "Immutability, pure functions, higher-order functions, and effects at the edges.",
  ),
  t(
    "craft.design-patterns",
    "Design Patterns",
    "core",
    ["craft.oop-design"],
    "The classic catalogue, when each is genuinely warranted, and the cost of applying it when it isn't.",
  ),
  t(
    "craft.testing",
    "Testing Strategy",
    "foundational",
    ["craft.clean-code"],
    "Unit, integration and end-to-end: what each proves, and the shape of a suite you trust.",
  ),
  t(
    "craft.tdd",
    "TDD & Test Doubles",
    "core",
    ["craft.testing"],
    "Red-green-refactor, mocks vs stubs vs fakes, and testing behaviour rather than implementation.",
  ),
  t(
    "craft.refactoring",
    "Refactoring & Legacy Code",
    "core",
    ["craft.testing", "craft.design-patterns"],
    "Changing structure without changing behaviour, and getting a seam into code that has none.",
  ),
  t(
    "craft.debugging",
    "Debugging & Profiling",
    "core",
    ["craft.testing"],
    "Bisecting, reading stack traces, debuggers, flamegraphs, and forming hypotheses instead of guesses.",
  ),
  t(
    "craft.code-review",
    "Code Review",
    "foundational",
    ["craft.version-control"],
    "Reviewing for correctness and design, writing reviewable diffs, and disagreeing productively.",
  ),
  t(
    "craft.build-tooling",
    "Build Systems & Dependencies",
    "core",
    ["craft.version-control"],
    "Compilation, linking, package managers, lockfiles, semver and reproducible builds.",
  ),
  t(
    "craft.architecture-styles",
    "Application Architecture",
    "advanced",
    ["craft.design-patterns", "craft.type-design"],
    "Layered, hexagonal, modular monolith and DDD — organising a codebase larger than one head.",
  ),
  t(
    "craft.docs",
    "Technical Writing",
    "foundational",
    [],
    "Design docs, RFCs, READMEs and commit messages that survive their author leaving.",
  ),
];

const backend: Topic[] = [
  t(
    "backend.http",
    "HTTP & the Web Platform",
    "foundational",
    ["foundations.networking"],
    "Methods, status codes, headers, cookies, caching semantics, HTTP/2 and HTTP/3.",
  ),
  t(
    "backend.rest",
    "REST API Design",
    "foundational",
    ["backend.http"],
    "Resources, verbs, status codes, pagination, versioning, and errors clients can act on.",
  ),
  t(
    "backend.serialization",
    "Serialization & Schemas",
    "core",
    ["backend.rest"],
    "JSON, Protobuf, Avro, schema evolution and backward/forward compatibility.",
  ),
  t(
    "backend.graphql-grpc",
    "GraphQL & gRPC",
    "core",
    ["backend.serialization"],
    "Two alternatives to REST, what each buys you, and the failure modes each introduces.",
  ),
  t(
    "backend.auth",
    "AuthN & AuthZ",
    "core",
    ["backend.http"],
    "Sessions, tokens, OAuth flows, RBAC/ABAC, and the difference the two halves make.",
  ),
  t(
    "backend.sql",
    "Relational Modeling & SQL",
    "foundational",
    [],
    "Normalization, joins, indexes, query plans and writing SQL that stays fast as data grows.",
  ),
  t(
    "backend.transactions",
    "Transactions & Isolation",
    "core",
    ["backend.sql"],
    "ACID, isolation levels, the anomalies each permits, locking and optimistic concurrency.",
  ),
  t(
    "backend.nosql",
    "NoSQL & Polyglot Persistence",
    "core",
    ["backend.sql"],
    "Document, key-value, wide-column, graph and time-series stores, and choosing between them.",
  ),
  t(
    "backend.caching",
    "Caching",
    "core",
    ["backend.sql", "backend.http"],
    "Cache-aside, write-through, TTLs, invalidation, stampedes and where a cache belongs.",
  ),
  t(
    "backend.queues",
    "Queues & Async Jobs",
    "core",
    ["backend.serialization"],
    "Background work, retries, dead letters, idempotency and at-least-once semantics.",
  ),
  t(
    "backend.realtime",
    "Realtime & Streaming APIs",
    "advanced",
    ["backend.http", "backend.queues"],
    "WebSockets, SSE, long polling, presence, backpressure and fan-out.",
  ),
  t(
    "backend.search",
    "Search & Indexing",
    "advanced",
    ["backend.nosql"],
    "Inverted indexes, analyzers, ranking, faceting and keeping an index in sync with a source of truth.",
  ),
  t(
    "backend.files",
    "File Storage & Media",
    "core",
    ["backend.http"],
    "Object storage, signed URLs, streaming uploads, image pipelines and CDN delivery.",
  ),
  t(
    "backend.api-hardening",
    "Rate Limiting & Resilience",
    "advanced",
    ["backend.caching", "backend.queues"],
    "Quotas, backoff, timeouts, circuit breakers, bulkheads and idempotency keys.",
  ),
  t(
    "backend.services",
    "Services & Modular Monoliths",
    "advanced",
    ["backend.graphql-grpc", "backend.api-hardening"],
    "Where to draw a service boundary, and the operational bill that comes with drawing one.",
  ),
  t(
    "backend.jobs-scheduling",
    "Scheduling & Cron",
    "core",
    ["backend.queues"],
    "Recurring work, distributed locks, drift, missed runs and exactly-once-ish execution.",
  ),
];

const frontend: Topic[] = [
  t(
    "frontend.html-css",
    "HTML & CSS",
    "foundational",
    [],
    "Semantics, the box model, flexbox, grid, the cascade, and layout that survives real content.",
  ),
  t(
    "frontend.javascript",
    "JavaScript Deep Dive",
    "foundational",
    ["foundations.programming"],
    "Closures, prototypes, the event loop, promises, modules and coercion.",
  ),
  t(
    "frontend.typescript",
    "TypeScript",
    "core",
    ["frontend.javascript", "craft.type-design"],
    "Structural typing, generics, narrowing, and modelling a domain the compiler can check.",
  ),
  t(
    "frontend.browser",
    "Browser Internals & the DOM",
    "core",
    ["frontend.html-css", "frontend.javascript"],
    "Parsing, the render pipeline, layout/paint/composite, events and the main thread.",
  ),
  t(
    "frontend.react",
    "React & Component Models",
    "core",
    ["frontend.typescript", "frontend.browser"],
    "Components, reconciliation, hooks, effects, and the mental model behind re-renders.",
  ),
  t(
    "frontend.state",
    "Client State Management",
    "core",
    ["frontend.react"],
    "Local vs shared vs server state, stores, selectors, and avoiding state that shouldn't exist.",
  ),
  t(
    "frontend.data-fetching",
    "Data Fetching & Caching",
    "core",
    ["frontend.state", "backend.rest"],
    "Request lifecycles, caching, revalidation, optimistic updates and rollback.",
  ),
  t(
    "frontend.rendering",
    "Rendering Strategies",
    "advanced",
    ["frontend.react"],
    "CSR, SSR, SSG, ISR, streaming and server components — what each costs and buys.",
  ),
  t(
    "frontend.routing",
    "Routing & Navigation",
    "core",
    ["frontend.react"],
    "URLs as state, nested layouts, code splitting, prefetching and scroll restoration.",
  ),
  t(
    "frontend.styling",
    "Styling Systems & Design Tokens",
    "core",
    ["frontend.html-css"],
    "Utility CSS, component styles, theming, dark mode and a token layer that holds a product together.",
  ),
  t(
    "frontend.forms",
    "Forms & Validation",
    "core",
    ["frontend.state"],
    "Controlled inputs, validation timing, error messaging and multi-step flows.",
  ),
  t(
    "frontend.a11y",
    "Accessibility",
    "core",
    ["frontend.html-css"],
    "Semantics, keyboard navigation, focus management, ARIA, contrast and screen readers.",
  ),
  t(
    "frontend.performance",
    "Web Performance",
    "advanced",
    ["frontend.browser", "frontend.rendering"],
    "Core Web Vitals, bundle size, images, fonts, hydration cost and measuring on real devices.",
  ),
  t(
    "frontend.testing",
    "Frontend Testing",
    "core",
    ["frontend.react", "craft.testing"],
    "Component tests, user-event simulation, end-to-end tests and what not to assert.",
  ),
  t(
    "frontend.build",
    "Bundlers & Frontend Build",
    "advanced",
    ["frontend.typescript", "craft.build-tooling"],
    "Module graphs, tree shaking, transpilation, source maps and dev-server ergonomics.",
  ),
  t(
    "frontend.mobile",
    "Mobile & Cross-Platform",
    "advanced",
    ["frontend.react"],
    "Responsive design, PWAs, React Native, touch input and the constraints phones actually impose.",
  ),
];

const distributed: Topic[] = [
  t(
    "distributed.fundamentals",
    "Distributed Fundamentals",
    "core",
    ["foundations.networking", "foundations.concurrency"],
    "Why the network is not reliable, and the eight fallacies you will otherwise rediscover.",
  ),
  t(
    "distributed.rpc",
    "RPC & Service Communication",
    "core",
    ["distributed.fundamentals"],
    "Synchronous calls across a network: timeouts, retries, and why they are not local calls.",
  ),
  t(
    "distributed.time",
    "Clocks, Order & Causality",
    "advanced",
    ["distributed.fundamentals"],
    "Physical vs logical clocks, Lamport timestamps, vector clocks and happens-before.",
  ),
  t(
    "distributed.replication",
    "Replication",
    "core",
    ["distributed.rpc"],
    "Leader-follower, multi-leader, leaderless, replication lag and read-your-writes.",
  ),
  t(
    "distributed.partitioning",
    "Partitioning & Sharding",
    "core",
    ["distributed.replication"],
    "Range vs hash partitioning, consistent hashing, hot keys and rebalancing.",
  ),
  t(
    "distributed.consistency",
    "Consistency Models & CAP",
    "advanced",
    ["distributed.replication", "distributed.time"],
    "Linearizability, sequential and eventual consistency, CAP, PACELC and what they rule out.",
  ),
  t(
    "distributed.consensus",
    "Consensus",
    "advanced",
    ["distributed.consistency"],
    "Paxos, Raft, quorums, leader election, and why agreement is expensive.",
  ),
  t(
    "distributed.transactions",
    "Distributed Transactions",
    "advanced",
    ["distributed.consensus", "backend.transactions"],
    "Two-phase commit, sagas, outbox pattern and exactly-once as an illusion built from idempotency.",
  ),
  t(
    "distributed.messaging",
    "Messaging & Event Streaming",
    "core",
    ["distributed.partitioning", "backend.queues"],
    "Logs vs queues, Kafka's model, ordering, consumer groups, offsets and replay.",
  ),
  t(
    "distributed.coordination",
    "Coordination & Locking",
    "advanced",
    ["distributed.consensus"],
    "Distributed locks, leases, fencing tokens, ZooKeeper/etcd and the ways locks fail.",
  ),
  t(
    "distributed.load-balancing",
    "Load Balancing & Routing",
    "core",
    ["distributed.rpc"],
    "L4 vs L7, algorithms, health checks, service discovery and connection draining.",
  ),
  t(
    "distributed.failure",
    "Failure Modes & Resilience",
    "advanced",
    ["distributed.load-balancing"],
    "Partial failure, cascading failure, retry storms, hedging, chaos testing and graceful degradation.",
  ),
  t(
    "distributed.batch-stream",
    "Batch & Stream Processing",
    "advanced",
    ["distributed.messaging"],
    "MapReduce, dataflow, windowing, watermarks, and the batch/stream duality.",
  ),
];

const systemsDesign: Topic[] = [
  t(
    "systems-design.method",
    "The Design Interview Method",
    "foundational",
    [],
    "Requirements, constraints, API, data model, high-level design, deep dive, tradeoffs — in that order.",
  ),
  t(
    "systems-design.estimation",
    "Back-of-Envelope Estimation",
    "foundational",
    ["systems-design.method"],
    "QPS, storage, bandwidth and cost, done in your head, with numbers worth memorising.",
  ),
  t(
    "systems-design.storage-choice",
    "Choosing a Datastore",
    "core",
    ["systems-design.estimation", "backend.nosql"],
    "Matching access patterns to engines, and defending the choice against the obvious alternative.",
  ),
  t(
    "systems-design.scaling",
    "Scaling Patterns",
    "core",
    ["systems-design.storage-choice", "distributed.partitioning"],
    "Vertical vs horizontal, read replicas, sharding, CQRS, fan-out on read vs write.",
  ),
  t(
    "systems-design.api-contracts",
    "API & Contract Design at Scale",
    "core",
    ["systems-design.method", "backend.rest"],
    "Versioning, compatibility, pagination at scale, and contracts you can change later.",
  ),
  t(
    "systems-design.tradeoffs",
    "Consistency & Latency Tradeoffs",
    "advanced",
    ["systems-design.scaling", "distributed.consistency"],
    "Choosing what to give up, saying so out loud, and quantifying the cost.",
  ),
  t(
    "systems-design.case-feeds",
    "Case: Feeds & Timelines",
    "advanced",
    ["systems-design.scaling"],
    "Fan-out strategies, celebrity problem, ranking and pagination over a moving list.",
  ),
  t(
    "systems-design.case-chat",
    "Case: Chat & Presence",
    "advanced",
    ["systems-design.scaling", "backend.realtime"],
    "Delivery guarantees, ordering, presence, unread counts and mobile reconnection.",
  ),
  t(
    "systems-design.case-storage",
    "Case: Object Storage & CDN",
    "advanced",
    ["systems-design.scaling"],
    "Chunking, dedup, metadata, edge caching and invalidation across a global footprint.",
  ),
  t(
    "systems-design.case-ratelimit",
    "Case: Rate Limiter & Counters",
    "core",
    ["systems-design.scaling", "backend.api-hardening"],
    "Token bucket, sliding window, distributed counters and approximate counting.",
  ),
  t(
    "systems-design.case-search",
    "Case: Search & Autocomplete",
    "advanced",
    ["systems-design.scaling", "backend.search"],
    "Index build and serve paths, tries, ranking, typo tolerance and freshness.",
  ),
  t(
    "systems-design.case-payments",
    "Case: Payments & Ledgers",
    "advanced",
    ["systems-design.tradeoffs", "distributed.transactions"],
    "Double-entry ledgers, idempotency, reconciliation and money you cannot lose.",
  ),
  t(
    "systems-design.case-ml",
    "Case: An ML-Powered Product",
    "advanced",
    ["systems-design.tradeoffs"],
    "Designing the system around a model: features, serving path, fallbacks and feedback loops.",
  ),
];

const infra: Topic[] = [
  t(
    "infra.linux",
    "Linux & the Shell",
    "foundational",
    ["foundations.os"],
    "Filesystem, permissions, processes, signals, pipes, systemd and the tools you debug with.",
  ),
  t(
    "infra.networking-ops",
    "Practical Networking",
    "core",
    ["foundations.networking"],
    "DNS, TLS certificates, load balancers, CDNs, VPCs, firewalls and reading a traceroute.",
  ),
  t(
    "infra.containers",
    "Containers",
    "core",
    ["infra.linux"],
    "Images, layers, namespaces, cgroups, registries and writing a Dockerfile that isn't 2GB.",
  ),
  t(
    "infra.orchestration",
    "Kubernetes & Orchestration",
    "advanced",
    ["infra.containers"],
    "Pods, deployments, services, ingress, config, autoscaling and the control loop model.",
  ),
  t(
    "infra.cloud",
    "Cloud Primitives",
    "core",
    ["infra.networking-ops"],
    "Compute, storage, networking, IAM and managed services — the same shapes across providers.",
  ),
  t(
    "infra.iac",
    "Infrastructure as Code",
    "core",
    ["infra.cloud"],
    "Declarative infrastructure, state files, drift, modules and reviewable environments.",
  ),
  t(
    "infra.cicd",
    "CI/CD & Release Engineering",
    "core",
    ["infra.containers", "craft.version-control"],
    "Pipelines, artifacts, environments, blue-green and canary releases, rollbacks and feature flags.",
  ),
  t(
    "infra.observability",
    "Observability",
    "core",
    ["infra.cicd"],
    "Logs, metrics, traces, cardinality, structured events and dashboards that answer questions.",
  ),
  t(
    "infra.reliability",
    "SLOs & Reliability Engineering",
    "advanced",
    ["infra.observability"],
    "SLIs, SLOs, error budgets, alerting on symptoms, and toil as something to measure.",
  ),
  t(
    "infra.incidents",
    "Incident Response & Postmortems",
    "core",
    ["infra.reliability"],
    "Detection, mitigation before diagnosis, comms, and blameless writeups that change something.",
  ),
  t(
    "infra.capacity-cost",
    "Capacity Planning & Cost",
    "advanced",
    ["infra.reliability"],
    "Load testing, headroom, autoscaling policy, and the unit economics of a request.",
  ),
  t(
    "infra.serverless-edge",
    "Serverless & Edge",
    "advanced",
    ["infra.cloud"],
    "Functions, cold starts, execution models, edge runtimes and where each stops making sense.",
  ),
];

const security: Topic[] = [
  t(
    "security.foundations",
    "Security Foundations",
    "foundational",
    [],
    "Threat modelling, trust boundaries, least privilege, defence in depth and the attacker's view.",
  ),
  t(
    "security.crypto",
    "Applied Cryptography",
    "core",
    ["security.foundations"],
    "Hashing, symmetric and public-key crypto, signatures, TLS, and never rolling your own.",
  ),
  t(
    "security.identity",
    "Identity: OAuth, OIDC & Sessions",
    "core",
    ["security.crypto", "backend.auth"],
    "Flows, tokens, JWT pitfalls, refresh, session fixation and MFA.",
  ),
  t(
    "security.appsec",
    "Web Application Security",
    "core",
    ["security.foundations", "backend.http"],
    "Injection, XSS, CSRF, SSRF, deserialization, path traversal and the OWASP Top 10 in practice.",
  ),
  t(
    "security.secrets",
    "Secrets & Key Management",
    "core",
    ["security.crypto", "infra.iac"],
    "Storage, rotation, envelope encryption, and keeping credentials out of git and logs.",
  ),
  t(
    "security.network-security",
    "Network & Infra Security",
    "advanced",
    ["security.appsec", "infra.networking-ops"],
    "Segmentation, zero trust, mTLS, WAFs, DDoS mitigation and hardening a host.",
  ),
  t(
    "security.supply-chain",
    "Supply Chain Security",
    "advanced",
    ["security.secrets", "craft.build-tooling"],
    "Dependency risk, SBOMs, signing, reproducible builds and CI as an attack surface.",
  ),
  t(
    "security.privacy",
    "Privacy & Compliance",
    "core",
    ["security.foundations"],
    "PII, data minimisation, retention, GDPR-shaped obligations and designing for deletion.",
  ),
  t(
    "security.ml-security",
    "ML & LLM Security",
    "advanced",
    ["security.appsec"],
    "Prompt injection, data exfiltration, model theft, poisoning and agent tool-use risk.",
  ),
];

const data: Topic[] = [
  t(
    "data.modeling",
    "Analytical Data Modeling",
    "core",
    ["backend.sql"],
    "Star schemas, slowly changing dimensions, grain, and modelling for questions rather than writes.",
  ),
  t(
    "data.warehouse",
    "Warehouses, Lakes & Lakehouses",
    "core",
    ["data.modeling"],
    "Columnar storage, partitioning, file formats, table formats and separation of storage and compute.",
  ),
  t(
    "data.ingestion",
    "Ingestion & Change Data Capture",
    "core",
    ["data.warehouse", "distributed.messaging"],
    "Batch loads, CDC from a write database, schema drift and backfills.",
  ),
  t(
    "data.batch",
    "Batch Processing",
    "core",
    ["data.ingestion", "distributed.batch-stream"],
    "Spark's execution model, shuffles, skew, partitioning and jobs that finish.",
  ),
  t(
    "data.streaming",
    "Stream Processing",
    "advanced",
    ["data.batch"],
    "Event time vs processing time, windows, watermarks, state stores and exactly-once sinks.",
  ),
  t(
    "data.orchestration",
    "Orchestration & Scheduling",
    "core",
    ["data.batch"],
    "DAGs, dependencies, retries, idempotent tasks, backfills and SLAs on data arriving.",
  ),
  t(
    "data.quality",
    "Data Quality & Contracts",
    "core",
    ["data.orchestration"],
    "Tests on data, freshness and volume checks, contracts with producers, and failing loudly.",
  ),
  t(
    "data.analytics-eng",
    "Analytics Engineering",
    "core",
    ["data.quality"],
    "Transformations as version-controlled code, metric layers, and one definition of a number.",
  ),
  t(
    "data.governance",
    "Governance & Lineage",
    "advanced",
    ["data.quality", "security.privacy"],
    "Catalogs, lineage, access control, retention and knowing where a column came from.",
  ),
];

const mlFoundations: Topic[] = [
  t(
    "ml-foundations.linear-algebra",
    "Linear Algebra for ML",
    "foundational",
    [],
    "Vectors, matrices, norms, projections, eigendecomposition and SVD, with the geometry attached.",
  ),
  t(
    "ml-foundations.calculus",
    "Calculus & Optimization",
    "foundational",
    ["ml-foundations.linear-algebra"],
    "Gradients, Jacobians, chain rule, convexity, gradient descent and its convergence behaviour.",
  ),
  t(
    "ml-foundations.probability",
    "Probability & Statistics",
    "foundational",
    [],
    "Distributions, expectation, Bayes, MLE/MAP, estimators, confidence and hypothesis testing.",
  ),
  t(
    "ml-foundations.learning-theory",
    "Learning Theory",
    "core",
    ["ml-foundations.probability"],
    "Bias-variance, overfitting, regularization, capacity, and why held-out data is non-negotiable.",
  ),
  t(
    "ml-foundations.supervised",
    "Supervised Learning",
    "core",
    ["ml-foundations.calculus", "ml-foundations.learning-theory"],
    "Linear and logistic regression, SVMs, kNN, naive Bayes — losses, decision boundaries and assumptions.",
  ),
  t(
    "ml-foundations.trees",
    "Trees & Ensembles",
    "core",
    ["ml-foundations.supervised"],
    "Decision trees, bagging, random forests, gradient boosting, and why they still win on tables.",
  ),
  t(
    "ml-foundations.unsupervised",
    "Unsupervised Learning",
    "core",
    ["ml-foundations.supervised"],
    "Clustering, PCA, matrix factorization, density estimation and anomaly detection.",
  ),
  t(
    "ml-foundations.features",
    "Feature Engineering",
    "core",
    ["ml-foundations.supervised"],
    "Encodings, scaling, interactions, leakage, missing data and features you can compute at serve time.",
  ),
  t(
    "ml-foundations.evaluation",
    "Model Evaluation",
    "core",
    ["ml-foundations.learning-theory"],
    "Cross-validation, precision/recall, ROC and PR curves, calibration, and picking a metric that matches the decision.",
  ),
  t(
    "ml-foundations.causality",
    "Causal Inference & Experiments",
    "advanced",
    ["ml-foundations.evaluation"],
    "A/B testing, confounding, uplift, instrumental variables and correlation that isn't.",
  ),
  t(
    "ml-foundations.timeseries",
    "Time Series",
    "advanced",
    ["ml-foundations.evaluation"],
    "Stationarity, autocorrelation, classical forecasting, backtesting and leakage across time.",
  ),
];

const deepLearning: Topic[] = [
  t(
    "deep-learning.neural-nets",
    "Neural Networks & Backprop",
    "core",
    ["ml-foundations.calculus", "ml-foundations.supervised"],
    "Layers, activations, loss surfaces, and backpropagation derived rather than asserted.",
  ),
  t(
    "deep-learning.frameworks",
    "Frameworks & Autodiff",
    "core",
    ["deep-learning.neural-nets"],
    "Tensors, computation graphs, autograd, devices and writing a training loop from scratch.",
  ),
  t(
    "deep-learning.training",
    "Training Dynamics",
    "core",
    ["deep-learning.frameworks"],
    "Initialization, normalization, optimizers, learning-rate schedules and diagnosing a bad run.",
  ),
  t(
    "deep-learning.regularization",
    "Regularization & Generalization",
    "core",
    ["deep-learning.training"],
    "Dropout, weight decay, augmentation, early stopping, and why big models generalize at all.",
  ),
  t(
    "deep-learning.cnn",
    "Convolutional Networks & Vision",
    "core",
    ["deep-learning.training"],
    "Convolutions, pooling, residual connections, detection and segmentation.",
  ),
  t(
    "deep-learning.sequence",
    "Sequence Models",
    "core",
    ["deep-learning.training"],
    "RNNs, LSTMs, GRUs, encoder-decoder models and the limits that motivated attention.",
  ),
  t(
    "deep-learning.attention",
    "Attention & Transformers",
    "advanced",
    ["deep-learning.sequence"],
    "Self-attention, multi-head attention, positional encodings and the full transformer block.",
  ),
  t(
    "deep-learning.representation",
    "Embeddings & Representation Learning",
    "core",
    ["deep-learning.attention"],
    "Word and sentence embeddings, contrastive learning, self-supervision and metric spaces.",
  ),
  t(
    "deep-learning.generative",
    "Generative Models",
    "advanced",
    ["deep-learning.representation"],
    "Autoencoders, VAEs, GANs, normalizing flows and diffusion, and what each optimizes.",
  ),
  t(
    "deep-learning.rl",
    "Reinforcement Learning",
    "advanced",
    ["deep-learning.training", "ml-foundations.probability"],
    "MDPs, value and policy methods, Q-learning, policy gradients, PPO and exploration.",
  ),
  t(
    "deep-learning.graph",
    "Graph Neural Networks",
    "advanced",
    ["deep-learning.representation"],
    "Message passing, GCNs, GATs, sampling, and problems that are natively graphs.",
  ),
];

const llm: Topic[] = [
  t(
    "llm.tokenization",
    "Tokenization & Text Representation",
    "core",
    ["deep-learning.attention"],
    "BPE, subwords, vocabularies, special tokens, and the bugs tokenization quietly causes.",
  ),
  t(
    "llm.architecture",
    "Modern LLM Architecture",
    "advanced",
    ["llm.tokenization"],
    "Decoder-only stacks, RoPE, RMSNorm, GQA, mixture-of-experts and long-context designs.",
  ),
  t(
    "llm.pretraining",
    "Pretraining & Data",
    "advanced",
    ["llm.architecture"],
    "Corpora, dedup, filtering, curricula, objectives, and what pretraining actually optimizes.",
  ),
  t(
    "llm.scaling-laws",
    "Scaling Laws & Compute",
    "advanced",
    ["llm.pretraining"],
    "Parameter/data/compute tradeoffs, Chinchilla-style scaling, and budgeting a training run.",
  ),
  t(
    "llm.finetuning",
    "Fine-Tuning & PEFT",
    "core",
    ["llm.pretraining"],
    "Full fine-tuning, LoRA and adapters, instruction tuning, and building a dataset worth training on.",
  ),
  t(
    "llm.alignment",
    "Alignment: RLHF & DPO",
    "advanced",
    ["llm.finetuning", "deep-learning.rl"],
    "Preference data, reward models, PPO-style RLHF, DPO and where alignment fails.",
  ),
  t(
    "llm.reasoning",
    "Reasoning & Test-Time Compute",
    "advanced",
    ["llm.alignment"],
    "Chain of thought, self-consistency, search at inference, and reasoning-trained models.",
  ),
  t(
    "llm.prompting",
    "Prompting & Context Engineering",
    "foundational",
    ["llm.tokenization"],
    "Instructions, few-shot examples, structured output, context budgeting and prompt failure modes.",
  ),
  t(
    "llm.rag",
    "Retrieval-Augmented Generation",
    "core",
    ["llm.prompting", "deep-learning.representation"],
    "Chunking, embedding, hybrid retrieval, reranking, grounding and citation.",
  ),
  t(
    "llm.agents",
    "Agents & Tool Use",
    "advanced",
    ["llm.rag"],
    "Function calling, planning, memory, multi-step loops, sandboxing and failure recovery.",
  ),
  t(
    "llm.evaluation",
    "LLM Evaluation",
    "core",
    ["llm.prompting", "ml-foundations.evaluation"],
    "Benchmarks, rubric grading, LLM-as-judge, human eval, contamination and regression suites.",
  ),
  t(
    "llm.multimodal",
    "Multimodal Models",
    "advanced",
    ["llm.architecture"],
    "Vision-language models, audio and video, cross-modal alignment, and image generation.",
  ),
  t(
    "llm.safety",
    "Safety, Guardrails & Red-Teaming",
    "core",
    ["llm.evaluation", "security.ml-security"],
    "Jailbreaks, prompt injection, refusal behaviour, content filtering and layered defence.",
  ),
  t(
    "llm.frontier",
    "Frontier Systems",
    "advanced",
    ["llm.reasoning", "llm.multimodal"],
    "Where the state of the art currently is, how to read a model release, and reading papers usefully.",
  ),
];

const mlSystems: Topic[] = [
  t(
    "ml-systems.lifecycle",
    "The ML Lifecycle",
    "foundational",
    ["ml-foundations.evaluation"],
    "Problem framing, data, training, deployment, monitoring, and iteration as the actual loop.",
  ),
  t(
    "ml-systems.data-pipelines",
    "ML Data Pipelines & Feature Stores",
    "core",
    ["ml-systems.lifecycle", "data.orchestration"],
    "Training/serving skew, point-in-time correctness, feature stores and labelling pipelines.",
  ),
  t(
    "ml-systems.experiment-tracking",
    "Experiments & Reproducibility",
    "core",
    ["ml-systems.lifecycle"],
    "Runs, artifacts, seeds, model registries and being able to rebuild last month's model.",
  ),
  t(
    "ml-systems.training-infra",
    "Training Infrastructure",
    "core",
    ["ml-systems.data-pipelines"],
    "Job scheduling, checkpointing, spot instances, data loading and keeping accelerators busy.",
  ),
  t(
    "ml-systems.gpu",
    "GPUs, CUDA & Accelerators",
    "advanced",
    ["ml-systems.training-infra", "foundations.architecture"],
    "Memory hierarchy, kernels, occupancy, mixed precision and reading a profile.",
  ),
  t(
    "ml-systems.distributed-training",
    "Distributed Training",
    "advanced",
    ["ml-systems.gpu", "distributed.fundamentals"],
    "Data, tensor, pipeline and expert parallelism, all-reduce, ZeRO/FSDP and communication cost.",
  ),
  t(
    "ml-systems.serving",
    "Model Serving",
    "core",
    ["ml-systems.lifecycle", "backend.rest"],
    "Inference APIs, batching, autoscaling, cold starts, versioning and shadow deploys.",
  ),
  t(
    "ml-systems.inference-optimization",
    "Inference Optimization",
    "advanced",
    ["ml-systems.serving", "ml-systems.gpu"],
    "KV caching, continuous batching, quantization, distillation, speculative decoding and throughput math.",
  ),
  t(
    "ml-systems.vector-search",
    "Vector Search & Retrieval Infra",
    "core",
    ["ml-systems.serving", "llm.rag"],
    "ANN indexes (HNSW, IVF), recall/latency tradeoffs, hybrid search and index maintenance.",
  ),
  t(
    "ml-systems.monitoring",
    "ML Monitoring & Drift",
    "core",
    ["ml-systems.serving"],
    "Data and concept drift, delayed labels, performance decay and alerting on a model.",
  ),
  t(
    "ml-systems.evaluation-infra",
    "Evaluation & Online Testing",
    "advanced",
    ["ml-systems.monitoring", "ml-foundations.causality"],
    "Offline/online gaps, A/B tests, interleaving, guardrail metrics and shipping decisions.",
  ),
  t(
    "ml-systems.recsys",
    "Recommendation & Ranking",
    "advanced",
    ["ml-systems.evaluation-infra", "ml-foundations.unsupervised"],
    "Candidate generation, ranking models, features, feedback loops and cold start.",
  ),
  t(
    "ml-systems.cost",
    "Cost & Capacity for ML",
    "advanced",
    ["ml-systems.inference-optimization"],
    "Cost per token and per prediction, capacity planning for accelerators, and build-vs-buy.",
  ),
];

export const TOPICS: readonly Topic[] = [
  ...foundations,
  ...craft,
  ...backend,
  ...frontend,
  ...distributed,
  ...systemsDesign,
  ...infra,
  ...security,
  ...data,
  ...mlFoundations,
  ...deepLearning,
  ...llm,
  ...mlSystems,
];

const BY_ID = new Map<TopicId, Topic>(TOPICS.map((topic) => [topic.id, topic]));

export function topicById(id: TopicId): Topic | undefined {
  return BY_ID.get(id);
}

export function trackById(id: string): Track | undefined {
  return TRACKS.find((track) => track.id === id);
}

export function topicsInTrack(trackId: string): Topic[] {
  return TOPICS.filter((topic) => topic.trackId === trackId);
}
