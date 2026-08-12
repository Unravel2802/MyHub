import type { ReactNode } from "react";
import { hueVar } from "@/src/components/moduleHues";

// Inline feTurbulence data-URI grain — zero asset requests. Colorless noise,
// so unlike everything else on the hub this one genuinely has no hue to
// tokenize; it reads identically on both themes at the low opacity below.
const NOISE_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

// The Home hub's own backdrop — deliberately scoped to just this component's
// children (the orbital section + today's focus + app grid), not the whole
// app shell. Every other page keeps the plain `bg-canvas` AppShell already
// gives it; this is Home's one distinct "workspace hub" identity, the same
// way PageTemplate's `contentWidth="narrow"` already singles Home out.
//
// Built entirely from existing tokens (--canvas, --foreground, --accent, the
// Career hue) rather than the mockup's literal hex, so it re-shades in light
// mode instead of only working in dark.
export function HomeBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse at 75% 10%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 55%),
            radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 0),
            var(--canvas)
          `,
          backgroundSize: "100% 100%, 28px 28px, 100% 100%",
        }}
      />

      {/* Secondary ambient glow, lower-left — Career's own hue (violet), the
          same token the orbit's Career node already uses, rather than
          inventing a fourth un-tokenized color for the page background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 -z-10 size-[420px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${hueVar("violet")} 22%, transparent) 0%, transparent 70%)`,
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 mix-blend-overlay"
        style={{
          backgroundImage: NOISE_URI,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
          opacity: 0.035,
        }}
      />

      {/* Tighter than the p-4/p-6 this used to be. The scene's size is capped
          by viewport HEIGHT (OrbitalHub's max-w), so every pixel of padding
          here is a pixel the orbit doesn't get — and the glow still reads at
          12px. This inset is the only vertical slack on the page that belongs
          to Home alone; the page header and the gap below come from
          PageTemplate and are shared with every other route. */}
      <div className="relative p-2 sm:p-3">{children}</div>
    </div>
  );
}
