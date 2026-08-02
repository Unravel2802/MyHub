"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Panel } from "@/src/components/ui/Panel";
import { hueSurfaceVar, hueVar } from "@/src/components/moduleHues";
import { HUE_TEXT } from "@/src/components/ui/hueClasses";
import {
  HOME_WORKSPACES,
  type HomeWorkspace,
} from "@/src/components/home/homeWorkspaces";

// Logical canvas. Everything below is expressed in these units and rendered
// into an SVG viewBox / percentage offsets, so the whole scene scales with its
// container instead of needing a breakpoint per size.
//
// The orbit is a heavily flattened ellipse (RX ~2.7x RY) — that ratio IS the
// perspective. A circle would read as a flat wheel seen head-on; this reads as
// a ring receding into the screen.
const CANVAS_W = 560;
const CANVAS_H = 370;
const ORBIT_RX = 215;
const ORBIT_RY = 76;
const CENTER_R = 52;
const NODE_R = 36;

// Sphere sizes as a PERCENTAGE of the container width, not fixed pixels: the
// canvas is fluid (percentage offsets into an aspect-ratio box), so px spheres
// would grow relatively larger as the container shrank and the scene would
// stop being the same picture at different widths.
const CENTER_PCT = ((CENTER_R * 2) / CANVAS_W) * 100;
const NODE_PCT = ((NODE_R * 2) / CANVAS_W) * 100;

// Radians per millisecond. One lap takes ~18s — fast enough that the motion
// is legible at a glance instead of needing to stare at the scene to confirm
// anything is moving at all, but still well short of competing with the
// content beside it for attention.
const SPEED = 0.00035;

// depth runs 0 (far side, top of the ellipse) to 1 (near side, bottom).
// It drives three things at once, which together are the 3D illusion:
// opacity, scale, and stacking order against the center hub.
function depthOf(angle: number) {
  return (Math.sin(angle) + 1) / 2;
}

// Static star field. Fixed coordinates rather than random so the scene is
// identical between server and client render — a Math.random() field here
// would be a hydration mismatch.
const STARS = [
  { x: 48, y: 24, r: 0.8, o: 0.34 },
  { x: 497, y: 67, r: 1, o: 0.42 },
  { x: 112, y: 292, r: 0.7, o: 0.28 },
  { x: 453, y: 308, r: 0.9, o: 0.36 },
  { x: 26, y: 198, r: 0.6, o: 0.3 },
  { x: 527, y: 148, r: 0.8, o: 0.34 },
  { x: 74, y: 347, r: 1, o: 0.28 },
  { x: 386, y: 36, r: 0.7, o: 0.4 },
  { x: 202, y: 17, r: 0.6, o: 0.26 },
  { x: 37, y: 114, r: 0.9, o: 0.3 },
  { x: 532, y: 252, r: 0.7, o: 0.34 },
  { x: 158, y: 58, r: 0.8, o: 0.28 },
  { x: 477, y: 188, r: 0.6, o: 0.26 },
  { x: 310, y: 355, r: 0.9, o: 0.3 },
];

// A sphere, not a disc: a specular highlight up-left, the hue bouncing back
// from down-right, and a body gradient between two shades of the module's own
// hue. Built from `--hue` + color-mix so it re-shades itself in light mode
// instead of naming a raw color (see moduleHues.ts).
//
// The dark end blends toward `--canvas` rather than toward black: in dark mode
// that IS near-black, but in light mode it resolves pale, so the same one
// declaration gives a shaded ball on both themes instead of a black blob on
// white.
const SPHERE_BACKGROUND = `
  radial-gradient(circle at 30% 26%, color-mix(in srgb, white 30%, transparent) 0%, transparent 52%),
  radial-gradient(circle at 68% 72%, color-mix(in srgb, var(--hue) 22%, transparent) 0%, transparent 48%),
  linear-gradient(140deg, color-mix(in srgb, var(--hue) 32%, var(--hue-surface)) 0%, color-mix(in srgb, var(--hue-surface) 80%, var(--canvas)) 100%)
`;

// The hub is the light source of the scene, so its body is a RADIAL gradient
// (lit from the middle out) where the planets' is linear.
const HUB_BACKGROUND = `
  radial-gradient(circle at 32% 28%, color-mix(in srgb, white 46%, transparent) 0%, transparent 48%),
  radial-gradient(circle at 68% 72%, color-mix(in srgb, var(--accent) 62%, var(--canvas)) 0%, transparent 55%),
  radial-gradient(circle at 50% 50%, var(--accent) 0%, color-mix(in srgb, var(--accent) 48%, var(--canvas)) 100%)
`;

function WorkspacePanel({ workspace }: { workspace: HomeWorkspace }) {
  const Icon = workspace.icon;
  return (
    <Panel
      aside={
        <Link
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 ${HUE_TEXT[workspace.hue]}`}
          href={workspace.href}
        >
          Open {workspace.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
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

function OrbitalCanvas({
  activeKey,
  onActivate,
}: {
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}) {
  const nodeRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const spokeRefs = useRef<Record<string, SVGLineElement | null>>({});
  const anglesRef = useRef<Record<string, number>>(
    Object.fromEntries(
      HOME_WORKSPACES.map((ws, index) => [
        ws.key,
        -Math.PI / 2 + (index * 2 * Math.PI) / HOME_WORKSPACES.length,
      ]),
    ),
  );
  // Read inside the animation frame rather than as a dependency, so hovering
  // doesn't tear down and restart the loop (which would jump every planet).
  const activeRef = useRef<string | null>(activeKey);
  useEffect(() => {
    activeRef.current = activeKey;
  }, [activeKey]);

  // The WHOLE scene halts when the pointer is anywhere over the canvas, not
  // just when it's on a planet. Pausing only the hovered planet sounds tidier
  // but doesn't work: a 54px target moving ~17px/s slides out from under the
  // cursor in the gap between aiming and arriving, so you chase it. Settling
  // everything on approach means you aim at a stationary scene and pick.
  const canvasHoveredRef = useRef(false);

  // 1 = full speed, 0 = stopped. Eased toward its target every frame rather
  // than snapped, so approaching the scene glides it to a halt instead of
  // stopping it dead mid-arc.
  const speedRef = useRef(1);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    let last = performance.now();

    const paint = (now: number) => {
      const elapsed = Math.min(now - last, 50);
      last = now;

      // Time-corrected exponential smoothing (not a fixed per-frame lerp, which
      // would ease at different rates on 60Hz and 120Hz displays). ~180ms to
      // settle.
      const targetSpeed = canvasHoveredRef.current ? 0 : 1;
      speedRef.current +=
        (targetSpeed - speedRef.current) * (1 - Math.exp(-elapsed / 180));

      for (const workspace of HOME_WORKSPACES) {
        if (!reduced)
          anglesRef.current[workspace.key] +=
            SPEED * elapsed * speedRef.current;

        const angle = anglesRef.current[workspace.key];
        const x = ORBIT_RX * Math.cos(angle);
        const y = ORBIT_RY * Math.sin(angle);
        const depth = depthOf(angle);
        const isActive = activeRef.current === workspace.key;

        const node = nodeRefs.current[workspace.key];
        if (node) {
          node.style.left = `${((CANVAS_W / 2 + x) / CANVAS_W) * 100}%`;
          node.style.top = `${((CANVAS_H / 2 + y) / CANVAS_H) * 100}%`;
          // The active planet is always fully lit, even on the far arc —
          // otherwise the one you're reading about is the dimmest thing here.
          node.style.opacity = String(isActive ? 1 : 0.45 + 0.55 * depth);
          // Near planets scale up AND stack above the hub; far ones shrink and
          // pass behind it. The hub sits at z-index 10 (below).
          node.style.setProperty("--depth-scale", String(0.82 + 0.26 * depth));
          node.style.zIndex = String(isActive ? 30 : Math.round(depth * 20));
        }

        // A sphere half-occluded by the hub reads as depth; a name tag sliced
        // down the middle just reads as broken. Labels fade out over the far
        // third of the arc so they're gone before they can be clipped.
        const label = labelRefs.current[workspace.key];
        if (label) {
          const legibility = Math.max(0, Math.min(1, (depth - 0.28) / 0.34));
          label.style.opacity = String(isActive ? 1 : legibility);
        }

        const spoke = spokeRefs.current[workspace.key];
        if (spoke) {
          spoke.setAttribute("x2", String(x));
          spoke.setAttribute("y2", String(y));
          spoke.style.opacity = String(isActive ? 0.55 : 0.08 + 0.32 * depth);
        }
      }

      // Reduced motion still needs ONE pass to place everything; it just never
      // needs a second.
      if (reduced) return;
      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="relative w-full max-w-[560px] shrink-0"
      onMouseEnter={() => {
        canvasHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        canvasHoveredRef.current = false;
        onActivate(null);
      }}
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          {/* Without this the orbit renders as a hard 3px band — the single
              biggest reason a ring reads as "a drawn ellipse" rather than a
              glowing path. Blur a wide soft stroke, then composite the crisp
              source back on top. */}
          <filter height="300%" id="ring-glow" width="140%" x="-20%" y="-100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          <radialGradient cx="50%" cy="50%" id="hub-ambient" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          {HOME_WORKSPACES.map((workspace) => (
            <linearGradient
              gradientUnits="userSpaceOnUse"
              id={`spoke-${workspace.key}`}
              key={workspace.key}
              x1="0"
              x2={ORBIT_RX}
              y1="0"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor={hueVar(workspace.hue)}
                stopOpacity="0.7"
              />
              <stop
                offset="100%"
                stopColor={hueVar(workspace.hue)}
                stopOpacity="0"
              />
            </linearGradient>
          ))}
        </defs>

        <g transform={`translate(${CANVAS_W / 2},${CANVAS_H / 2})`}>
          {STARS.map((star) => (
            <circle
              cx={star.x - CANVAS_W / 2}
              cy={star.y - CANVAS_H / 2}
              fill="var(--foreground)"
              key={`${star.x}-${star.y}`}
              opacity={star.o}
              r={star.r}
            />
          ))}

          <ellipse fill="url(#hub-ambient)" rx="130" ry="92" />

          {/* Inner guide ring — a depth cue only. It has to sit at the very
              edge of visible (0.1 alpha): drawn any stronger it stops reading
              as a floor plane behind the orbit and starts reading as a second
              orbit, which is what makes the scene look like two rings rather
              than one ring in perspective. */}
          <ellipse
            fill="none"
            opacity="0.1"
            rx={ORBIT_RX * 0.68}
            ry={ORBIT_RY * 0.68}
            stroke="var(--accent)"
            strokeWidth="1"
          />

          {/* The orbit: a blurred wide stroke for the glow, then a hairline
              dotted one at full opacity so the path itself stays crisp. The
              dashes are what make it read as a track rather than a hoop. */}
          <ellipse
            filter="url(#ring-glow)"
            fill="none"
            opacity="0.3"
            rx={ORBIT_RX}
            ry={ORBIT_RY}
            stroke="var(--accent)"
            strokeWidth="4"
          />
          <ellipse
            fill="none"
            opacity="0.55"
            rx={ORBIT_RX}
            ry={ORBIT_RY}
            stroke="var(--accent)"
            strokeDasharray="1.5 13"
            strokeWidth="0.75"
          />

          {HOME_WORKSPACES.map((workspace) => (
            <line
              key={workspace.key}
              ref={(el) => {
                spokeRefs.current[workspace.key] = el;
              }}
              stroke={`url(#spoke-${workspace.key})`}
              strokeDasharray="2 7"
              strokeWidth="1"
              x1="0"
              x2={ORBIT_RX}
              y1="0"
              y2="0"
            />
          ))}
        </g>
      </svg>

      {/* Center hub. z-10 so near planets (up to z-20) cross in front of it and
          far ones pass behind — the moment that sells the orbit as 3D. */}
      <div
        aria-hidden="true"
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: "50%", width: `${CENTER_PCT}%` }}
      >
        <span className="orbit-hub-pulse absolute inset-0 rounded-full border border-accent" />
        <span className="orbit-hub-pulse orbit-hub-pulse-delayed absolute inset-0 rounded-full border border-accent" />
        <div
          className="orbit-hub-breathe relative flex aspect-square w-full items-center justify-center rounded-full"
          style={{
            background: HUB_BACKGROUND,
            border:
              "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            // Two outer blooms, near and far (32px + 72px). One glow reads as a
            // sticker with a halo; two reads as a light source.
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, white 25%, transparent), inset 0 -2px 4px color-mix(in srgb, black 40%, transparent), 0 0 0 8px color-mix(in srgb, var(--accent) 8%, transparent), 0 0 32px color-mix(in srgb, var(--accent) 55%, transparent), 0 0 72px color-mix(in srgb, var(--accent) 20%, transparent)",
          }}
        >
          <span
            className="absolute rounded-full blur-[3px]"
            style={{
              background: "color-mix(in srgb, white 42%, transparent)",
              height: "20%",
              left: "19%",
              top: "13%",
              width: "32%",
            }}
          />
          <span className="relative text-lg font-bold text-accent-strong">
            M
          </span>
        </div>
      </div>

      {HOME_WORKSPACES.map((workspace) => {
        const Icon = workspace.icon;
        return (
          <Link
            // NOT a flex column containing the label: the node is translated by
            // -50%/-50% onto its point on the ellipse, so whatever this box
            // contains is what gets centred there. With the label inside, the
            // box is sphere+label tall and the SPHERE ends up sitting above the
            // orbit path. The label is positioned out of flow below instead, so
            // this box is exactly the sphere.
            className="orbit-node absolute block"
            href={workspace.href}
            key={workspace.key}
            onBlur={() => {
              canvasHoveredRef.current = false;
              onActivate(null);
            }}
            // Keyboard focus settles the scene for the same reason hover does:
            // a tabbed-to planet that keeps drifting is disorienting.
            onFocus={() => {
              canvasHoveredRef.current = true;
              onActivate(workspace.key);
            }}
            onMouseEnter={() => onActivate(workspace.key)}
            onMouseLeave={() => onActivate(null)}
            ref={(el) => {
              nodeRefs.current[workspace.key] = el;
            }}
            style={{
              ["--hue" as string]: hueVar(workspace.hue),
              ["--hue-surface" as string]: hueSurfaceVar(workspace.hue),
              width: `${NODE_PCT}%`,
            }}
          >
            <span
              className="relative flex aspect-square w-full items-center justify-center rounded-full"
              style={{
                background: SPHERE_BACKGROUND,
                // 30%, not 45%: a crisp rim turns the sphere back into a
                // flat disc with an outline.
                border:
                  "1px solid color-mix(in srgb, var(--hue) 30%, transparent)",
                boxShadow:
                  "inset 0 1px 0 color-mix(in srgb, white 14%, transparent), inset 0 -2px 4px color-mix(in srgb, black 30%, transparent), 0 0 0 6px color-mix(in srgb, var(--hue) 9%, transparent), 0 0 20px color-mix(in srgb, var(--hue) 28%, transparent), 0 0 44px color-mix(in srgb, var(--hue) 12%, transparent)",
              }}
            >
              <span
                aria-hidden="true"
                className="absolute rounded-full blur-[2px]"
                style={{
                  background: "color-mix(in srgb, white 32%, transparent)",
                  height: "18%",
                  left: "18%",
                  top: "13%",
                  width: "30%",
                }}
              />
              <Icon
                aria-hidden="true"
                className="relative size-[38%]"
                style={{ color: "var(--hue)" }}
              />
            </span>
            {/* A translucent tint rather than HUE_BADGE's opaque surface: over
                a dark starfield the solid pill reads as a sticker sitting on
                top of the scene instead of a tag belonging to the planet. */}
            <span
              className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase"
              ref={(el) => {
                labelRefs.current[workspace.key] = el;
              }}
              style={{
                background: "color-mix(in srgb, var(--hue) 9%, transparent)",
                border:
                  "0.5px solid color-mix(in srgb, var(--hue) 34%, transparent)",
                color: "var(--hue)",
                letterSpacing: "0.07em",
              }}
            >
              {workspace.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

interface OrbitalHubProps {
  // Rendered in the info panel when no workspace is hovered/focused — the
  // Momentum panel on the real hub, but kept as an injected slot so this
  // component doesn't need to know about the momentum/dashboard stores.
  idlePanel: ReactNode;
}

export function OrbitalHub({ idlePanel }: OrbitalHubProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = HOME_WORKSPACES.find((ws) => ws.key === activeKey) ?? null;

  return (
    // items-start, not items-center: the panel beside the canvas changes height
    // when you hover a workspace (Career lists nine modules, the idle panel is
    // shorter). Centering re-flows that difference into the canvas's position,
    // which slides the planet out from under the cursor mid-hover.
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start">
      <OrbitalCanvas activeKey={activeKey} onActivate={setActiveKey} />

      {/* `key` restarts the entrance animation on every swap, so the panel
          crossfades between workspaces instead of its text silently changing.

          Deliberately NO min-height: reserving the tallest panel's height stops
          the page reflowing on hover, but leaves a dead band of empty canvas
          under the idle panel that's far more obvious than the reflow it fixes.
          The canvas is anchored with items-start, so a taller panel grows
          downward and never moves the orbit. */}
      <div className="w-full min-w-0 flex-1" key={activeKey ?? "idle"}>
        <div className="page-fade">
          {active ? <WorkspacePanel workspace={active} /> : idlePanel}
        </div>
      </div>
    </div>
  );
}
