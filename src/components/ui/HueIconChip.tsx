import type { LucideIcon } from "lucide-react";
import type { HueName } from "@/src/components/moduleHues";
import { HUE_BADGE } from "@/src/components/ui/hueClasses";

interface HueIconChipProps {
  hue: HueName;
  icon: LucideIcon;
}

// A module's icon in its own filled, tinted badge — the treatment a Figma
// reference brought in for the hub's app cards, which every card was missing:
// icons were colored (via `hueVar`) but sat bare on the panel, so the hue read
// as a slightly-tinted glyph rather than a distinct "room." Built on
// `HUE_BADGE` rather than a new class map — it's the same bg/text/border
// triplet a pill badge already uses, just squared off around an icon instead
// of wrapped around text.
export function HueIconChip({ hue, icon: Icon }: HueIconChipProps) {
  return (
    <span
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border ${HUE_BADGE[hue]}`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}
