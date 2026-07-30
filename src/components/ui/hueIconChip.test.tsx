import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Rocket } from "lucide-react";
import { HueIconChip } from "@/src/components/ui/HueIconChip";
import { HUE_BADGE } from "@/src/components/ui/hueClasses";

describe("HueIconChip", () => {
  it("carries the module's hue via HUE_BADGE, not a bespoke class", () => {
    const html = renderToStaticMarkup(
      <HueIconChip hue="violet" icon={Rocket} />,
    );

    for (const cls of HUE_BADGE.violet.split(" ")) expect(html).toContain(cls);
  });

  it("renders a different hue's classes for a different hue", () => {
    const lime = renderToStaticMarkup(<HueIconChip hue="lime" icon={Rocket} />);
    const rose = renderToStaticMarkup(<HueIconChip hue="rose" icon={Rocket} />);

    expect(lime).not.toBe(rose);
    expect(lime).toContain("hue-lime");
    expect(rose).toContain("hue-rose");
  });

  it("hides the icon from assistive tech — the label beside it already names the app", () => {
    const html = renderToStaticMarkup(<HueIconChip hue="blue" icon={Rocket} />);

    expect(html).toContain('aria-hidden="true"');
  });
});
