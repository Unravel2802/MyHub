import type { HueName } from "@/src/components/moduleHues";
import type { ApplicationStage } from "@/src/modules/jobApplications/types";

export type StageHue = HueName | "danger" | "muted";

export const STAGE_HUES: Record<ApplicationStage, StageHue> = {
  researching: "muted",
  applied: "blue",
  oa: "cyan",
  phone_screen: "teal",
  onsite: "violet",
  offer: "emerald",
  rejected: "danger",
  withdrawn: "muted",
};
