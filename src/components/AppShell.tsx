"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/src/components/AuthGate";
import { CommandPalette } from "@/src/components/CommandPalette";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NAV_ITEMS } from "@/src/components/appNav";
import { hueFor, type HueName } from "@/src/components/moduleHues";
import { StreakIndicator } from "@/src/modules/momentum/components/StreakIndicator";
import { UnlockToaster } from "@/src/modules/momentum/components/UnlockToaster";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { signOut } from "@/src/lib/auth";

interface AppShellProps {
  title: string;
  activeHref: string;
  children: React.ReactNode;
}

export function AppShell({ title, activeHref, children }: AppShellProps) {
  const streak = useMomentumStore((state) => state.streak);
  const refresh = useMomentumStore((state) => state.refresh);
  const subscribeToUpdates = useMomentumStore(
    (state) => state.subscribeToUpdates,
  );
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void refresh();
    return subscribeToUpdates();
  }, [refresh, subscribeToUpdates]);

  // Mobile only. On a phone the rail used to eat the ENTIRE first screen — you
  // scrolled past eight nav links, a theme toggle and sign-out before reaching
  // any content. Collapsed by default below `lg`; at `lg` and up the rail is
  // always open and this state is ignored, so the desktop DOM is unchanged.
  const [isNavOpen, setIsNavOpen] = useState(false);
  const hueDotClasses: Record<HueName, string> = {
    accent: "bg-accent",
    amber: "bg-hue-amber",
    orange: "bg-hue-orange",
    rose: "bg-hue-rose",
    violet: "bg-hue-violet",
    blue: "bg-hue-blue",
    cyan: "bg-hue-cyan",
    teal: "bg-hue-teal",
    emerald: "bg-hue-emerald",
    fuchsia: "bg-hue-fuchsia",
  };

  const activeClasses: Record<HueName, string> = {
    accent: "bg-accent-surface font-medium text-accent-strong",
    amber: "bg-hue-amber-surface font-medium text-hue-amber",
    orange: "bg-hue-orange-surface font-medium text-hue-orange",
    rose: "bg-hue-rose-surface font-medium text-hue-rose",
    violet: "bg-hue-violet-surface font-medium text-hue-violet",
    blue: "bg-hue-blue-surface font-medium text-hue-blue",
    cyan: "bg-hue-cyan-surface font-medium text-hue-cyan",
    teal: "bg-hue-teal-surface font-medium text-hue-teal",
    emerald: "bg-hue-emerald-surface font-medium text-hue-emerald",
    fuchsia: "bg-hue-fuchsia-surface font-medium text-hue-fuchsia",
  };

  return (
    <AuthGate>
      <main className="min-h-screen bg-canvas text-foreground">
        <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-6 border-b border-border bg-surface px-6 py-5 lg:sticky lg:top-0 lg:h-screen lg:gap-8 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-6">
            <div className="flex items-center justify-between gap-3 lg:block">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">
                  MyHub
                </p>
                <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground lg:mt-2 lg:text-2xl">
                  {title}
                </h1>
              </div>
              <button
                aria-controls="app-nav"
                aria-expanded={isNavOpen}
                className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-medium text-body transition-all duration-200 ease-in-out hover:bg-surface-subtle lg:hidden"
                onClick={() => setIsNavOpen((open) => !open)}
                type="button"
              >
                {isNavOpen ? "Close" : "Menu"}
              </button>
            </div>

            {/* `hidden` only below lg, and only while closed — at lg the rail is
                always expanded, so nothing about the desktop DOM changes. */}
            <div
              className={`${isNavOpen ? "grid" : "hidden"} gap-6 lg:grid lg:flex-1 lg:grid-rows-[auto_1fr]`}
              id="app-nav"
            >
              <nav aria-label="MyHub modules" className="grid gap-1 text-sm">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.href === activeHref;
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 ease-in-out ${isActive ? activeClasses[hueFor(item.href)] : "text-body hover:bg-surface-subtle hover:text-foreground"}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setIsNavOpen(false)}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${hueDotClasses[hueFor(item.href)]}`}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="lg:mt-auto">
                <StreakIndicator streak={streak} />
                <div className="mt-4">
                  <ThemeToggle />
                  <button
                    className="mt-3 block rounded-md text-xs text-muted transition-colors duration-200 ease-in-out hover:text-foreground"
                    onClick={() => void signOut()}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {children}
        </div>
        <CommandPalette />
        <UnlockToaster />
      </main>
    </AuthGate>
  );
}
