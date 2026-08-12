"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { hueVar } from "@/src/components/moduleHues";
import { OrbitCenterHub } from "@/src/components/home/OrbitCenterHub";
import {
  CANVAS_H,
  CANVAS_W,
  CX,
  CY,
  HUB_RING_SPEED,
  MOON_RX,
  MOON_SPEED,
  NODE_PCT,
  ORBIT_RX,
  ORBIT_RY,
  SPEED,
  TRAIL_MAX,
  labelAnchorFor,
  moonAngleFor,
  moonOffset,
  planetStartAngle,
  pushTrailPoint,
  reticleTicks,
  trailPointStyle,
  type TrailPoint,
} from "@/src/components/home/orbitGeometry";
import { HOME_WORKSPACES } from "@/src/components/home/homeWorkspaces";

// The reference detects a moon hover within 16 scene units of its centre —
// a 32-unit hit circle. The HTML hit target mirrors that, as a percentage of
// the fluid canvas the same way NODE_PCT does.
const MOON_HIT_PCT = (32 / CANVAS_W) * 100;

// 2026-08-12, second literal-match pass. The first pass fixed the geometry
// (circle, reference radii); this one fixes everything AROUND the geometry
// that had still drifted from "Redesign MyHub Dashboard/src/App.tsx":
//
//   1. The scene never pauses. The port eased the whole scene to a halt on
//      canvas hover / lock; the reference orbits continuously — planets 38s,
//      moons 9s, hub ring 9s — through every hover and expansion.
//   2. The hub sits at the reference's CX/CY (222, 160), not the canvas
//      midpoint, and everything is painted INSIDE the scaled SVG (labels
//      included), so the whole picture scales with the canvas the way the
//      prototype's viewBox does.
//   3. Expanding a cluster shows its moons in the canvas; the panel beside
//      the canvas is the Momentum panel, always — the reference never swaps
//      it for a workspace list. Moons are therefore real <Link>s now (the
//      keyboard/navigation path WorkspacePanel used to provide).
//
// Architecture is unchanged where CLAUDE.md pins it: one rAF loop mutating
// ref-held nodes, zero React re-renders per frame. React re-renders only on
// discrete state changes (hover, expand), exactly as before.
export function OrbitalHub({ panel }: { panel: ReactNode }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hoveredMoonKey, setHoveredMoonKey] = useState<string | null>(null);

  // Mirrors read inside the rAF loop, so state changes don't tear down and
  // restart the animation (which would jump every planet).
  const hoveredRef = useRef<string | null>(null);
  const expandedRef = useRef<string | null>(null);
  useEffect(() => {
    hoveredRef.current = hoveredKey;
  }, [hoveredKey]);
  useEffect(() => {
    expandedRef.current = expandedKey;
  }, [expandedKey]);

  const anglesRef = useRef<Record<string, number>>(
    Object.fromEntries(
      HOME_WORKSPACES.map((ws) => [ws.key, planetStartAngle(ws.deg)]),
    ),
  );
  const moonElapsedRef = useRef(0);
  const hubAngleRef = useRef(0);
  const trailsRef = useRef<Record<string, TrailPoint[]>>(
    Object.fromEntries(HOME_WORKSPACES.map((ws) => [ws.key, []])),
  );

  const planetGroupRefs = useRef<Record<string, SVGGElement | null>>({});
  const planetLabelRefs = useRef<Record<string, SVGTextElement | null>>({});
  const spokeRefs = useRef<Record<string, SVGLineElement | null>>({});
  const trailCircleRefs = useRef<
    Record<string, Array<SVGCircleElement | null>>
  >({});
  const hubRingRef = useRef<SVGCircleElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const moonRingRef = useRef<SVGCircleElement | null>(null);
  const moonGroupRefs = useRef<Record<string, SVGGElement | null>>({});
  const moonLabelRefs = useRef<Record<string, SVGTextElement | null>>({});
  const moonSpokeRefs = useRef<Record<string, SVGLineElement | null>>({});
  const moonLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Placement only — advancing the clocks happens in the loop, so this can
  // also run standalone under reduced motion (once on load, and again when an
  // expansion mounts moons that the stopped loop would never place).
  const paintRef = useRef<() => void>(() => {});
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const paintScene = () => {
      hubRingRef.current?.setAttribute(
        "transform",
        `rotate(${hubAngleRef.current})`,
      );

      for (const workspace of HOME_WORKSPACES) {
        const angle = anglesRef.current[workspace.key];
        const x = ORBIT_RX * Math.cos(angle);
        const y = ORBIT_RY * Math.sin(angle);
        const isActive = hoveredRef.current === workspace.key;
        const isExpanded = expandedRef.current === workspace.key;

        planetGroupRefs.current[workspace.key]?.setAttribute(
          "transform",
          `translate(${x},${y})`,
        );

        // Label pushed radially outward from the hub, reference-style: it
        // rides (retR + 14) beyond the reticle along the planet's own angle,
        // and anchors to whichever side of the hub it's on.
        const retR = isActive ? 14 : isExpanded ? 13 : 10;
        const lx = x + (retR + 14) * Math.cos(angle);
        const ly = y + (retR + 14) * Math.sin(angle);
        const label = planetLabelRefs.current[workspace.key];
        if (label) {
          label.setAttribute("x", String(lx - x));
          label.setAttribute("y", String(ly - y));
          label.setAttribute("text-anchor", labelAnchorFor(lx));
        }

        const spoke = spokeRefs.current[workspace.key];
        if (spoke) {
          spoke.setAttribute("x2", String(x));
          spoke.setAttribute("y2", String(y));
        }

        const trail = trailsRef.current[workspace.key];
        pushTrailPoint(trail, { x, y });
        const circles = trailCircleRefs.current[workspace.key] ?? [];
        circles.forEach((circle, index) => {
          if (!circle) return;
          const point = trail[index];
          if (!point) {
            circle.setAttribute("opacity", "0");
            return;
          }
          const paintStyle = trailPointStyle(index, trail.length);
          circle.setAttribute("cx", String(point.x));
          circle.setAttribute("cy", String(point.y));
          circle.setAttribute("r", String(paintStyle.radius));
          circle.setAttribute("opacity", String(paintStyle.opacity));
        });

        const node = nodeRefs.current[workspace.key];
        if (node) {
          node.style.left = `${((CX + x) / CANVAS_W) * 100}%`;
          node.style.top = `${((CY + y) / CANVAS_H) * 100}%`;
        }

        if (isExpanded) {
          moonRingRef.current?.setAttribute("cx", String(x));
          moonRingRef.current?.setAttribute("cy", String(y));

          workspace.modules.forEach((module, index) => {
            const moonKey = `${workspace.key}:${module.href}`;
            const moonAngle =
              moonAngleFor(index, workspace.modules.length) +
              moonElapsedRef.current;
            const offset = moonOffset(moonAngle);
            const moonX = x + offset.x;
            const moonY = y + offset.y;

            moonGroupRefs.current[moonKey]?.setAttribute(
              "transform",
              `translate(${moonX},${moonY})`,
            );

            const moonSpoke = moonSpokeRefs.current[moonKey];
            if (moonSpoke) {
              moonSpoke.setAttribute("x1", String(x));
              moonSpoke.setAttribute("y1", String(y));
              moonSpoke.setAttribute("x2", String(moonX));
              moonSpoke.setAttribute("y2", String(moonY));
            }

            // Moon label sits (mR + 12) out from the moon, away from the
            // planet, with the reference's own cos-threshold anchoring.
            const moonLabel = moonLabelRefs.current[moonKey];
            if (moonLabel) {
              const cos = Math.cos(moonAngle);
              moonLabel.setAttribute("x", String(16.5 * cos));
              moonLabel.setAttribute("y", String(16.5 * Math.sin(moonAngle)));
              moonLabel.setAttribute(
                "text-anchor",
                cos > 0.2 ? "start" : cos < -0.2 ? "end" : "middle",
              );
            }

            const link = moonLinkRefs.current[moonKey];
            if (link) {
              link.style.left = `${((CX + moonX) / CANVAS_W) * 100}%`;
              link.style.top = `${((CY + moonY) / CANVAS_H) * 100}%`;
            }
          });
        }
      }
    };
    paintRef.current = paintScene;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(now - last, 50);
      last = now;

      // The reference's clocks run unconditionally — hovering or expanding
      // never slows the scene. (Its prototype re-derives every position from
      // wall time each frame; accumulating the same rates here is
      // equivalent, and survives the tab throttling rAF.)
      hubAngleRef.current += HUB_RING_SPEED * elapsed;
      moonElapsedRef.current += MOON_SPEED * elapsed;
      for (const workspace of HOME_WORKSPACES) {
        anglesRef.current[workspace.key] += SPEED * elapsed;
      }

      paintScene();
      frame = requestAnimationFrame(tick);
    };

    if (reducedRef.current) {
      // One placement pass so nothing sits stacked at the origin, then hold.
      paintScene();
      return;
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Under reduced motion the loop above never runs again, but expanding a
  // cluster mounts moons that still need one placement pass — and a hover
  // changes the label's reticle offset.
  useEffect(() => {
    if (reducedRef.current) paintRef.current();
  }, [expandedKey, hoveredKey]);

  useEffect(() => {
    if (!expandedKey) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpandedKey(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedKey]);

  const expandedWorkspace =
    HOME_WORKSPACES.find((ws) => ws.key === expandedKey) ?? null;

  return (
    // The reference's hero row: the canvas is the dominant flex-1 surface and
    // the Momentum panel is a fixed 272px rail beside it — not the other way
    // around. items-stretch so the panel runs the full height of the canvas.
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
      <div
        // A click that reaches this div, rather than being stopped by a
        // node's own handler, is a click on empty space — "click away to
        // collapse."
        className="relative w-full min-w-0 flex-1 overflow-hidden rounded-lg border border-border"
        onClick={() => setExpandedKey(null)}
        onMouseLeave={() => setHoveredKey(null)}
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <defs>
            {/* The reference's own pattern: 22-unit pitch, r=0.7 dots. */}
            <pattern
              height="22"
              id="orbit-dot-grid"
              patternUnits="userSpaceOnUse"
              width="22"
            >
              <circle cx="1" cy="1" fill="var(--border)" r="0.7" />
            </pattern>
            <radialGradient id="orbit-vignette" r="55%">
              <stop offset="30%" stopColor="var(--canvas)" stopOpacity="0" />
              <stop
                offset="100%"
                stopColor="var(--canvas)"
                stopOpacity="0.88"
              />
            </radialGradient>
            <radialGradient cx="50%" cy="50%" id="hub-ambient" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            {/* Bloom: reticles and cores. A wide blur merged back over the
                crisp source — a halo, not a smear. */}
            <filter height="260%" id="bloom" width="260%" x="-80%" y="-80%">
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="4.5"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Soft: a tighter version for the active spoke only. */}
            <filter height="180%" id="soft" width="180%" x="-40%" y="-40%">
              <feGaussianBlur
                in="SourceGraphic"
                result="blur"
                stdDeviation="2"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Per-workspace glow gradient — the reference's rg-{id}. */}
            {HOME_WORKSPACES.map((workspace) => (
              <radialGradient
                cx="50%"
                cy="50%"
                id={`rg-${workspace.key}`}
                key={workspace.key}
                r="50%"
              >
                <stop
                  offset="0%"
                  stopColor={hueVar(workspace.hue)}
                  stopOpacity="0.4"
                />
                <stop
                  offset="100%"
                  stopColor={hueVar(workspace.hue)}
                  stopOpacity="0"
                />
              </radialGradient>
            ))}
          </defs>

          <rect fill="var(--canvas)" height={CANVAS_H} width={CANVAS_W} />
          <rect
            fill="url(#orbit-dot-grid)"
            height={CANVAS_H}
            width={CANVAS_W}
          />
          <rect
            fill="url(#orbit-vignette)"
            height={CANVAS_H}
            width={CANVAS_W}
          />

          <g transform={`translate(${CX},${CY})`}>
            <circle fill="url(#hub-ambient)" r="85" />

            {/* Hub → planet spokes. Solid hue at reference weights/opacities
                (no gradient, no dash — both were port inventions), with the
                reference's own 250ms transition between states. */}
            {HOME_WORKSPACES.map((workspace) => {
              const active =
                hoveredKey === workspace.key || expandedKey === workspace.key;
              return (
                <line
                  filter={active ? "url(#soft)" : undefined}
                  key={workspace.key}
                  ref={(el) => {
                    spokeRefs.current[workspace.key] = el;
                  }}
                  stroke={hueVar(workspace.hue)}
                  strokeOpacity={active ? 0.65 : 0.13}
                  strokeWidth={active ? 1.25 : 0.6}
                  style={{
                    transition: "stroke-opacity 250ms, stroke-width 250ms",
                  }}
                  x1="0"
                  x2={ORBIT_RX}
                  y1="0"
                  y2="0"
                />
              );
            })}

            {HOME_WORKSPACES.flatMap((workspace) =>
              Array.from({ length: TRAIL_MAX }, (_, index) => (
                <circle
                  fill={hueVar(workspace.hue)}
                  key={`${workspace.key}-trail-${index}`}
                  opacity="0"
                  r="0"
                  ref={(element) => {
                    const refs = (trailCircleRefs.current[workspace.key] ??=
                      []);
                    refs[index] = element;
                  }}
                />
              )),
            )}

            {/* The planet orbit ring — the reference's "4 7" dash at 0.5. */}
            <circle
              data-orbit-ring="main"
              fill="none"
              r={ORBIT_RX}
              stroke="var(--border)"
              strokeDasharray="4 7"
              strokeOpacity="0.5"
              strokeWidth="0.75"
            />

            {/* Moon-orbit ring around the expanded planet. */}
            {expandedWorkspace ? (
              <circle
                fill="none"
                r={MOON_RX}
                ref={moonRingRef}
                stroke={hueVar(expandedWorkspace.hue)}
                strokeDasharray="2 5"
                strokeOpacity="0.3"
                strokeWidth="0.6"
              />
            ) : null}

            {/* Planet → moon spokes for the expanded workspace. */}
            {expandedWorkspace
              ? expandedWorkspace.modules.map((module) => {
                  const moonKey = `${expandedWorkspace.key}:${module.href}`;
                  const isHovered = hoveredMoonKey === moonKey;
                  return (
                    <line
                      key={moonKey}
                      ref={(el) => {
                        moonSpokeRefs.current[moonKey] = el;
                      }}
                      stroke={hueVar(expandedWorkspace.hue)}
                      strokeOpacity={isHovered ? 0.55 : 0.2}
                      strokeWidth={isHovered ? 0.9 : 0.5}
                    />
                  );
                })
              : null}

            {/* Hub decoration: the rotating dashed ring (9s/rev — the same
                period as the moons, per the reference). The disc itself is
                the OrbitCenterHub HTML overlay. */}
            <circle
              fill="none"
              opacity="0.28"
              r="31"
              ref={hubRingRef}
              stroke="var(--accent)"
              strokeDasharray="5 8"
              strokeWidth="0.75"
            />

            {/* Moons: painted at reference sizes (glow 9/14, ring 6.5, core
                2.5/3, ticks 3), labels on hover only. */}
            {expandedWorkspace
              ? expandedWorkspace.modules.map((module) => {
                  const moonKey = `${expandedWorkspace.key}:${module.href}`;
                  const isHovered = hoveredMoonKey === moonKey;
                  const hue = hueVar(expandedWorkspace.hue);
                  return (
                    <g
                      filter="url(#bloom)"
                      key={moonKey}
                      ref={(el) => {
                        moonGroupRefs.current[moonKey] = el;
                      }}
                    >
                      <circle
                        fill={hue}
                        fillOpacity={isHovered ? 0.18 : 0.08}
                        r={isHovered ? 14 : 9}
                      />
                      <circle
                        fill="none"
                        r="6.5"
                        stroke={hue}
                        strokeOpacity={isHovered ? 0.85 : 0.4}
                        strokeWidth={isHovered ? 0.9 : 0.6}
                      />
                      {reticleTicks(0, 0, 6.5, 3).map((tick, index) => (
                        <line
                          key={index}
                          stroke={hue}
                          strokeOpacity={isHovered ? 0.85 : 0.35}
                          strokeWidth={isHovered ? 1 : 0.6}
                          {...tick}
                        />
                      ))}
                      <circle fill={hue} r={isHovered ? 3 : 2.5} />
                      <text
                        dominantBaseline="middle"
                        fill={hue}
                        fillOpacity={isHovered ? 0.95 : 0}
                        fontSize="10"
                        fontWeight="500"
                        ref={(el) => {
                          moonLabelRefs.current[moonKey] = el;
                        }}
                      >
                        {module.label}
                      </text>
                    </g>
                  );
                })
              : null}

            {/* Planets, last — on top, always full brightness (the
                reference's own render order; no depth simulation). */}
            {HOME_WORKSPACES.map((workspace) => {
              const isHovered = hoveredKey === workspace.key;
              const isExpanded = expandedKey === workspace.key;
              const active = isHovered || isExpanded;
              const coreR = isHovered ? 7 : isExpanded ? 6.5 : 5;
              const retR = isHovered ? 14 : isExpanded ? 13 : 10;
              const tickLen = active ? 5 : 4;
              const hue = hueVar(workspace.hue);
              return (
                <g
                  filter="url(#bloom)"
                  key={workspace.key}
                  ref={(el) => {
                    planetGroupRefs.current[workspace.key] = el;
                  }}
                >
                  <circle
                    fill={`url(#rg-${workspace.key})`}
                    fillOpacity={isHovered ? 1 : isExpanded ? 0.85 : 0.6}
                    r={active ? 26 : 18}
                    style={{ transition: "r 200ms" }}
                  />
                  {isExpanded ? (
                    <circle
                      fill="none"
                      r={retR + 8}
                      stroke={hue}
                      strokeDasharray="3 5"
                      strokeOpacity="0.35"
                      strokeWidth="0.75"
                    />
                  ) : null}
                  <circle
                    fill="none"
                    r={retR}
                    stroke={hue}
                    strokeOpacity={isHovered ? 0.95 : isExpanded ? 0.8 : 0.5}
                    strokeWidth={active ? 1.25 : 0.85}
                    style={{ transition: "r 150ms" }}
                  />
                  {reticleTicks(0, 0, retR, tickLen).map((tick, index) => (
                    <line
                      key={index}
                      stroke={hue}
                      strokeOpacity={isHovered ? 0.95 : isExpanded ? 0.8 : 0.45}
                      strokeWidth={active ? 1.25 : 0.85}
                      {...tick}
                    />
                  ))}
                  <circle
                    fill={hue}
                    r={coreR}
                    style={{ transition: "r 150ms" }}
                  />
                  {/* Always visible, reference-style: title case, 10/11px in
                      scene units so it scales with the canvas. */}
                  <text
                    data-orbit-label={workspace.key}
                    dominantBaseline="middle"
                    fill={hue}
                    fillOpacity={active ? 1 : 0.75}
                    fontSize={active ? 11 : 10}
                    fontWeight={active ? 600 : 500}
                    ref={(el) => {
                      planetLabelRefs.current[workspace.key] = el;
                    }}
                  >
                    {workspace.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <OrbitCenterHub />

        {/* Interaction overlays. The SVG above is paint only — the reference
            prototype's clickable <g> has no keyboard path, and the orbit is
            this page's only route to each workspace. DOM order interleaves
            each planet's button with its moons' links so Tab flows node →
            its modules → next node. */}
        {HOME_WORKSPACES.map((workspace) => {
          const isExpanded = expandedKey === workspace.key;
          const possessive = workspace.label.endsWith("s")
            ? `${workspace.label}'`
            : `${workspace.label}'s`;
          return (
            <Fragment key={workspace.key}>
              <button
                aria-label={
                  isExpanded
                    ? `Hide ${possessive} modules`
                    : `Show ${possessive} modules`
                }
                aria-pressed={isExpanded}
                className="orbit-node absolute z-20 block aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0"
                onBlur={() => setHoveredKey(null)}
                // Keyboard focus previews the same way hover does;
                // Enter/Space then fires onClick natively.
                onFocus={() => setHoveredKey(workspace.key)}
                onMouseEnter={() => setHoveredKey(workspace.key)}
                onMouseLeave={() => setHoveredKey(null)}
                // Stop the click reaching the canvas, which treats any click
                // it sees as "empty space — collapse."
                onClick={(event) => {
                  event.stopPropagation();
                  setExpandedKey((prev) =>
                    prev === workspace.key ? null : workspace.key,
                  );
                }}
                ref={(el) => {
                  nodeRefs.current[workspace.key] = el;
                }}
                style={{ width: `${NODE_PCT}%` }}
                type="button"
              />
              {isExpanded
                ? workspace.modules.map((module) => {
                    const moonKey = `${workspace.key}:${module.href}`;
                    return (
                      <Link
                        aria-label={module.label}
                        className="absolute z-30 block aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
                        data-orbit-moon={workspace.key}
                        href={module.href}
                        key={moonKey}
                        onBlur={() => setHoveredMoonKey(null)}
                        onFocus={() => setHoveredMoonKey(moonKey)}
                        onMouseEnter={() => setHoveredMoonKey(moonKey)}
                        onMouseLeave={() => setHoveredMoonKey(null)}
                        // A moon click is navigation, not "empty space."
                        onClick={(event) => event.stopPropagation()}
                        ref={(el) => {
                          moonLinkRefs.current[moonKey] = el;
                        }}
                        style={{ width: `${MOON_HIT_PCT}%` }}
                      />
                    );
                  })
                : null}
            </Fragment>
          );
        })}

        <span
          aria-hidden="true"
          className={
            "pointer-events-none absolute inset-x-0 bottom-2 text-center text-[9px] uppercase tracking-[0.07em] text-subtle transition-opacity duration-300" +
            (expandedKey ? " opacity-0" : " opacity-70")
          }
        >
          Click a cluster to expand
        </span>
      </div>

      {/* The reference's fixed 272px rail. Never swapped out — expanding a
          cluster shows its modules in the canvas, not here. */}
      <div className="w-full shrink-0 lg:w-[272px] [&>section]:h-full">
        {panel}
      </div>
    </div>
  );
}
