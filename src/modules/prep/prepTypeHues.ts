import type { HueName } from "@/src/components/moduleHues";
import type { PrepEntryType } from "@/src/modules/prep/types";

export const PREP_TYPE_HUES: Record<PrepEntryType, HueName> = {
  algorithm: "cyan",
  system_design: "blue",
  ml_system_design: "violet",
  behavioral: "rose",
  mock_interview: "amber",
  resume_deep_dive: "emerald",
};
