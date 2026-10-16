import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const widgetRegistry: Readonly<Record<string, ComponentType>> = {
  "estimation-calculator": dynamic(() => import("./EstimationCalculator")),
};
