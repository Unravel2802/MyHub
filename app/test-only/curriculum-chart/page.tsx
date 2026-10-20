import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  hueBorderVar,
  hueSurfaceVar,
  hueVar,
} from "@/src/components/moduleHues";
import { ChartBlock } from "@/src/modules/curriculum/components/ChartBlock";

export const dynamic = "force-dynamic";

// Exercise DS1's labels before that content is on main. This route is unavailable
// outside the explicitly enabled production-build Playwright server.
export default function ChartFixture() {
  if (process.env.MYHUB_UI_TESTS !== "1") notFound();
  return (
    <main
      className="mx-auto w-full min-w-0 max-w-[740px] p-4"
      style={
        {
          "--track": hueVar("teal"),
          "--track-surface": hueSurfaceVar("teal"),
          "--track-border": hueBorderVar("teal"),
        } as CSSProperties
      }
    >
      <h1 className="text-xl text-foreground">Chart label layout fixture</h1>
      <ChartBlock
        caption="Inventory latency"
        raw={`type: bar
unit: ms
---
In-process inventory check: 0.001
Remote inventory check: 2
In-process stock reservation: 0.001
Reservation across exceptionally long regional service boundaries: 2`}
      />
      <ChartBlock
        caption="Monthly cost"
        raw={`type: bar
unit: $/month
---
In-process stock reservation: 50
Reservation across exceptionally long regional service boundaries: 100`}
      />
    </main>
  );
}
