"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/src/components/ui/Panel";
import { hueVar } from "@/src/components/moduleHues";
import { HUE_TEXT } from "@/src/components/ui/hueClasses";
import type { HomeWorkspace } from "@/src/components/home/homeWorkspaces";

export function WorkspacePanel({
  locked,
  onClose,
  workspace,
}: {
  locked: boolean;
  onClose: () => void;
  workspace: HomeWorkspace;
}) {
  const Icon = workspace.icon;
  return (
    <Panel
      aside={
        <div className="flex items-center gap-3">
          <Link
            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 ${HUE_TEXT[workspace.hue]}`}
            href={workspace.href}
          >
            Open {workspace.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          {/* Only when locked (a click opened this panel): hovering doesn't
              need a close button since leaving IS closing it. */}
          {locked ? (
            <button
              aria-label="Close and resume orbiting"
              className="text-muted transition-colors hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      }
      title={
        <span className="flex items-center gap-2">
          <Icon
            aria-hidden="true"
            className="size-4"
            style={{ color: hueVar(workspace.hue) }}
          />
          {workspace.label}
        </span>
      }
    >
      <ul className="space-y-0.5">
        {workspace.modules.map((module, index) => {
          const ModuleIcon = module.icon;
          return (
            <li
              className="fade-up"
              key={module.href}
              style={{ ["--i" as string]: index }}
            >
              <Link
                className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-body transition-colors hover:bg-surface-subtle hover:text-foreground"
                href={module.href}
              >
                {ModuleIcon ? (
                  <ModuleIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                    style={{ color: hueVar(workspace.hue) }}
                  />
                ) : null}
                <span className="flex-1 truncate">{module.label}</span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
