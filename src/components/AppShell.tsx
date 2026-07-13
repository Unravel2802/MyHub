"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NAV_ITEMS } from "@/src/components/appNav";
import { StreakIndicator } from "@/src/modules/momentum/components/StreakIndicator";
import { UnlockToaster } from "@/src/modules/momentum/components/UnlockToaster";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";

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
  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-8 overflow-y-auto border-b border-border bg-surface px-6 py-6 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r">
          <div>
            <p className="text-sm font-semibold text-accent-strong">MyHub</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
              {title}
            </h1>
            <nav aria-label="MyHub modules" className="mt-6 grid gap-2 text-sm">
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "rounded-md bg-surface-subtle px-3 py-2 font-medium text-foreground"
                        : "rounded-md px-3 py-2 text-body hover:bg-surface-subtle"
                    }
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="lg:mt-auto">
            <StreakIndicator streak={streak} />
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {children}
      </div>
      <UnlockToaster />
    </main>
  );
}
