"use client";

import {
  Home,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AuthGate } from "@/src/components/AuthGate";
import { CommandPalette } from "@/src/components/CommandPalette";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { NAV_ITEMS } from "@/src/components/appNav";
import {
  CORE_TOOL_HREFS,
  MINI_APPS,
  MINI_APP_HREFS,
} from "@/src/components/miniApps";
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

const CORE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  CORE_TOOL_HREFS.includes(item.href),
);

// Deliberately NOT in NAV_ITEMS: it's neither a core tool nor a mini-app
// member, and miniApps.test.ts's classification gate would fail on it either
// way (nowhere to put it that isn't wrong — a "core tool" reading makes the
// hub render itself as one of its own cards, since app/page.tsx filters
// NAV_ITEMS by CORE_TOOL_HREFS too). The hub already had a way back — the
// small "MyHub" wordmark above this nav — but that's branding chrome, not a
// nav destination: it never highlights as "current page" and isn't styled
// like anything else you can navigate to. This makes the hub a first-class,
// consistently-styled destination instead of something you have to notice is
// clickable.
const HOME_NAV_ITEM: (typeof NAV_ITEMS)[number] = {
  href: "/",
  label: "Home",
  icon: Home,
};

const MINI_APP_NAV_GROUPS = MINI_APPS.map((app) => ({
  app,
  items: NAV_ITEMS.filter((item) =>
    MINI_APP_HREFS[app.key].includes(item.href),
  ),
}));

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

  function renderNavItem(item: (typeof NAV_ITEMS)[number]) {
    const isActive = item.href === activeHref;
    const Icon = item.icon;
    return (
      <Link
        aria-current={isActive ? "page" : undefined}
        className={`flex h-8 items-center gap-2 rounded-md px-xs text-sm transition-all duration-200 ease-in-out ${isActive ? HUE_NAV_ACTIVE[hueFor(item.href)] : "text-body hover:bg-surface-subtle hover:text-foreground"}`}
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
  }

  return (
    <AuthGate>
      <main className="min-h-screen bg-canvas text-foreground">
        <div
          className={`grid min-h-screen ${collapsed ? "lg:grid-cols-[3.5rem_minmax(0,1fr)]" : "lg:grid-cols-[208px_minmax(0,1fr)]"}`}
        >
          <aside
            className={`flex flex-col gap-sm border-b border-border bg-surface px-sm py-sm lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-hidden lg:border-b-0 lg:border-r lg:px-xs ${collapsed ? "lg:hidden" : ""}`}
          >
            <button
              aria-controls="app-nav"
              aria-expanded={isNavOpen}
              className="-ml-1.5 flex size-8 items-center justify-center rounded-md text-body transition-colors duration-200 ease-in-out hover:bg-surface-subtle hover:text-foreground lg:hidden"
              onClick={() => setIsNavOpen((open) => !open)}
              type="button"
            >
              {isNavOpen ? (
                <PanelLeftClose aria-hidden="true" className="size-5" />
              ) : (
                <PanelLeft aria-hidden="true" className="size-5" />
              )}
              <span className="sr-only">
                {isNavOpen ? "Close menu" : "Open menu"}
              </span>
            </button>

            <div className="min-w-0 px-xs">
              <Link
                aria-label="MyHub home"
                className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:text-foreground"
                href="/"
              >
                MyHub
              </Link>
              <h1 className="truncate text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {title}
              </h1>
            </div>

            {/* Desktop-only collapse. Below lg the icon button above owns the
                rail, so this is hidden there. */}
            <button
              aria-label="Collapse sidebar"
              className="hidden size-8 shrink-0 items-center justify-center self-start rounded-md text-body transition-all duration-200 ease-in-out hover:bg-surface-subtle hover:text-foreground lg:inline-flex"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar (⌘/Ctrl+B)"
              type="button"
            >
              <PanelLeftClose aria-hidden className="size-4" />
            </button>

            {/* `hidden` only below lg, and only while closed — at lg the rail is
                always expanded, so nothing about the desktop DOM changes. */}
            <div
              className={`${isNavOpen ? "grid" : "hidden"} gap-sm lg:grid lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)_auto]`}
              id="app-nav"
            >
              <nav
                aria-label="MyHub modules"
                className="grid gap-xs text-sm lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
              >
                <div className="grid gap-1">{renderNavItem(HOME_NAV_ITEM)}</div>

                <div className="grid gap-1">
                  {CORE_NAV_ITEMS.map(renderNavItem)}
                </div>

                {MINI_APP_NAV_GROUPS.map(({ app, items }) => {
                  const headingId = `mini-app-${app.key}-heading`;
                  const GroupIcon = app.icon;
                  return (
                    <div
                      aria-labelledby={headingId}
                      className="grid gap-1"
                      key={app.key}
                      role="group"
                    >
                      <div
                        className="hue-gradient-text flex items-center gap-2 px-xs pb-1 pt-xs text-[11px] font-medium uppercase tracking-[0.08em]"
                        data-mini-app-heading
                        id={headingId}
                        style={{ ["--hue" as string]: hueVar(app.hue) }}
                      >
                        <GroupIcon
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                        />
                        <span>{app.label}</span>
                      </div>
                      {items.map(renderNavItem)}
                    </div>
                  );
                })}
              </nav>

              <div className="lg:mt-auto">
                <div className="rounded-md border border-border bg-surface-subtle p-xs">
                  <StreakIndicator streak={streak} />
                </div>
                <div className="mt-xs">
                  <ThemeToggle />
                  <button
                    className="mt-xs flex h-8 w-full items-center gap-2 rounded-md px-xs text-left text-xs text-muted transition-colors duration-200 ease-in-out hover:bg-surface-subtle hover:text-foreground"
                    onClick={() => void signOut()}
                    type="button"
                  >
                    <LogOut aria-hidden="true" className="size-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Collapsed rail: a slim strip that keeps the reopen toggle pinned
              at the top-left where the collapse button lives, instead of floating
              it over the page (which overlapped the page header) or dropping it to
              the vertical middle. Desktop-only — mobile never collapses this way. */}
          {collapsed ? (
            <div className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:items-center lg:border-r lg:border-border lg:bg-surface lg:pt-6">
              <button
                aria-label="Open sidebar"
                className="flex size-8 items-center justify-center rounded-md text-body transition-all duration-200 ease-in-out hover:bg-surface-subtle hover:text-foreground"
                onClick={() => setSidebarCollapsed(false)}
                title="Open sidebar (⌘/Ctrl+B)"
                type="button"
              >
                <PanelLeftOpen aria-hidden className="size-4" />
              </button>
            </div>
          ) : null}

          {children}
        </div>
        <CommandPalette />
        <UnlockToaster />
      </main>
    </AuthGate>
  );
}
