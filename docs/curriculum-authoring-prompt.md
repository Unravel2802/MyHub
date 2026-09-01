# Curriculum authoring prompt

The prompt to hand Gemini (or any capable model) to generate chapters for
`/curriculum`. Work **one topic per request** — a whole track in one go produces
thin material, and the output has to fit in one response to be pasteable.

## How to use it

1. Pick a topic from the catalogue at the bottom of this file.
2. Paste the prompt below, filling in the four `<<...>>` slots from that row.
3. Save each file it returns to `content/curriculum/<TOPIC_ID>/NN-slug.md`.
4. Refresh `/curriculum` (dev) or redeploy (production). The topic's node fills
   in on its own — no code change, no migration.

If a response gets truncated, ask for "chapters 4–6 only, same format" rather
than regenerating the lot.

---

## The prompt

````text
You are writing a chapter of a software-engineering textbook. It is for a
working engineer preparing for senior/staff-level roles at strong companies —
someone who can already code, wants the underlying model rather than a tutorial,
and will be asked about this material in interviews and will use it in
production.

TOPIC:        <<TOPIC TITLE>>
TOPIC ID:     <<topic.id>>
TRACK:        <<TRACK NAME>>
IN SCOPE:     <<TOPIC SUMMARY — the one-line summary from the catalogue>>
ASSUMES:      <<the "Assumes" column — treat as already known; reference, never re-teach>>

Write 5 to 8 chapters covering this topic end to end. Return each as a separate
fenced code block labelled with its filename, in this exact form:

```markdown name=01-some-slug.md
---
title: The chapter title
minutes: 20
summary: One sentence, under 100 characters, shown under the title in a list.
---

Body starts here.
```

FILE RULES — these are parsed by a program, so they are not negotiable:
- Filenames are `NN-kebab-slug.md`, zero-padded, numbered in reading order
  starting at 01.
- The frontmatter block is exactly the three keys above, each on one line,
  `key: value`. No nesting, no lists, no other keys. It is not real YAML.
- `minutes` is an honest reading estimate as a positive integer.
- Do NOT start the body with an `# H1`. The title comes from the frontmatter.
  Section headings start at `##`.
- Markdown only. NO raw HTML — it is stripped, so anything written in HTML
  silently disappears.
- Fenced code blocks must carry a language tag (```python, ```sql, ```text).
- GitHub-flavoured markdown tables are supported and encouraged.
- LaTeX is NOT rendered. Write maths as plain text or inside a ```text fence.

WRITING RULES:
- Textbook prose, not lecture notes and not bullet soup. Explain the mechanism,
  then the consequences. Full sentences and real paragraphs.
- Every chapter opens by saying what problem this idea exists to solve. A reader
  who does not know why something exists will not remember how it works.
- Derive or justify claims. "Doubling on growth is what makes append amortized
  O(1), because to trigger the next resize you must first do `capacity` cheap
  appends" — not "append is O(1) amortized".
- Include the numbers that matter and are worth memorising, in tables.
- Show code only where code is the clearest explanation, and keep it short
  enough to read in one pass. Pseudocode or Python unless the topic demands a
  specific language.
- Name the failure modes explicitly. The bugs, the anti-patterns, the case where
  the standard advice stops applying. This is the part that separates a textbook
  from documentation.
- State trade-offs as trade-offs. Where engineers disagree, say so and give the
  case for each side rather than picking one silently.
- Where the topic has a well-known interview framing, say what a strong answer
  contains.
- End each chapter with a short "What to take away" list of 3-5 numbered claims,
  then one sentence pointing at what comes next.

CALIBRATION:
- Assume the ASSUMES topics are known. Reference them by name to place the
  material, but do not re-explain them.
- Do not pad. No "in today's fast-paced world", no restating the heading as the
  first sentence, no summary paragraph that repeats the section above it.
- Prefer being concrete: real numbers, real system names, real orders of
  magnitude.
- Where something changed recently or is genuinely contested, say when, and say
  what the current consensus is.
- If you are unsure of a fact, leave it out rather than stating it confidently.
  This is going into a reference the reader will trust.

Aim for 800-1500 words per chapter. Return nothing but the fenced blocks.
````

---

## Suggested order

Follow the graph. Within a track, a topic's prerequisites are worth having
written first — the chapters are allowed to lean on them, and the page's
"available" marker assumes it.

A reasonable first pass across the whole curriculum:

1. **CS Foundations** — everything else references it.
2. **Software Craft** and **Backend Engineering** — the daily-work tracks.
3. **Distributed Systems**, then **Systems Design** — design cases lean on both.
4. **ML Foundations** → **Deep Learning** → **LLMs & Frontier AI**.
5. **ML Systems & MLOps**, then whichever of Frontend / Infra / Security / Data
   matches what you are working on.

## The catalogue

163 topics across 13 tracks. `Assumes` lists prerequisites — treat them as known
when writing, and mention them by name where they carry the explanation.

<!-- Generated from src/modules/curriculum/curriculumCatalog.ts. If you add a
     topic there, regenerate this section rather than hand-editing it. -->

### CS Foundations (12 topics)

| Topic id                      | Title                     | Tier         | Assumes                               |
| ----------------------------- | ------------------------- | ------------ | ------------------------------------- |
| `foundations.programming`     | Programming Fundamentals  | foundational | —                                     |
| `foundations.discrete-math`   | Discrete Mathematics      | foundational | —                                     |
| `foundations.data-structures` | Data Structures           | foundational | Programming Fundamentals              |
| `foundations.complexity`      | Complexity & Analysis     | foundational | Data Structures, Discrete Mathematics |
| `foundations.algorithms`      | Algorithms                | core         | Complexity & Analysis                 |
| `foundations.architecture`    | Computer Architecture     | core         | Programming Fundamentals              |
| `foundations.os`              | Operating Systems         | core         | Computer Architecture                 |
| `foundations.concurrency`     | Concurrency & Parallelism | advanced     | Operating Systems                     |
| `foundations.networking`      | Computer Networking       | core         | Operating Systems                     |
| `foundations.databases`       | Database Internals        | advanced     | Data Structures, Operating Systems    |
| `foundations.compilers`       | Languages & Compilers     | advanced     | Data Structures                       |
| `foundations.numbers`         | Numbers & Encoding        | foundational | Programming Fundamentals              |

### Software Craft (14 topics)

| Topic id                    | Title                        | Tier         | Assumes                               |
| --------------------------- | ---------------------------- | ------------ | ------------------------------------- |
| `craft.version-control`     | Git & Version Control        | foundational | —                                     |
| `craft.clean-code`          | Clean Code & Naming          | foundational | —                                     |
| `craft.type-design`         | Designing with Types         | core         | Clean Code & Naming                   |
| `craft.oop-design`          | OOP & Design Principles      | core         | Clean Code & Naming                   |
| `craft.functional`          | Functional Programming       | core         | Clean Code & Naming                   |
| `craft.design-patterns`     | Design Patterns              | core         | OOP & Design Principles               |
| `craft.testing`             | Testing Strategy             | foundational | Clean Code & Naming                   |
| `craft.tdd`                 | TDD & Test Doubles           | core         | Testing Strategy                      |
| `craft.refactoring`         | Refactoring & Legacy Code    | core         | Testing Strategy, Design Patterns     |
| `craft.debugging`           | Debugging & Profiling        | core         | Testing Strategy                      |
| `craft.code-review`         | Code Review                  | foundational | Git & Version Control                 |
| `craft.build-tooling`       | Build Systems & Dependencies | core         | Git & Version Control                 |
| `craft.architecture-styles` | Application Architecture     | advanced     | Design Patterns, Designing with Types |
| `craft.docs`                | Technical Writing            | foundational | —                                     |

### Backend Engineering (16 topics)

| Topic id                  | Title                        | Tier         | Assumes                                            |
| ------------------------- | ---------------------------- | ------------ | -------------------------------------------------- |
| `backend.http`            | HTTP & the Web Platform      | foundational | Computer Networking                                |
| `backend.rest`            | REST API Design              | foundational | HTTP & the Web Platform                            |
| `backend.serialization`   | Serialization & Schemas      | core         | REST API Design                                    |
| `backend.graphql-grpc`    | GraphQL & gRPC               | core         | Serialization & Schemas                            |
| `backend.auth`            | AuthN & AuthZ                | core         | HTTP & the Web Platform                            |
| `backend.sql`             | Relational Modeling & SQL    | foundational | —                                                  |
| `backend.transactions`    | Transactions & Isolation     | core         | Relational Modeling & SQL                          |
| `backend.nosql`           | NoSQL & Polyglot Persistence | core         | Relational Modeling & SQL                          |
| `backend.caching`         | Caching                      | core         | Relational Modeling & SQL, HTTP & the Web Platform |
| `backend.queues`          | Queues & Async Jobs          | core         | Serialization & Schemas                            |
| `backend.realtime`        | Realtime & Streaming APIs    | advanced     | HTTP & the Web Platform, Queues & Async Jobs       |
| `backend.search`          | Search & Indexing            | advanced     | NoSQL & Polyglot Persistence                       |
| `backend.files`           | File Storage & Media         | core         | HTTP & the Web Platform                            |
| `backend.api-hardening`   | Rate Limiting & Resilience   | advanced     | Caching, Queues & Async Jobs                       |
| `backend.services`        | Services & Modular Monoliths | advanced     | GraphQL & gRPC, Rate Limiting & Resilience         |
| `backend.jobs-scheduling` | Scheduling & Cron            | core         | Queues & Async Jobs                                |

### Frontend Engineering (16 topics)

| Topic id                 | Title                           | Tier         | Assumes                                           |
| ------------------------ | ------------------------------- | ------------ | ------------------------------------------------- |
| `frontend.html-css`      | HTML & CSS                      | foundational | —                                                 |
| `frontend.javascript`    | JavaScript Deep Dive            | foundational | Programming Fundamentals                          |
| `frontend.typescript`    | TypeScript                      | core         | JavaScript Deep Dive, Designing with Types        |
| `frontend.browser`       | Browser Internals & the DOM     | core         | HTML & CSS, JavaScript Deep Dive                  |
| `frontend.react`         | React & Component Models        | core         | TypeScript, Browser Internals & the DOM           |
| `frontend.state`         | Client State Management         | core         | React & Component Models                          |
| `frontend.data-fetching` | Data Fetching & Caching         | core         | Client State Management, REST API Design          |
| `frontend.rendering`     | Rendering Strategies            | advanced     | React & Component Models                          |
| `frontend.routing`       | Routing & Navigation            | core         | React & Component Models                          |
| `frontend.styling`       | Styling Systems & Design Tokens | core         | HTML & CSS                                        |
| `frontend.forms`         | Forms & Validation              | core         | Client State Management                           |
| `frontend.a11y`          | Accessibility                   | core         | HTML & CSS                                        |
| `frontend.performance`   | Web Performance                 | advanced     | Browser Internals & the DOM, Rendering Strategies |
| `frontend.testing`       | Frontend Testing                | core         | React & Component Models, Testing Strategy        |
| `frontend.build`         | Bundlers & Frontend Build       | advanced     | TypeScript, Build Systems & Dependencies          |
| `frontend.mobile`        | Mobile & Cross-Platform         | advanced     | React & Component Models                          |

### Distributed Systems (13 topics)

| Topic id                     | Title                       | Tier     | Assumes                                        |
| ---------------------------- | --------------------------- | -------- | ---------------------------------------------- |
| `distributed.fundamentals`   | Distributed Fundamentals    | core     | Computer Networking, Concurrency & Parallelism |
| `distributed.rpc`            | RPC & Service Communication | core     | Distributed Fundamentals                       |
| `distributed.time`           | Clocks, Order & Causality   | advanced | Distributed Fundamentals                       |
| `distributed.replication`    | Replication                 | core     | RPC & Service Communication                    |
| `distributed.partitioning`   | Partitioning & Sharding     | core     | Replication                                    |
| `distributed.consistency`    | Consistency Models & CAP    | advanced | Replication, Clocks, Order & Causality         |
| `distributed.consensus`      | Consensus                   | advanced | Consistency Models & CAP                       |
| `distributed.transactions`   | Distributed Transactions    | advanced | Consensus, Transactions & Isolation            |
| `distributed.messaging`      | Messaging & Event Streaming | core     | Partitioning & Sharding, Queues & Async Jobs   |
| `distributed.coordination`   | Coordination & Locking      | advanced | Consensus                                      |
| `distributed.load-balancing` | Load Balancing & Routing    | core     | RPC & Service Communication                    |
| `distributed.failure`        | Failure Modes & Resilience  | advanced | Load Balancing & Routing                       |
| `distributed.batch-stream`   | Batch & Stream Processing   | advanced | Messaging & Event Streaming                    |

### Systems Design (13 topics)

| Topic id                        | Title                           | Tier         | Assumes                                                   |
| ------------------------------- | ------------------------------- | ------------ | --------------------------------------------------------- |
| `systems-design.method`         | The Design Interview Method     | foundational | —                                                         |
| `systems-design.estimation`     | Back-of-Envelope Estimation     | foundational | The Design Interview Method                               |
| `systems-design.storage-choice` | Choosing a Datastore            | core         | Back-of-Envelope Estimation, NoSQL & Polyglot Persistence |
| `systems-design.scaling`        | Scaling Patterns                | core         | Choosing a Datastore, Partitioning & Sharding             |
| `systems-design.api-contracts`  | API & Contract Design at Scale  | core         | The Design Interview Method, REST API Design              |
| `systems-design.tradeoffs`      | Consistency & Latency Tradeoffs | advanced     | Scaling Patterns, Consistency Models & CAP                |
| `systems-design.case-feeds`     | Case: Feeds & Timelines         | advanced     | Scaling Patterns                                          |
| `systems-design.case-chat`      | Case: Chat & Presence           | advanced     | Scaling Patterns, Realtime & Streaming APIs               |
| `systems-design.case-storage`   | Case: Object Storage & CDN      | advanced     | Scaling Patterns                                          |
| `systems-design.case-ratelimit` | Case: Rate Limiter & Counters   | core         | Scaling Patterns, Rate Limiting & Resilience              |
| `systems-design.case-search`    | Case: Search & Autocomplete     | advanced     | Scaling Patterns, Search & Indexing                       |
| `systems-design.case-payments`  | Case: Payments & Ledgers        | advanced     | Consistency & Latency Tradeoffs, Distributed Transactions |
| `systems-design.case-ml`        | Case: An ML-Powered Product     | advanced     | Consistency & Latency Tradeoffs                           |

### Infrastructure & Ops (12 topics)

| Topic id                | Title                           | Tier         | Assumes                           |
| ----------------------- | ------------------------------- | ------------ | --------------------------------- |
| `infra.linux`           | Linux & the Shell               | foundational | Operating Systems                 |
| `infra.networking-ops`  | Practical Networking            | core         | Computer Networking               |
| `infra.containers`      | Containers                      | core         | Linux & the Shell                 |
| `infra.orchestration`   | Kubernetes & Orchestration      | advanced     | Containers                        |
| `infra.cloud`           | Cloud Primitives                | core         | Practical Networking              |
| `infra.iac`             | Infrastructure as Code          | core         | Cloud Primitives                  |
| `infra.cicd`            | CI/CD & Release Engineering     | core         | Containers, Git & Version Control |
| `infra.observability`   | Observability                   | core         | CI/CD & Release Engineering       |
| `infra.reliability`     | SLOs & Reliability Engineering  | advanced     | Observability                     |
| `infra.incidents`       | Incident Response & Postmortems | core         | SLOs & Reliability Engineering    |
| `infra.capacity-cost`   | Capacity Planning & Cost        | advanced     | SLOs & Reliability Engineering    |
| `infra.serverless-edge` | Serverless & Edge               | advanced     | Cloud Primitives                  |

### Security (9 topics)

| Topic id                    | Title                            | Tier         | Assumes                                                |
| --------------------------- | -------------------------------- | ------------ | ------------------------------------------------------ |
| `security.foundations`      | Security Foundations             | foundational | —                                                      |
| `security.crypto`           | Applied Cryptography             | core         | Security Foundations                                   |
| `security.identity`         | Identity: OAuth, OIDC & Sessions | core         | Applied Cryptography, AuthN & AuthZ                    |
| `security.appsec`           | Web Application Security         | core         | Security Foundations, HTTP & the Web Platform          |
| `security.secrets`          | Secrets & Key Management         | core         | Applied Cryptography, Infrastructure as Code           |
| `security.network-security` | Network & Infra Security         | advanced     | Web Application Security, Practical Networking         |
| `security.supply-chain`     | Supply Chain Security            | advanced     | Secrets & Key Management, Build Systems & Dependencies |
| `security.privacy`          | Privacy & Compliance             | core         | Security Foundations                                   |
| `security.ml-security`      | ML & LLM Security                | advanced     | Web Application Security                               |

### Data Engineering (9 topics)

| Topic id             | Title                           | Tier     | Assumes                                                     |
| -------------------- | ------------------------------- | -------- | ----------------------------------------------------------- |
| `data.modeling`      | Analytical Data Modeling        | core     | Relational Modeling & SQL                                   |
| `data.warehouse`     | Warehouses, Lakes & Lakehouses  | core     | Analytical Data Modeling                                    |
| `data.ingestion`     | Ingestion & Change Data Capture | core     | Warehouses, Lakes & Lakehouses, Messaging & Event Streaming |
| `data.batch`         | Batch Processing                | core     | Ingestion & Change Data Capture, Batch & Stream Processing  |
| `data.streaming`     | Stream Processing               | advanced | Batch Processing                                            |
| `data.orchestration` | Orchestration & Scheduling      | core     | Batch Processing                                            |
| `data.quality`       | Data Quality & Contracts        | core     | Orchestration & Scheduling                                  |
| `data.analytics-eng` | Analytics Engineering           | core     | Data Quality & Contracts                                    |
| `data.governance`    | Governance & Lineage            | advanced | Data Quality & Contracts, Privacy & Compliance              |

### ML Foundations (11 topics)

| Topic id                         | Title                          | Tier         | Assumes                                  |
| -------------------------------- | ------------------------------ | ------------ | ---------------------------------------- |
| `ml-foundations.linear-algebra`  | Linear Algebra for ML          | foundational | —                                        |
| `ml-foundations.calculus`        | Calculus & Optimization        | foundational | Linear Algebra for ML                    |
| `ml-foundations.probability`     | Probability & Statistics       | foundational | —                                        |
| `ml-foundations.learning-theory` | Learning Theory                | core         | Probability & Statistics                 |
| `ml-foundations.supervised`      | Supervised Learning            | core         | Calculus & Optimization, Learning Theory |
| `ml-foundations.trees`           | Trees & Ensembles              | core         | Supervised Learning                      |
| `ml-foundations.unsupervised`    | Unsupervised Learning          | core         | Supervised Learning                      |
| `ml-foundations.features`        | Feature Engineering            | core         | Supervised Learning                      |
| `ml-foundations.evaluation`      | Model Evaluation               | core         | Learning Theory                          |
| `ml-foundations.causality`       | Causal Inference & Experiments | advanced     | Model Evaluation                         |
| `ml-foundations.timeseries`      | Time Series                    | advanced     | Model Evaluation                         |

### Deep Learning (11 topics)

| Topic id                       | Title                                | Tier     | Assumes                                      |
| ------------------------------ | ------------------------------------ | -------- | -------------------------------------------- |
| `deep-learning.neural-nets`    | Neural Networks & Backprop           | core     | Calculus & Optimization, Supervised Learning |
| `deep-learning.frameworks`     | Frameworks & Autodiff                | core     | Neural Networks & Backprop                   |
| `deep-learning.training`       | Training Dynamics                    | core     | Frameworks & Autodiff                        |
| `deep-learning.regularization` | Regularization & Generalization      | core     | Training Dynamics                            |
| `deep-learning.cnn`            | Convolutional Networks & Vision      | core     | Training Dynamics                            |
| `deep-learning.sequence`       | Sequence Models                      | core     | Training Dynamics                            |
| `deep-learning.attention`      | Attention & Transformers             | advanced | Sequence Models                              |
| `deep-learning.representation` | Embeddings & Representation Learning | core     | Attention & Transformers                     |
| `deep-learning.generative`     | Generative Models                    | advanced | Embeddings & Representation Learning         |
| `deep-learning.rl`             | Reinforcement Learning               | advanced | Training Dynamics, Probability & Statistics  |
| `deep-learning.graph`          | Graph Neural Networks                | advanced | Embeddings & Representation Learning         |

### LLMs & Frontier AI (14 topics)

| Topic id           | Title                              | Tier         | Assumes                                                               |
| ------------------ | ---------------------------------- | ------------ | --------------------------------------------------------------------- |
| `llm.tokenization` | Tokenization & Text Representation | core         | Attention & Transformers                                              |
| `llm.architecture` | Modern LLM Architecture            | advanced     | Tokenization & Text Representation                                    |
| `llm.pretraining`  | Pretraining & Data                 | advanced     | Modern LLM Architecture                                               |
| `llm.scaling-laws` | Scaling Laws & Compute             | advanced     | Pretraining & Data                                                    |
| `llm.finetuning`   | Fine-Tuning & PEFT                 | core         | Pretraining & Data                                                    |
| `llm.alignment`    | Alignment: RLHF & DPO              | advanced     | Fine-Tuning & PEFT, Reinforcement Learning                            |
| `llm.reasoning`    | Reasoning & Test-Time Compute      | advanced     | Alignment: RLHF & DPO                                                 |
| `llm.prompting`    | Prompting & Context Engineering    | foundational | Tokenization & Text Representation                                    |
| `llm.rag`          | Retrieval-Augmented Generation     | core         | Prompting & Context Engineering, Embeddings & Representation Learning |
| `llm.agents`       | Agents & Tool Use                  | advanced     | Retrieval-Augmented Generation                                        |
| `llm.evaluation`   | LLM Evaluation                     | core         | Prompting & Context Engineering, Model Evaluation                     |
| `llm.multimodal`   | Multimodal Models                  | advanced     | Modern LLM Architecture                                               |
| `llm.safety`       | Safety, Guardrails & Red-Teaming   | core         | LLM Evaluation, ML & LLM Security                                     |
| `llm.frontier`     | Frontier Systems                   | advanced     | Reasoning & Test-Time Compute, Multimodal Models                      |

### ML Systems & MLOps (13 topics)

| Topic id                            | Title                              | Tier         | Assumes                                               |
| ----------------------------------- | ---------------------------------- | ------------ | ----------------------------------------------------- |
| `ml-systems.lifecycle`              | The ML Lifecycle                   | foundational | Model Evaluation                                      |
| `ml-systems.data-pipelines`         | ML Data Pipelines & Feature Stores | core         | The ML Lifecycle, Orchestration & Scheduling          |
| `ml-systems.experiment-tracking`    | Experiments & Reproducibility      | core         | The ML Lifecycle                                      |
| `ml-systems.training-infra`         | Training Infrastructure            | core         | ML Data Pipelines & Feature Stores                    |
| `ml-systems.gpu`                    | GPUs, CUDA & Accelerators          | advanced     | Training Infrastructure, Computer Architecture        |
| `ml-systems.distributed-training`   | Distributed Training               | advanced     | GPUs, CUDA & Accelerators, Distributed Fundamentals   |
| `ml-systems.serving`                | Model Serving                      | core         | The ML Lifecycle, REST API Design                     |
| `ml-systems.inference-optimization` | Inference Optimization             | advanced     | Model Serving, GPUs, CUDA & Accelerators              |
| `ml-systems.vector-search`          | Vector Search & Retrieval Infra    | core         | Model Serving, Retrieval-Augmented Generation         |
| `ml-systems.monitoring`             | ML Monitoring & Drift              | core         | Model Serving                                         |
| `ml-systems.evaluation-infra`       | Evaluation & Online Testing        | advanced     | ML Monitoring & Drift, Causal Inference & Experiments |
| `ml-systems.recsys`                 | Recommendation & Ranking           | advanced     | Evaluation & Online Testing, Unsupervised Learning    |
| `ml-systems.cost`                   | Cost & Capacity for ML             | advanced     | Inference Optimization                                |
