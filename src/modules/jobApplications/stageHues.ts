import type { HueName } from "@/src/components/moduleHues";
import type { ApplicationStage } from "@/src/modules/jobApplications/types";

export type StageHue = HueName | "danger" | "muted";

export const STAGE_HUES: Record<ApplicationStage, StageHue> = {
  researching: "muted",
  applied: "blue",
  oa: "cyan",
  interview: "teal",
  onsite: "violet",
  awaiting_result: "amber",
  offer: "emerald",
  rejected: "danger",
};
