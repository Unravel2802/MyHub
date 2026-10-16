import { afterEach, expect, it, vi } from "vitest";
import { mermaidTheme } from "./mermaidTheme";

afterEach(() => vi.unstubAllGlobals());
it("resolves theme variables and preserves the required strict config", () => {
  const tokens: Record<string, string> = {
    "--surface": "surface-color",
    "--foreground": "foreground-color",
    "--border": "border-color",
    "--muted": "muted-color",
    "--track": "track-color",
    "--track-surface": "track-surface-color",
    "--font-geist-sans": "Geist, sans-serif",
  };
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (key: string) => ` ${tokens[key]} `,
  }));
  const config = mermaidTheme({} as HTMLElement);
  expect(config).toMatchObject({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: "basis" },
  });
  expect(config.themeVariables).toMatchObject({
    background: tokens["--surface"],
    primaryTextColor: tokens["--foreground"],
    primaryBorderColor: tokens["--track"],
    primaryColor: tokens["--track-surface"],
    secondaryBorderColor: tokens["--border"],
    lineColor: tokens["--muted"],
    fontFamily: tokens["--font-geist-sans"],
  });
  expect(JSON.stringify(config.themeVariables)).not.toContain("var(");
});
