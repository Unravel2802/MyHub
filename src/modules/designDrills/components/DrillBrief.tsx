"use client";

import { useId, useRef, useState } from "react";
import { BookOpenCheck, FileText } from "lucide-react";
import { Markdown } from "@/src/components/ui/Markdown";
import { SolutionEditorial } from "@/src/modules/designDrills/components/SolutionEditorial";
import type { DesignDrill } from "@/src/modules/designDrills/types";

type BriefTab = "prompt" | "solution";

const tabs: {
  id: BriefTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: "prompt", label: "Prompt", icon: FileText },
  { id: "solution", label: "Solution", icon: BookOpenCheck },
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
        className="flex items-end gap-1 border-b border-border bg-surface-subtle px-5 pt-2"
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              aria-controls={`${id}-${tab.id}-panel`}
              aria-selected={selected}
              className={`-mb-px flex items-center gap-1.5 rounded-t-md border-x border-t px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                selected
                  ? "border-border bg-surface text-accent-strong"
                  : "border-transparent text-muted hover:bg-surface/60 hover:text-body"
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
              <Icon aria-hidden className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${id}-${activeTab}-tab`}
        className="px-5 pb-5 pt-4 text-sm leading-relaxed text-body"
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
