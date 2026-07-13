import type {
  Application,
  ApplicationStage,
  Interview,
} from "@/src/modules/jobApplications/types";

// Pure funnel aggregation for the Job CRM (myhub_plan.md Part B, Phase 4).
// No DB access: the store loads applications and interviews, this turns them
// into the conversion numbers the roadmap's §11.2 review asks about.

export type StageCounts = Record<ApplicationStage, number>;

const EMPTY_STAGE_COUNTS: StageCounts = {
  researching: 0,
  applied: 0,
  oa: 0,
  phone_screen: 0,
  onsite: 0,
  offer: 0,
  rejected: 0,
  withdrawn: 0,
};

// Stages that mean a human on the other side actually engaged with you. Note
// `rejected` is NOT here — a rejection tells you nothing about whether you were
// ever responded to. That's what `hasResponded` below is for.
const RESPONDED_STAGES = new Set<ApplicationStage>([
  "oa",
  "phone_screen",
  "onsite",
  "offer",
]);

export interface FunnelStats {
  byStage: StageCounts;
  // Applications that were actually SENT — everything past `researching`. This
  // is the denominator for every rate below: a company you're still researching
  // hasn't had the chance to respond, so counting it would drag every rate down
  // and make the numbers meaningless.
  pastApplied: number;
  // All 0-1, or null when `pastApplied` is 0. NULL, NEVER 0 — "I've applied to
  // nothing" and "I've applied to 40 places and heard nothing back" are wildly
  // different situations, and a UI rendering both as "0%" would be lying about
  // the second. The UI renders null as "—".
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
}

// Did this application ever get a real response? Two independent signals, and
// we need BOTH because either alone misses cases:
//
//   - Current stage is OA-or-later: catches applications still in flight.
//   - Has at least one interview: catches applications that got a response,
//     progressed, and were THEN rejected. Their current stage is `rejected`,
//     which a stage-only read would score identically to a cold-ghosted
//     application — badly wrong, and exactly backwards from what it feels like
//     to be the person who did the interview.
function hasResponded(
  application: Application,
  interviewsByApplication: Map<string, Interview[]>,
): boolean {
  if (RESPONDED_STAGES.has(application.stage)) return true;
  return (interviewsByApplication.get(application.id)?.length ?? 0) > 0;
}

export function funnelStats(
  applications: Application[],
  interviews: Interview[],
): FunnelStats {
  const liveApplications = applications.filter(
    (application) => !application.deletedAt,
  );

  const interviewsByApplication = new Map<string, Interview[]>();
  for (const interview of interviews) {
    if (interview.deletedAt) continue;
    const existing = interviewsByApplication.get(interview.applicationId) ?? [];
    existing.push(interview);
    interviewsByApplication.set(interview.applicationId, existing);
  }

  const byStage = { ...EMPTY_STAGE_COUNTS };
  for (const application of liveApplications) {
    byStage[application.stage] += 1;
  }

  const sent = liveApplications.filter(
    (application) => application.stage !== "researching",
  );
  const pastApplied = sent.length;

  const responded = sent.filter((application) =>
    hasResponded(application, interviewsByApplication),
  ).length;

  // "Reached an interview" means a real scheduled round happened, not merely
  // that the stage advanced — an OA isn't an interview.
  const interviewed = sent.filter(
    (application) =>
      (interviewsByApplication.get(application.id)?.length ?? 0) > 0,
  ).length;

  const offers = sent.filter(
    (application) => application.stage === "offer",
  ).length;

  const rate = (numerator: number) =>
    pastApplied === 0 ? null : numerator / pastApplied;

  return {
    byStage,
    pastApplied,
    responseRate: rate(responded),
    interviewRate: rate(interviewed),
    offerRate: rate(offers),
  };
}
