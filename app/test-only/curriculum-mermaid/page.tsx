import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  hueBorderVar,
  hueSurfaceVar,
  hueVar,
} from "@/src/components/moduleHues";
import { MermaidDiagram } from "@/src/modules/curriculum/components/MermaidDiagram";

export const dynamic = "force-dynamic";

// Only Playwright's server enables this route. Broken syntax never enters the
// repository's chapter files and this fixture is a 404 in a normal deployment.
export default async function MermaidFixture({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  if (process.env.MYHUB_UI_TESTS !== "1") notFound();
  const wide = (await searchParams).variant === "wide";
  return (
    <main
      className="mx-auto w-full min-w-0 max-w-[740px] p-4 font-sans"
      style={
        {
          "--track": hueVar("teal"),
          "--track-surface": hueSurfaceVar("teal"),
          "--track-border": hueBorderVar("teal"),
        } as CSSProperties
      }
    >
      <h1 className="text-xl text-foreground">
        Mermaid {wide ? "wide" : "failure"} fixture
      </h1>
      <MermaidDiagram
        caption={wide ? "Wide diagram fixture" : "Broken diagram fixture"}
        raw={
          wide
            ? "flowchart LR\n  A[Request] -->|validate input| B[Process]\n  B -->|persist result| C[Store]"
            : "flowchart LR\n  A[unterminated"
        }
      />
    </main>
  );
}
