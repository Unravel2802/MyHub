"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";
import { Markdown } from "@/src/components/ui/Markdown";
import type { DrillSolutionCodeExample } from "@/src/modules/designDrills/types";

interface SolutionCodeTabsProps {
  examples: DrillSolutionCodeExample[];
}

export function SolutionCodeTabs({ examples }: SolutionCodeTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeExample = examples[activeIndex];
  const fencedCode = `\`\`\`${activeExample.language}\n${activeExample.code}\n\`\`\``;

  function selectTab(index: number) {
    setActiveIndex(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % examples.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + examples.length) % examples.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = examples.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <div className="mt-4">
      <div
        aria-label="Solution code examples"
        className="flex items-end gap-1 border-b border-border bg-surface-subtle px-3 pt-2"
        role="tablist"
      >
        {examples.map((example, index) => {
          const selected = activeIndex === index;
          return (
            <button
              aria-controls={`${id}-${example.language}-panel`}
              aria-selected={selected}
              className={`-mb-px rounded-t-md border-x border-t px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                selected
                  ? "border-border bg-surface text-accent-strong"
                  : "border-transparent text-muted hover:bg-surface/60 hover:text-body"
              }`}
              id={`${id}-${example.language}-tab`}
              key={example.language}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {example.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${id}-${activeExample.language}-tab`}
        id={`${id}-${activeExample.language}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        <Markdown>{fencedCode}</Markdown>
      </div>
    </div>
  );
}
