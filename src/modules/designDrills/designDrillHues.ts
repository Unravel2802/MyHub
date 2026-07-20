import type { HueName } from "@/src/components/moduleHues";
import type { DesignDrillCategory } from "@/src/modules/designDrills/types";

// Reuses Prep Tracker's exact system_design / ml_system_design hues
// (src/modules/prep/prepTypeHues.ts) so the same concept reads as the same
// color everywhere in the app, not just within this module.
export const DESIGN_DRILL_CATEGORY_HUES: Record<DesignDrillCategory, HueName> =
  {
    system_design: "blue",
    ml_system_design: "violet",
  };
