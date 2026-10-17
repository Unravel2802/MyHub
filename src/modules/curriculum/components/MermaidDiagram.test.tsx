import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MermaidDiagram } from "./MermaidDiagram";

const imported = vi.hoisted(() => ({ mermaid: false }));
vi.mock("mermaid", () => {
  imported.mermaid = true;
  throw new Error("Mermaid must not execute during server rendering");
});
it("server-renders a source figure in the diagram frame without importing Mermaid", () => {
  const html = renderToStaticMarkup(
    <MermaidDiagram raw={"flowchart LR\n  A --> B"} caption="Architecture" />,
  );
  expect(imported.mermaid).toBe(false);
  expect(html).toContain("DIAGRAM");
  expect(html).toContain("flowchart LR");
  expect(html).toContain("<figure");
  expect(html).not.toContain("data-mermaid-error");
});
