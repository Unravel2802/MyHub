"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AuthGate } from "@/src/components/AuthGate";
import { CommandPalette } from "@/src/components/CommandPalette";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NAV_ITEMS } from "@/src/components/appNav";
import { hueFor, hueVar } from "@/src/components/moduleHues";
import { HUE_NAV_ACTIVE } from "@/src/components/ui/hueClasses";
import { StreakIndicator } from "@/src/modules/momentum/components/StreakIndicator";
import { UnlockToaster } from "@/src/modules/momentum/components/UnlockToaster";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { useCommandPaletteStore } from "@/src/modules/commandPalette/useCommandPaletteStore";
import { signOut } from "@/src/lib/auth";
import {
  getServerSidebarCollapsed,
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebar,
  toggleSidebar,
} from "@/src/lib/sidebar";
import { getCommand, register, unregister } from "@/src/lib/commandPalette";
import {
  matchShortcut,
  registerShortcuts,
  unregisterShortcuts,
} from "@/src/lib/shortcuts";

interface AppShellProps {
  title: string;
  activeHref: string;
  children: React.ReactNode;
}

export function AppShell({ title, activeHref, children }: AppShellProps) {
  const openPalette = useCommandPaletteStore((state) => state.open);
  const togglePalette = useCommandPaletteStore((state) => state.toggle);
  const setPaletteQuery = useCommandPaletteStore((state) => state.setQuery);
  const pushRecent = useCommandPaletteStore((state) => state.pushRecent);
  const streak = useMomentumStore((state) => state.streak);
  const refresh = useMomentumStore((state) => state.refresh);
  const subscribeToUpdates = useMomentumStore(
    (state) => state.subscribeToUpdates,
  );
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarCollapsed,
    getServerSidebarCollapsed,
  );
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void refresh();
    return subscribeToUpdates();
  }, [refresh, subscribeToUpdates]);

  const shortcutBuffer = useRef("");
  const shortcutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    register("app-shell", [
      {
        id: "open-palette",
        label: "Open command palette",
        keywords: ["commands", "search", "navigate"],
        action: togglePalette,
      },
      {
        id: "quick-add",
        label: "Quick add",
        keywords: ["new", "create", "add"],
        action: () => {
          setPaletteQuery("New");
          openPalette();
        },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        keywords: ["sidebar", "nav", "collapse", "expand", "rail"],
        action: toggleSidebar,
      },
    ]);
    registerShortcuts("app-shell", [
      {
        combo: "mod+k",
        commandId: "app-shell.open-palette",
        description: "Open the command palette",
      },
      {
        combo: "/",
        commandId: "app-shell.quick-add",
        description: "Open quick add",
      },
      {
        combo: "mod+b",
        commandId: "app-shell.toggle-sidebar",
        description: "Toggle the sidebar",
      },
    ]);

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const isSingleKey = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (isTyping && isSingleKey) return;

      const match = matchShortcut(event, shortcutBuffer.current);
      shortcutBuffer.current = match.buffer;
      if (shortcutTimer.current) clearTimeout(shortcutTimer.current);
      shortcutTimer.current = match.buffer
        ? setTimeout(() => {
            shortcutBuffer.current = "";
          }, 800)
        : null;

      if (!match.commandId) return;
      const command = getCommand(match.commandId);
      if (!command) return;
      event.preventDefault();
      pushRecent(command.id);
      command.action();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (shortcutTimer.current) clearTimeout(shortcutTimer.current);
      unregisterShortcuts("app-shell");
      unregister("app-shell");
    };
  }, [openPalette, pushRecent, setPaletteQuery, togglePalette]);

  // Mobile only. On a phone the rail used to eat the ENTIRE first screen — you
  // scrolled past eight nav links, a theme toggle and sign-out before reaching
  // any content. Collapsed by default below `lg`; at `lg` and up the rail is
  // always open and this state is ignored, so the desktop DOM is unchanged.
  const [isNavOpen, setIsNavOpen] = useState(false);
  return (
    <AuthGate>
      <main className="min-h-screen bg-canvas text-foreground">
        <div
          className={`grid min-h-screen ${collapsed ? "lg:grid-cols-1" : "lg:grid-cols-[260px_1fr]"}`}
        >
          <aside
            className={`flex flex-col gap-6 border-b border-border bg-surface px-6 py-5 lg:sticky lg:top-0 lg:h-screen lg:gap-8 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-6 ${collapsed ? "lg:hidden" : ""}`}
          >
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
              {/* Desktop-only collapse. Below lg the Menu button above owns the
                  rail, so this is hidden there. */}
              <button
                aria-label="Collapse sidebar"
                className="hidden shrink-0 rounded-md border border-border p-2 text-body transition-all duration-200 ease-in-out hover:bg-surface-subtle lg:inline-flex"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar (⌘/Ctrl+B)"
                type="button"
              >
                <PanelLeftClose aria-hidden className="size-4" />
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
                  const Icon = item.icon;
                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 transition-all duration-200 ease-in-out ${isActive ? HUE_NAV_ACTIVE[hueFor(item.href)] : "text-body hover:bg-surface-subtle hover:text-foreground"}`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setIsNavOpen(false)}
                    >
                      {Icon ? (
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                          style={{ color: hueVar(hueFor(item.href)) }}
                        />
                      ) : null}
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

          {/* Reopen affordance while the rail is collapsed. Desktop-only: on
              mobile the rail is never collapsed via this path. */}
          {collapsed ? (
            <button
              aria-label="Open sidebar"
              className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-surface p-2 text-body shadow-sm transition-all duration-200 ease-in-out hover:bg-surface-subtle lg:inline-flex"
              onClick={() => setSidebarCollapsed(false)}
              title="Open sidebar (⌘/Ctrl+B)"
              type="button"
            >
              <PanelLeftOpen aria-hidden className="size-4" />
            </button>
          ) : null}

          {children}
        </div>
        <CommandPalette />
        <UnlockToaster />
      </main>
    </AuthGate>
  );
}
