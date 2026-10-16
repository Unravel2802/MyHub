"use client";

import { useEffect, useId, useRef, useState } from "react";
import { mermaidTheme } from "../mermaidTheme";
import { Figure } from "./Figure";
import { VisualBlockFrame } from "./VisualBlockFrame";

// Mermaid has global configuration. Keep each initialize/render pair together
// so diagrams and rapid theme flips cannot borrow one another's theme.
let renderQueue: Promise<void> = Promise.resolve();

interface DiagramResult {
  source: string;
  svg: string | null;
  width: number;
  error: boolean;
}

export function MermaidDiagram({
  raw,
  caption,
}: {
  raw: string;
  caption: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const [result, setResult] = useState<DiagramResult | null>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let disposed = false;
    let revision = 0;
    let dark = document.documentElement.classList.contains("dark");

    async function draw() {
      const version = ++revision;
      try {
        // C1: client effects only. A module-scope import would repeat the PDF.js
        // SSR trap and load Mermaid on every chapter, including plain prose.
        const { default: mermaid } = await import("mermaid");
        if (disposed || version !== revision) return;
        const task = renderQueue.then(async () => {
          if (disposed || version !== revision || !element) return null;
          mermaid.initialize(mermaidTheme(element));
          const host = document.createElement("div");
          host.style.position = "absolute";
          host.style.visibility = "hidden";
          host.style.pointerEvents = "none";
          element.append(host);
          try {
            // Own Mermaid's temporary measurement DOM, including its error SVG.
            const { svg } = await mermaid.render(
              `mermaid-${id}-${version}`,
              raw,
              host,
            );
            return svg;
          } finally {
            host.remove();
          }
        });
        renderQueue = task.then(
          () => undefined,
          () => undefined,
        );
        const svg = await task;
        if (disposed || version !== revision || svg === null) return;
        const document = new DOMParser().parseFromString(svg, "image/svg+xml");
        const width =
          Number(
            document.documentElement.getAttribute("viewBox")?.split(/\s+/)[2],
          ) || 0;
        setResult({ source: raw, svg, width, error: false });
      } catch (error) {
        if (disposed || version !== revision) return;
        console.error("Curriculum diagram failed", error);
        setResult({ source: raw, svg: null, width: 0, error: true });
      }
    }

    const observer = new MutationObserver(() => {
      const nextDark = document.documentElement.classList.contains("dark");
      if (nextDark === dark) return;
      dark = nextDark;
      void draw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    void draw();
    return () => {
      disposed = true;
      revision += 1;
      observer.disconnect();
    };
  }, [raw, id]);

  const current = result?.source === raw ? result : null;
  return (
    <div
      ref={root}
      data-mermaid-diagram
      data-mermaid-error={current?.error ? "" : undefined}
      className="min-w-0"
    >
      <VisualBlockFrame label="DIAGRAM" title={caption} raw={raw}>
        {current?.svg ? (
          <div className="overflow-x-auto p-4">
            {/* C3 is the sole raw-SVG exception: repository chapter source only,
            Mermaid securityLevel=strict sanitizes it; htmlLabels=false. */}
            <div
              data-mermaid-svg
              style={{ width: current.width || undefined }}
              className="mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:!max-w-none"
              dangerouslySetInnerHTML={{ __html: current.svg }}
            />
          </div>
        ) : (
          <div className="px-4">
            {current?.error && (
              <p className="mt-4 text-sm text-danger">Diagram error</p>
            )}
            <Figure raw={raw} caption={caption} />
          </div>
        )}
      </VisualBlockFrame>
    </div>
  );
}
