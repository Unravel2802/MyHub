import type { ReadinessArea, RoadmapMonth } from "@/src/modules/roadmap/types";

// The roadmap, transcribed from engineering_first_roadmap_v2.md §6.5 and §6.1.
//
// TRANSCRIBED, NOT INVENTED. Every number here cites the line it came from. If a
// target can't be pointed at the roadmap, it doesn't belong — the whole value of
// this page is that hitting a milestone means something real. Same rule as
// achievementCatalog, and for the same reason.
//
// Weekly rates are converted to monthly volumes where the roadmap states them
// that way ("5-10 applications/week" -> 20/month at the lower bound). The lower
// bound is used deliberately: the target is the floor you must clear, not the
// ceiling you might reach.

export const ROADMAP_MONTHS: RoadmapMonth[] = [
  {
    key: "2026-07",
    label: "July 2026",
    theme: "Setup and positioning",
    gate: "Two resumes, a target list, diagnostic baselines, and a design doc someone else could read and understand. No code beyond the skeleton — design first.",
    criteria: [
      {
        kind: "auto",
        key: "2026-07.algorithms",
        label: "10 timed algorithm problems (diagnostic baseline)",
        source: "§6.5 July — technical diagnostics",
        target: 10,
        measure: { source: "prep", entryType: "algorithm", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-07.system_design",
        label: "One backend system-design case",
        source: "§6.5 July — technical diagnostics",
        target: 1,
        measure: { source: "prep", entryType: "system_design", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-07.ml_system_design",
        label: "One ML system-design case",
        source: "§6.5 July — technical diagnostics",
        target: 1,
        measure: {
          source: "prep",
          entryType: "ml_system_design",
          scope: "month",
        },
      },
      {
        kind: "auto",
        key: "2026-07.target_list",
        label: "Target-company list (40–60 across reach/match/safety)",
        source: "§6.5 July — career work",
        target: 40,
        measure: { source: "companies", scope: "cumulative" },
      },
      {
        kind: "manual",
        key: "2026-07.resumes",
        label: "Two resume variants (SWE/backend, MLE/ML-infra)",
        source: "§6.5 July — career work",
      },
      {
        kind: "manual",
        key: "2026-07.design_doc",
        label: "Flagship design doc (retrieval, refusal, eval, cost model)",
        source: "§6.5 July — flagship project setup",
      },
      {
        kind: "manual",
        key: "2026-07.repo_skeleton",
        label: "Repository skeleton: structure, CI, linting, README",
        source: "§6.5 July — flagship project setup",
      },
      {
        kind: "manual",
        key: "2026-07.explanation_recording",
        label: "20-minute project explanation, recorded and reviewed",
        source: "§6.5 July — technical diagnostics",
      },
    ],
  },
  {
    key: "2026-08",
    label: "August 2026",
    theme: "Backend refresh, retrieval v0",
    gate: "A locally runnable retrieval service that takes a query and returns BM25-ranked chunks from real public documents, with tests and a documented API. Not polished — functional.",
    criteria: [
      {
        kind: "auto",
        key: "2026-08.algorithms",
        label: "12 algorithm problems, biased to July's weak areas",
        source: "§6.5 August — 12–15 algorithm problems (lower bound)",
        target: 12,
        measure: { source: "prep", entryType: "algorithm", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-08.behavioral_stories",
        label: "Two behavioral stories drafted",
        source: "§6.5 August — draft two behavioral stories",
        target: 2,
        measure: { source: "behavioralStories", scope: "cumulative" },
      },
      {
        kind: "manual",
        key: "2026-08.retrieval_v0",
        label: "BM25 retrieval service: runnable, tested, documented API",
        source: "§6.5 August gate",
      },
    ],
  },
  {
    key: "2026-09",
    label: "September 2026",
    theme: "Hybrid search; applications begin",
    gate: "Hybrid retrieval working end-to-end with measurable quality. Application funnel is open and active.",
    criteria: [
      {
        kind: "auto",
        key: "2026-09.algorithms",
        label: "15 algorithm problems",
        source: "§6.5 September — interview work",
        target: 15,
        measure: { source: "prep", entryType: "algorithm", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-09.system_design",
        label: "One backend system-design case",
        source: "§6.5 September — two system-design cases (one backend, one ML)",
        target: 1,
        measure: { source: "prep", entryType: "system_design", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-09.ml_system_design",
        label: "One ML-flavored system-design case",
        source: "§6.5 September — two system-design cases (one backend, one ML)",
        target: 1,
        measure: {
          source: "prep",
          entryType: "ml_system_design",
          scope: "month",
        },
      },
      {
        kind: "auto",
        key: "2026-09.mock",
        label: "One mock interview",
        source: "§6.5 September — interview work",
        target: 1,
        measure: {
          source: "prep",
          entryType: "mock_interview",
          scope: "month",
        },
      },
      {
        kind: "auto",
        key: "2026-09.applications",
        label: "First wave of applications (5–10/week)",
        source: "§6.5 September — recruiting; 5/wk floor over ~4 weeks",
        target: 20,
        measure: { source: "applications", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-09.outreach",
        label: "Outreach conversations (2–3/week)",
        source: "§6.5 September — recruiting; 2/wk floor over ~4 weeks",
        target: 8,
        measure: { source: "outreach", scope: "month" },
      },
      {
        kind: "manual",
        key: "2026-09.hybrid_retrieval",
        label: "Dense retrieval + hybrid score fusion, end to end",
        source: "§6.5 September — build",
      },
      {
        kind: "manual",
        key: "2026-09.retrieval_metric",
        label: "Retrieval-quality metric (recall@k or MRR) on a labeled set",
        source: "§6.5 September — build",
      },
      {
        kind: "manual",
        key: "2026-09.containerized",
        label: "Service containerized (Docker Compose, multi-service)",
        source: "§6.5 September — build",
      },
    ],
  },
  {
    key: "2026-10",
    label: "October 2026",
    theme: "Multi-hop, refusal, evaluation harness",
    gate: "The project demonstrates ML engineering judgment (multi-hop, refusal, evaluation), not just API plumbing. You can explain the retrieval → refusal → evaluation loop clearly in a deep-dive.",
    criteria: [
      {
        kind: "auto",
        key: "2026-10.algorithms",
        label: "15 algorithm problems",
        source: "§6.5 October — interview work",
        target: 15,
        measure: { source: "prep", entryType: "algorithm", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-10.applications",
        label: "Maintain 5–10 applications/week",
        source: "§6.5 October — recruiting; 5/wk floor",
        target: 20,
        measure: { source: "applications", scope: "month" },
      },
      {
        kind: "auto",
        key: "2026-10.outreach",
        label: "Maintain 2–3 outreach conversations/week",
        source: "§11.2 — weekly outreach cadence",
        target: 8,
        measure: { source: "outreach", scope: "month" },
      },
      {
        kind: "manual",
        key: "2026-10.multi_hop",
        label: "Multi-hop retrieval implemented",
        source: "§6.5 October — build",
      },
      {
        kind: "manual",
        key: "2026-10.refusal_path",
        label: "Refusal path on insufficient evidence",
        source: "§6.5 October — build",
      },
      {
        kind: "manual",
        key: "2026-10.eval_harness",
        label: "Evaluation harness with real metrics, not spot checks",
        source: "§6.5 October — build",
      },
    ],
  },
  {
    key: "2026-11",
    label: "November 2026",
    theme: "Deployment, load testing; RL sidecar begins",
    gate: "The flagship is deployable, observable, load-tested, and you can describe its failure modes. The RL sidecar has a defined problem statement and a baseline to beat.",
    criteria: [
      {
        kind: "auto",
        key: "2026-11.mocks",
        label: "Weekly mock loops (4 this month)",
        source: "§6.5 November — weekly mock loops from this point forward",
        target: 4,
        measure: {
          source: "prep",
          entryType: "mock_interview",
          scope: "month",
        },
      },
      {
        kind: "auto",
        key: "2026-11.applications",
        label: "Maintain 5–10 applications/week",
        source: "§11.2 — weekly application cadence",
        target: 20,
        measure: { source: "applications", scope: "month" },
      },
      {
        kind: "manual",
        key: "2026-11.deployed",
        label: "Deployed, observable, load-tested; failure modes documented",
        source: "§6.5 November gate",
      },
      {
        kind: "manual",
        key: "2026-11.rl_baseline",
        label: "RL sidecar: problem statement + baseline to beat",
        source: "§6.5 November gate",
      },
    ],
  },
  {
    key: "2026-12",
    label: "December 2026",
    theme: "Flagship v1.0 · semester review",
    gate: "The semester checkpoint: 75–100 algorithms, 6 system-design, 2 ML-system-design, 14 mocks. Flagship v1.0 released.",
    criteria: [
      {
        kind: "auto",
        key: "2026-12.algorithms_total",
        label: "75 algorithm problems (cumulative)",
        source: "§6.5 December — semester review, target 75–100",
        target: 75,
        measure: { source: "prep", entryType: "algorithm", scope: "cumulative" },
      },
      {
        kind: "auto",
        key: "2026-12.system_design_total",
        label: "6 system-design cases (cumulative)",
        source: "§6.5 December — semester review",
        target: 6,
        measure: {
          source: "prep",
          entryType: "system_design",
          scope: "cumulative",
        },
      },
      {
        kind: "auto",
        key: "2026-12.ml_system_design_total",
        label: "2 ML-system-design cases (cumulative)",
        source: "§6.5 December — semester review",
        target: 2,
        measure: {
          source: "prep",
          entryType: "ml_system_design",
          scope: "cumulative",
        },
      },
      {
        kind: "auto",
        key: "2026-12.mocks_total",
        label: "14 mock interviews (cumulative)",
        source: "§6.5 December — 6 coding + 6 system design + 2 ML",
        target: 14,
        measure: {
          source: "prep",
          entryType: "mock_interview",
          scope: "cumulative",
        },
      },
      {
        kind: "manual",
        key: "2026-12.flagship_v1",
        label: "Flagship v1.0 released",
        source: "§6.5 December — flagship v1.0 release",
      },
      {
        kind: "manual",
        key: "2026-12.semester_review",
        label: "Semester review written (§15's questions answered honestly)",
        source: "§6.5 December — semester review",
      },
    ],
  },
  {
    key: "2027-01",
    label: "January 2027",
    theme: "RL sidecar; full interview loops",
    gate: "The RL sidecar has a trained policy with measured results against a baseline, and you can articulate what worked and what didn't. Interview loops feel like practice, not panic.",
    criteria: [
      {
        kind: "auto",
        key: "2027-01.mocks",
        label: "Weekly mock loops (4 this month)",
        source: "§6.5 January — full interview loops",
        target: 4,
        measure: {
          source: "prep",
          entryType: "mock_interview",
          scope: "month",
        },
      },
      {
        kind: "auto",
        key: "2027-01.applications",
        label: "Maintain 5–10 applications/week",
        source: "§6.5 January — recruiting",
        target: 20,
        measure: { source: "applications", scope: "month" },
      },
      {
        kind: "manual",
        key: "2027-01.rl_trained",
        label: "Trained RL policy with measured results vs the baseline",
        source: "§6.5 January gate",
      },
    ],
  },
  {
    key: "2027-02",
    label: "February 2027",
    theme: "Interview volume and polish",
    gate: "Both projects complete and presentable. Interview performance is consistent, not volatile.",
    criteria: [
      {
        kind: "auto",
        key: "2027-02.algorithms_total",
        label: "150 algorithm problems (cumulative)",
        source: "§6.5 February — 150+ total",
        target: 150,
        measure: { source: "prep", entryType: "algorithm", scope: "cumulative" },
      },
      {
        kind: "auto",
        key: "2027-02.system_design_total",
        label: "10 system-design cases (cumulative)",
        source: "§6.5 February — 10+ total",
        target: 10,
        measure: {
          source: "prep",
          entryType: "system_design",
          scope: "cumulative",
        },
      },
      {
        kind: "auto",
        key: "2027-02.ml_system_design_total",
        label: "5 ML-system-design cases (cumulative)",
        source: "§6.5 February — 5+ total",
        target: 5,
        measure: {
          source: "prep",
          entryType: "ml_system_design",
          scope: "cumulative",
        },
      },
      {
        kind: "auto",
        key: "2027-02.behavioral_stories",
        label: "8 behavioral stories, concise + extended",
        source: "§6.5 February — 8 stories with both versions",
        target: 8,
        measure: { source: "behavioralStories", scope: "cumulative" },
      },
      {
        kind: "manual",
        key: "2027-02.projects_complete",
        label: "Both projects complete and presentable",
        source: "§6.5 February gate",
      },
    ],
  },
  {
    key: "2027-03",
    label: "March 2027",
    theme: "External evidence",
    gate: "At least one piece of external evidence (a PR, a post, a talk) beyond your own repos. Interview performance stable enough that you're not dreading loops.",
    criteria: [
      {
        kind: "auto",
        key: "2027-03.applications",
        label: "Maintain 5–10 applications/week",
        source: "§11.2 — weekly application cadence",
        target: 20,
        measure: { source: "applications", scope: "month" },
      },
      {
        kind: "manual",
        key: "2027-03.external_evidence",
        label: "External evidence: a merged PR, a post, or a talk",
        source: "§6.5 March gate",
      },
    ],
  },
  {
    key: "2027-04",
    label: "April 2027",
    theme: "Packaging, negotiation, decisions",
    gate: "",
    criteria: [
      {
        kind: "manual",
        key: "2027-04.portfolio_packaged",
        label: "Portfolio packaged: repos, writeups, demo",
        source: "§6.5 April",
      },
      {
        kind: "manual",
        key: "2027-04.negotiation_ready",
        label: "Negotiation prepared (see §12.1's offer evaluator)",
        source: "§6.5 April",
      },
    ],
  },
  {
    key: "2027-05",
    label: "May 2027",
    theme: "Graduate and transition",
    gate: "",
    criteria: [
      {
        kind: "manual",
        key: "2027-05.offer_accepted",
        label: "Offer accepted",
        source: "§6.5 May — graduate and transition",
      },
    ],
  },
];

// §6.1's graduation readiness matrix. Target is the "Strong" column across all
// seven — that's what "strong across the board" means, and it's why the radar
// chart shows the full heptagon as the goal.
export const READINESS_AREAS: ReadinessArea[] = [
  {
    key: "algorithms",
    label: "Algorithms",
    minimum: "Mediums in 30–35 min",
    strong: "Most mediums in 20–30 min, clean explanation",
    // The one bar in the matrix that's a MEASURABLE number, and prepScorecard
    // already computes it. Claim Strong while averaging 38 minutes and the page
    // should say so.
    evidence: { kind: "avgSolveTime", strongMaxMinutes: 30 },
  },
  {
    key: "backend",
    label: "Backend",
    minimum: "Ship a reliable service",
    strong:
      "Own API, storage, caching, queueing, observability, load testing",
    evidence: null,
  },
  {
    key: "distributed_systems",
    label: "Distributed systems",
    minimum: "Explain core concepts",
    strong:
      "Implement and evaluate failure/consistency/scaling tradeoffs",
    evidence: null,
  },
  {
    key: "ml_systems",
    label: "ML systems",
    minimum: "Deploy and monitor a model",
    strong: "Versioning, evaluation, canarying, rollback, cost controls",
    evidence: null,
  },
  {
    key: "system_design",
    label: "System design",
    minimum: "New-grad-level designs",
    strong: "Lead 45-min designs with capacity and failure analysis",
    evidence: null,
  },
  {
    key: "portfolio",
    label: "Portfolio",
    minimum: "Tutorials",
    strong: "One flagship system built to genuine depth",
    evidence: null,
  },
  {
    key: "recruiting",
    label: "Recruiting",
    minimum: "One generic resume",
    strong: "Role-specific resumes, tracked funnel, active mock loops",
    // "Tracked funnel" is literally what funnelStats measures.
    evidence: { kind: "funnelActive", minApplications: 20 },
  },
];

// May 2027 — the one number that never stops mattering.
export const GRADUATION_DATE = "2027-05-31";
