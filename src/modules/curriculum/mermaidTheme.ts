import type { MermaidConfig } from "mermaid";

// Called only in the diagram effect: Mermaid needs concrete colours, and the
// root inherits the curriculum track tokens and the current html theme.
export function mermaidTheme(root: HTMLElement): MermaidConfig {
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const surface = token("--surface");
  const foreground = token("--foreground");
  const border = token("--border");
  const muted = token("--muted");
  const track = token("--track");
  const trackSurface = token("--track-surface");
  const fontFamily = token("--font-geist-sans");
  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    flowchart: { htmlLabels: false, curve: "basis" },
    themeVariables: {
      fontFamily,
      background: surface,
      primaryColor: trackSurface,
      primaryTextColor: foreground,
      primaryBorderColor: track,
      secondaryColor: surface,
      secondaryTextColor: foreground,
      secondaryBorderColor: border,
      tertiaryColor: surface,
      tertiaryTextColor: foreground,
      tertiaryBorderColor: border,
      lineColor: muted,
      textColor: foreground,
      edgeLabelBackground: surface,
      mainBkg: trackSurface,
      nodeBorder: track,
      clusterBkg: surface,
      clusterBorder: border,
    },
  };
}
