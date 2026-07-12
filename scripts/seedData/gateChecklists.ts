// Monthly gate checklist seed data (engineering_first_roadmap_v2.md §6.5,
// July 2026 through May 2027). Pure data, no DB access — the seed script
// (Codex's, see docs/handoff/seed-scripts.md) creates one top-level parent
// task per month titled to match dashboardSelectors.gateChecklistTitleFor's
// convention ("Gate: <Month> <Year>"), then one subtask per checklist item.
//
// Every subtask string below is drawn directly from that month's roadmap
// section — this is extraction, not invention. Where the roadmap only gives a
// one-sentence "gate" summary rather than a bulleted list (e.g. September,
// October), the summary is split into the concrete deliverables named earlier
// in that month's "Build"/"Interview work"/"Recruiting" subsections, not
// paraphrased from nothing.

export interface GateChecklistSeedEntry {
  monthLabel: string; // matches gateChecklistTitleFor's "MMMM yyyy" format
  subtasks: string[];
}

export const GATE_CHECKLIST_SEED: GateChecklistSeedEntry[] = [
  {
    monthLabel: "July 2026",
    subtasks: [
      "Confirm ML systems/AI infrastructure as primary specialization, backend/distributed systems as secondary",
      "Build two resume variants (SWE/backend, MLE/ML-infra)",
      "Build target-company list: 40-60 companies across reach/match/safety tiers",
      "Set up an application tracker",
      "Run diagnostics: 10 timed algorithm problems — record solve rate, average time, weakest topics",
      "One backend system-design case",
      "One ML system-design case",
      "One 20-minute project explanation recording, reviewed for clarity",
      "Write the flagship project design document",
      "Stand up the flagship project repo skeleton (structure, CI, linting, README outline)",
    ],
  },
  {
    monthLabel: "August 2026",
    subtasks: [
      "Document ingestion pipeline for public data (PDFs, web pages, plain text)",
      "BM25 retrieval baseline — end-to-end query to ranked results",
      "PostgreSQL persistence for documents and chunks",
      "Basic request validation and structured logging",
      "Unit and integration tests for ingestion and retrieval paths",
      "12-15 algorithm problems, biased toward weak areas from July diagnostics",
      "Draft two behavioral stories (technical leadership, conflict/tradeoff)",
      "One mock coding interview",
      "Begin monitoring job boards for early new-grad SWE/MLE openings",
      "Contact 2-3 UMass alumni or engineers at target companies",
    ],
  },
  {
    monthLabel: "September 2026",
    subtasks: [
      "Add dense retrieval alongside BM25 (own index)",
      "Implement hybrid score fusion between BM25 and dense retrieval",
      "Add structured evaluation: at least one retrieval-quality metric (recall@k or MRR) against a labeled test set",
      "Containerize the service (Docker Compose, local multi-service setup)",
      "15 algorithm problems",
      "Two system-design cases (one backend, one ML-flavored)",
      "One mock interview (coding or system design)",
      "Submit first wave of targeted applications (5-10/week)",
      "2-3 outreach conversations/week via UMass network, LinkedIn, or professors",
    ],
  },
  {
    monthLabel: "October 2026",
    subtasks: [
      "Add multi-hop retrieval layer (retrieve, extract entities, retrieve again, combine evidence)",
      "Implement refusal logic for insufficient/conflicting evidence",
      "Build a real evaluation harness: versioned test sets, automated metrics, results stored and comparable",
      "Add Prometheus metrics and a basic Grafana dashboard",
      "15 algorithm problems",
      "Two system-design mocks",
      "One ML-system-design mock",
      "Maintain 5-10 applications/week",
      "Write post-mortems for any completed interviews",
    ],
  },
  {
    monthLabel: "November 2026",
    subtasks: [
      "Kubernetes manifests or Helm chart for the full service",
      "Readiness/liveness probes, autoscaling policy",
      "Load-test suite: throughput, p50/p95/p99 latency under realistic load",
      "Failure-injection scenarios documented (index down, DB slow, recovery behavior)",
      "Define the RL sidecar decision problem (retrieve-again / answer / refuse)",
      "Set up a heuristic baseline for the RL sidecar",
      "Implement the RL environment and reward signal",
      "Two coding mocks, two system-design mocks, one ML-system-design mock",
    ],
  },
  {
    monthLabel: "December 2026",
    subtasks: [
      "Architecture diagram",
      "Reproducible setup instructions",
      "Test suite (unit + integration)",
      "CI/CD pipeline",
      "Benchmark report: retrieval quality, latency/throughput, refusal accuracy",
      "Load-test data and analysis",
      "Failure-mode documentation",
      "Five-minute demo (recorded or live-ready)",
      "Technical report: architecture, tradeoffs, comparison to the VSF version",
      "Semester review: total algorithm problems (target 75-100), mocks completed (target 6+ coding, 6+ system-design, 2+ ML-system-design), applications/responses/interviews and conversion rate",
      "Winter break: repair the single biggest weakness found, not a new project",
    ],
  },
  {
    monthLabel: "January 2027",
    subtasks: [
      "Train the RL sidecar policy on the retrieve/answer/refuse decision",
      "Compare against the heuristic baseline — does it actually outperform threshold rules?",
      "Analyze failure cases: false refusals and false answers",
      "Document decision-boundary behavior clearly enough to present in an interview",
      "Full interview loops (coding + system design + ML system design + behavioral + project deep-dive) every two weeks",
      "Practice the flagship project deep-dive (45 min without running out of depth)",
      "Practice the RL sidecar explanation (10 min)",
      "Maintain 5-10 applications/week",
    ],
  },
  {
    monthLabel: "February 2027",
    subtasks: [
      "Write up RL sidecar results: before/after comparison, failure analysis",
      "Clean the RL sidecar repo (README, reproducible setup, evaluation scripts) — then stop, resist adding features",
      "Full interview loops weekly if possible",
      "5-10 applications/week sustained",
      "2-3 referral/outreach conversations/week",
      "Post-mortem every real interview within 24 hours",
      "Reach 150+ algorithm problems total",
      "Reach 10+ system-design cases total",
      "Reach 5+ ML-system-design cases total",
      "Reach 8 behavioral stories with concise and extended versions",
    ],
  },
  {
    monthLabel: "March 2027",
    subtasks: [
      "Profile and fix the flagship project's worst bottleneck",
      "Update benchmarks with before/after measurements",
      "Complete at least one external-credibility item: an OSS PR, a technical blog post, a public benchmark comparison, or a UMass meetup/reading-group talk",
      "Begin salary/equity research for companies in late-stage processes",
    ],
  },
  {
    monthLabel: "April 2027",
    subtasks: [
      "Clean and document both repos",
      "Polish technical report(s)",
      "Review GitHub profile: pin the two flagship repos, remove noise",
      "Update resume bullets with real, measured results",
      "Evaluate offers using the Section 12.1 framework — don't collapse to salary alone",
      "Negotiate with data if multiple offers exist",
      "If zero offers, assess the thesis-year contingency early, not in May",
    ],
  },
  {
    monthLabel: "May 2027",
    subtasks: [
      "Accept an offer and plan the transition (relocation, start date, onboarding)",
      "If no satisfactory offer: activate the thesis-year contingency with a specific plan for what the extra year adds",
      "Archive interview prep materials and the application tracker",
    ],
  },
];
