"use client";

import { useId, useRef, useState } from "react";
import { Markdown } from "@/src/components/ui/Markdown";
import { SolutionEditorial } from "@/src/modules/designDrills/components/SolutionEditorial";
import type { DesignDrill } from "@/src/modules/designDrills/types";

type BriefTab = "prompt" | "solution";

const tabs: { id: BriefTab; label: string }[] = [
  { id: "prompt", label: "Prompt" },
  { id: "solution", label: "Solution" },
];

interface DrillBriefProps {
  drill: Pick<
    DesignDrill,
    "category" | "prompt" | "solution" | "solutionDetail"
  >;
}

export function DrillBrief({ drill }: DrillBriefProps) {
  const [activeTab, setActiveTab] = useState<BriefTab>("prompt");
  const id = useId();
  const tabRefs = useRef<Partial<Record<BriefTab, HTMLButtonElement>>>({});

  function selectTab(tab: BriefTab) {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: BriefTab,
  ) {
    const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(tabs[nextIndex].id);
  }

  return (
    <div>
      <div
        aria-label="Drill brief"
        className="flex gap-1 border-b border-border"
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              aria-controls={`${id}-${tab.id}-panel`}
              aria-selected={selected}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                selected
                  ? "border-accent text-accent-strong"
                  : "border-transparent text-muted hover:border-input-hover hover:text-body"
              }`}
              id={`${id}-${tab.id}-tab`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
              ref={(node) => {
                tabRefs.current[tab.id] = node ?? undefined;
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${id}-${activeTab}-tab`}
        className="mt-4 text-sm leading-relaxed text-body"
        id={`${id}-${activeTab}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "prompt" ? (
          <Markdown>{drill.prompt}</Markdown>
        ) : drill.solutionDetail ? (
          <SolutionEditorial
            category={drill.category}
            solution={drill.solutionDetail}
          />
        ) : (
          <div className="whitespace-pre-wrap">
            {drill.solution || "Solution not written yet."}
          </div>
        )}
      </div>
    </div>
  );
}
