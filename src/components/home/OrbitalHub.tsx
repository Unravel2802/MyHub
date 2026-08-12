"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { hueVar } from "@/src/components/moduleHues";
import { OrbitCenterHub } from "@/src/components/home/OrbitCenterHub";
import { WorkspacePanel } from "@/src/components/home/WorkspacePanel";
import {
  CANVAS_H,
  CANVAS_W,
  MOON_RX,
  MOON_RY,
  MOON_SPEED,
  NODE_PCT,
  ORBIT_RX,
  ORBIT_RY,
  PARTICLE_COUNT,
  SPEED,
  TRAIL_MAX,
  depthOf,
  moonAngleFor,
  moonOffset,
  particleFade,
  particlePosition,
  particleProgress,
  pushTrailPoint,
  reticleTicks,
  trailPointStyle,
  type TrailPoint,
} from "@/src/components/home/orbitGeometry";
import { HOME_WORKSPACES } from "@/src/components/home/homeWorkspaces";
import { HUE_TEXT } from "@/src/components/ui/hueClasses";
import { cn } from "@/src/lib/cn";

function OrbitalCanvas({
  activeKey,
  lockedKey,
  onHover,
  onHoverEnd,
  onToggleLock,
  onClearLock,
}: {
  // What's actually shown in the info panel right now — `locked` if
  // something is locked, otherwise whatever's hovered/focused.
  activeKey: string | null;
  lockedKey: string | null;
  onHover: (key: string) => void;
  onHoverEnd: () => void;
  onToggleLock: (key: string) => void;
  onClearLock: () => void;
}) {
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const spokeRefs = useRef<Record<string, SVGLineElement | null>>({});
  const trailRefs = useRef<Record<string, Array<SVGCircleElement | null>>>({});
  const trailsRef = useRef<Record<string, TrailPoint[]>>(
    Object.fromEntries(HOME_WORKSPACES.map((workspace) => [workspace.key, []])),
  );
  const hubRingRef = useRef<SVGCircleElement | null>(null);
  const hubAngleRef = useRef(0);
  const moonRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const moonElapsedRef = useRef(0);
  // One moon-orbit ellipse and one moon-spoke line per module, all rendered
  // up front (matching the trail-circle/spoke idiom above) and toggled via
  // opacity rather than mounted/unmounted — only the currently LOCKED
  // workspace's set is ever visible, but keeping every element alive avoids
  // remount churn when the lock moves between workspaces.
  const moonRingRefs = useRef<Record<string, SVGEllipseElement | null>>({});
  const moonSpokeRefs = useRef<Record<string, SVGLineElement | null>>({});
  // The particle stream travels the spoke of whichever workspace is LOCKED
  // (not merely hovered) — see orbitGeometry.ts's particle* functions. Three
  // shared circles, not one set per workspace: at most one spoke is ever
  // "expanded" at a time, so there's nothing to duplicate.
  const particleRefs = useRef<Array<SVGCircleElement | null>>([]);
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

  // A locked workspace keeps the scene paused even after the pointer leaves
  // entirely — you clicked a planet specifically to stop and read about it,
  // and having it drift off again the moment you move the mouse to the panel
  // would defeat the point.
  const lockedRef = useRef<string | null>(lockedKey);
  useEffect(() => {
    lockedRef.current = lockedKey;
  }, [lockedKey]);

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
      const targetSpeed = canvasHoveredRef.current || lockedRef.current ? 0 : 1;
      speedRef.current +=
        (targetSpeed - speedRef.current) * (1 - Math.exp(-elapsed / 180));

      if (!reduced)
        hubAngleRef.current += SPEED * elapsed * speedRef.current * 32;
      if (!reduced)
        moonElapsedRef.current += elapsed * speedRef.current * MOON_SPEED;
      hubRingRef.current?.setAttribute(
        "transform",
        `rotate(${hubAngleRef.current}, ${CANVAS_W / 2}, ${CANVAS_H / 2})`,
      );

      // Set inside the loop when a workspace matches the lock, read after it
      // to place the shared moon ring and particle stream. Declared outside
      // so TypeScript sees a single binding rather than one per iteration.
      let lockedPlanetPos: { x: number; y: number } | null = null;

      for (const workspace of HOME_WORKSPACES) {
        if (!reduced)
          anglesRef.current[workspace.key] +=
            SPEED * elapsed * speedRef.current;

        const angle = anglesRef.current[workspace.key];
        const x = ORBIT_RX * Math.cos(angle);
        const y = ORBIT_RY * Math.sin(angle);
        const depth = depthOf(angle);
        const isActive = activeRef.current === workspace.key;
        const isLockedWorkspace = lockedRef.current === workspace.key;
        if (isLockedWorkspace) lockedPlanetPos = { x, y };

        workspace.modules.forEach((module, index) => {
          const moonKey = `${workspace.key}:${module.href}`;
          const baseAngle = moonAngleFor(index, workspace.modules.length);
          const moonAngle =
            baseAngle + (isLockedWorkspace ? moonElapsedRef.current : 0);
          const offset = moonOffset(moonAngle);
          const moonX = x + offset.x;
          const moonY = y + offset.y;

          const moon = moonRefs.current[moonKey];
          if (moon) {
            moon.style.left = `${((CANVAS_W / 2 + moonX) / CANVAS_W) * 100}%`;
            moon.style.top = `${((CANVAS_H / 2 + moonY) / CANVAS_H) * 100}%`;
          }

          // Planet → moon spoke, visible only while this workspace is the
          // one that's locked — same visibility rule as the moon itself.
          const moonSpoke = moonSpokeRefs.current[moonKey];
          if (moonSpoke) {
            moonSpoke.setAttribute("x1", String(x));
            moonSpoke.setAttribute("y1", String(y));
            moonSpoke.setAttribute("x2", String(moonX));
            moonSpoke.setAttribute("y2", String(moonY));
            moonSpoke.style.opacity = isLockedWorkspace ? "0.4" : "0";
          }
        });

        // The moon-orbit ring: a dashed ellipse centred on the planet's live
        // position, same axis ratio as the main ring (orbitGeometry.ts). One
        // per workspace, all rendered, only the locked one's opacity is > 0.
        const moonRing = moonRingRefs.current[workspace.key];
        if (moonRing) {
          moonRing.setAttribute("cx", String(x));
          moonRing.setAttribute("cy", String(y));
          moonRing.style.opacity = isLockedWorkspace ? "0.3" : "0";
        }

        const trail = trailsRef.current[workspace.key];
        pushTrailPoint(trail, { x, y });
        const circles = trailRefs.current[workspace.key] ?? [];
        circles.forEach((circle, index) => {
          if (!circle) return;
          const point = trail[index];
          if (!point) {
            circle.setAttribute("opacity", "0");
            return;
          }
          const paintStyle = trailPointStyle(index, trail.length);
          circle.setAttribute("cx", String(CANVAS_W / 2 + point.x));
          circle.setAttribute("cy", String(CANVAS_H / 2 + point.y));
          circle.setAttribute("r", String(paintStyle.radius));
          circle.setAttribute("opacity", String(paintStyle.opacity));
        });

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
          // The soft blur reads as "this spoke is lit" at a glance; reserved
          // for the active one so it doesn't compete with the other two.
          spoke.setAttribute("filter", isActive ? "url(#soft)" : "none");
        }
      }

      // Particle stream: three pulses travelling the LOCKED workspace's
      // spoke (orbitGeometry.ts's particle* functions — pure functions of
      // `elapsed`, no per-particle state). Hidden when nothing is locked.
      for (let index = 0; index < PARTICLE_COUNT; index++) {
        const particle = particleRefs.current[index];
        if (!particle) continue;
        if (!lockedPlanetPos) {
          particle.setAttribute("opacity", "0");
          continue;
        }
        const u = particleProgress(index, elapsed);
        const pos = particlePosition(
          0,
          0,
          lockedPlanetPos.x,
          lockedPlanetPos.y,
          u,
        );
        particle.setAttribute("cx", String(pos.x));
        particle.setAttribute("cy", String(pos.y));
        particle.setAttribute("opacity", String(particleFade(u) * 0.9));
      }

      // Reduced motion still needs ONE pass to place everything; it just never
      // needs a second.
      if (reduced) return;
      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Only needed to colour the particle stream (a discrete choice, re-derived
  // on render like the rest of React state) — the per-frame loop above reads
  // lockedRef, not this.
  const lockedWorkspace =
    HOME_WORKSPACES.find((workspace) => workspace.key === lockedKey) ?? null;

  return (
    <div
      // Bordered and rounded like the Momentum panel beside it (Panel.tsx's
      // own rounded-lg/border-border), so the hero row reads as two matching
      // cards — this and the reference design's SystemMap wrapper agree on
      // that. overflow-hidden clips the SVG's own painted canvas rect to the
      // rounded corners; no separate bg-surface needed, the SVG already
      // paints `var(--canvas)` across the full viewBox.
      className="relative w-full max-w-[560px] shrink-0 overflow-hidden rounded-lg border border-border"
      // A click that reaches this div, rather than being stopped by a node's
      // own click handler, is a click on empty space (the starfield, the
      // hub, the orbit ring) — that's "click away to deselect."
      onClick={onClearLock}
      onMouseEnter={() => {
        canvasHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        canvasHoveredRef.current = false;
        onHoverEnd();
      }}
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          <pattern
            height="24"
            id="orbit-dot-grid"
            patternUnits="userSpaceOnUse"
            width="24"
          >
            <circle cx="1" cy="1" fill="var(--border)" r="1" />
          </pattern>
          <radialGradient id="orbit-vignette" r="70%">
            <stop offset="45%" stopColor="var(--canvas)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--canvas)" stopOpacity="0.88" />
          </radialGradient>
          {/* Without this the orbit renders as a hard 3px band — the single
              biggest reason a ring reads as "a drawn ellipse" rather than a
              glowing path. Blur a wide soft stroke, then composite the crisp
              source back on top. */}
          <filter height="300%" id="ring-glow" width="140%" x="-20%" y="-100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          {/* Bloom: planet/moon reticles and particles. A wide blur merged
              back over the crisp source, so the shape stays readable at its
              core while glowing at its edges — a halo, not a smear. */}
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
          {/* Soft: a tighter version for the active spoke line only — enough
              to read as "lit" without blurring the line into the trail. */}
          <filter height="180%" id="soft" width="180%" x="-40%" y="-40%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="2" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
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

        <rect fill="var(--canvas)" height={CANVAS_H} width={CANVAS_W} />
        <rect
          fill="url(#orbit-dot-grid)"
          height={CANVAS_H}
          opacity="0.7"
          width={CANVAS_W}
        />
        <rect fill="url(#orbit-vignette)" height={CANVAS_H} width={CANVAS_W} />

        {HOME_WORKSPACES.flatMap((workspace) =>
          Array.from({ length: TRAIL_MAX }, (_, index) => (
            <circle
              cx={CANVAS_W / 2}
              cy={CANVAS_H / 2}
              fill={hueVar(workspace.hue)}
              key={`${workspace.key}-trail-${index}`}
              opacity="0"
              r="0"
              ref={(element) => {
                const refs = (trailRefs.current[workspace.key] ??= []);
                refs[index] = element;
              }}
            />
          )),
        )}

        <g transform={`translate(${CANVAS_W / 2},${CANVAS_H / 2})`}>
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

          {/* Moon-orbit ring: one dashed ellipse per workspace, ref-toggled
              to opacity 0 except for whichever one is locked. Radii are
              static — MOON_RX/RY never change — only cx/cy move each frame
              to track the planet. */}
          {HOME_WORKSPACES.map((workspace) => (
            <ellipse
              fill="none"
              key={workspace.key}
              opacity="0"
              ref={(el) => {
                moonRingRefs.current[workspace.key] = el;
              }}
              rx={MOON_RX}
              ry={MOON_RY}
              stroke={hueVar(workspace.hue)}
              strokeDasharray="2 5"
              strokeWidth="0.6"
            />
          ))}

          {/* Planet → moon spokes, same ref-toggle idiom as the ring above:
              one dedicated line per module, static hue via JSX prop,
              position and visibility written every frame. */}
          {HOME_WORKSPACES.flatMap((workspace) =>
            workspace.modules.map((module) => (
              <line
                key={`${workspace.key}:${module.href}`}
                opacity="0"
                ref={(el) => {
                  moonSpokeRefs.current[`${workspace.key}:${module.href}`] = el;
                }}
                stroke={hueVar(workspace.hue)}
                strokeWidth="0.5"
              />
            )),
          )}

          {/* Particle stream: three shared circles, not one set per
              workspace — at most one spoke is ever "locked" at a time, so
              there is only ever one stream to draw. */}
          {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
            <circle
              filter="url(#bloom)"
              key={index}
              opacity="0"
              r="1.8"
              ref={(el) => {
                particleRefs.current[index] = el;
              }}
              fill={
                lockedWorkspace ? hueVar(lockedWorkspace.hue) : "var(--accent)"
              }
            />
          ))}
        </g>

        <circle
          cx={CANVAS_W / 2}
          cy={CANVAS_H / 2}
          fill="none"
          opacity="0.35"
          r="44"
          ref={hubRingRef}
          stroke="var(--accent)"
          strokeDasharray="5 8"
          strokeWidth="0.75"
        />
      </svg>

      <OrbitCenterHub />

      {HOME_WORKSPACES.flatMap((workspace) =>
        workspace.modules.map((module) => {
          const isVisible = lockedKey === workspace.key;
          return (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute z-40 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-opacity",
                isVisible ? "opacity-100" : "opacity-0",
              )}
              data-orbit-moon={workspace.key}
              key={`${workspace.key}:${module.href}`}
              ref={(element) => {
                moonRefs.current[`${workspace.key}:${module.href}`] = element;
              }}
            >
              <svg
                className="size-full overflow-visible"
                filter="url(#bloom)"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  fill="none"
                  opacity="0.5"
                  r="6"
                  stroke={hueVar(workspace.hue)}
                  strokeWidth="0.75"
                />
                {reticleTicks(12, 12, 6, 2.5).map((tick, index) => (
                  <line
                    key={index}
                    opacity="0.45"
                    stroke={hueVar(workspace.hue)}
                    strokeWidth="0.75"
                    {...tick}
                  />
                ))}
                <circle cx="12" cy="12" fill={hueVar(workspace.hue)} r="2.5" />
              </svg>
            </span>
          );
        }),
      )}

      {HOME_WORKSPACES.map((workspace) => {
        const isActive = activeKey === workspace.key;
        const isLocked = lockedKey === workspace.key;
        const ticks = reticleTicks(36, 36, 13, 5);
        const possessiveLabel = workspace.label.endsWith("s")
          ? `${workspace.label}'`
          : `${workspace.label}'s`;
        return (
          <button
            aria-label={
              isLocked
                ? `Hide ${possessiveLabel} modules`
                : `Show ${possessiveLabel} modules`
            }
            aria-pressed={isLocked}
            // NOT a flex column containing the label: the node is translated by
            // -50%/-50% onto its point on the ellipse, so whatever this box
            // contains is what gets centred there. With the label inside, the
            // box is sphere+label tall and the SPHERE ends up sitting above the
            // orbit path. The label is positioned out of flow below instead, so
            // this box is exactly the sphere.
            //
            // A <button>, not a <Link>: clicking a node selects it, it doesn't
            // navigate. Getting to the actual page happens inside the panel
            // this opens (its module list, or the "Open X" link) — see
            // WorkspacePanel.
            className="orbit-node absolute block cursor-pointer appearance-none border-0 bg-transparent p-0"
            key={workspace.key}
            onBlur={() => {
              canvasHoveredRef.current = false;
              onHoverEnd();
            }}
            // Keyboard focus previews the same way hover does; Enter/Space
            // then fires onClick natively, same as a mouse click.
            onFocus={() => {
              canvasHoveredRef.current = true;
              onHover(workspace.key);
            }}
            onMouseEnter={() => onHover(workspace.key)}
            onMouseLeave={() => onHoverEnd()}
            // Stops the click reaching the canvas's own onClick, which treats
            // any click it sees as "clicked empty space, clear the lock" —
            // without this, selecting a node would clear itself in the same
            // event.
            onClick={(event) => {
              event.stopPropagation();
              onToggleLock(workspace.key);
            }}
            ref={(el) => {
              nodeRefs.current[workspace.key] = el;
            }}
            style={{ width: `${NODE_PCT}%` }}
            type="button"
          >
            {/* The button remains the interactive and focusable node. The SVG
                is paint only: the reference prototype's clickable <g> would
                remove this page's only keyboard route to each workspace. */}
            <motion.span
              animate={{ scale: isActive ? 1.22 : 1 }}
              className="relative block aspect-square w-full rounded-full"
              transition={{ damping: 24, stiffness: 360, type: "spring" }}
            >
              <svg
                aria-hidden="true"
                className="size-full overflow-visible"
                filter="url(#bloom)"
                viewBox="0 0 72 72"
              >
                <circle
                  cx="36"
                  cy="36"
                  fill={hueVar(workspace.hue)}
                  opacity={isActive ? "0.18" : "0.08"}
                  r={isActive ? "26" : "20"}
                />
                <circle
                  cx="36"
                  cy="36"
                  fill="none"
                  opacity={isActive ? "0.95" : "0.65"}
                  r="13"
                  stroke={hueVar(workspace.hue)}
                  strokeWidth={isActive ? "1.5" : "1"}
                />
                {ticks.map((tick, index) => (
                  <line
                    key={index}
                    opacity={isActive ? "0.95" : "0.65"}
                    stroke={hueVar(workspace.hue)}
                    strokeWidth={isActive ? "1.5" : "1"}
                    {...tick}
                  />
                ))}
                <circle
                  cx="36"
                  cy="36"
                  fill={hueVar(workspace.hue)}
                  r={isActive ? "6" : "5"}
                />
                {isLocked ? (
                  <circle
                    cx="36"
                    cy="36"
                    fill="none"
                    opacity="0.5"
                    r="24"
                    stroke={hueVar(workspace.hue)}
                    strokeDasharray="3 5"
                  />
                ) : null}
              </svg>
            </motion.span>
            <span
              className={cn(
                "absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em]",
                HUE_TEXT[workspace.hue],
              )}
              ref={(el) => {
                labelRefs.current[workspace.key] = el;
              }}
            >
              {workspace.label}
            </span>
          </button>
        );
      })}

      {/* A discrete React-driven fade (activeKey changes on hover/lock, not
          per frame), not a ref write — no different from the label opacity
          logic above, just gated on the whole-scene state instead of one
          workspace's depth. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-1 text-center text-[9px] uppercase tracking-[0.16em] text-subtle transition-opacity duration-300",
          activeKey ? "opacity-0" : "opacity-70",
        )}
      >
        Click a cluster to expand
      </span>
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
  const reducedMotion = useReducedMotion();
  // Two separate ideas: `hoveredKey` is a transient preview (mouse/focus,
  // cleared the instant it leaves), `lockedKey` is a click's sticky choice
  // that survives the pointer moving away. Locked always wins what's shown —
  // once you've clicked a planet, casually hovering another one while
  // reading the panel shouldn't swap it out from under you.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const activeKey = lockedKey ?? hoveredKey;
  const active = HOME_WORKSPACES.find((ws) => ws.key === activeKey) ?? null;
  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  useEffect(() => {
    if (!lockedKey) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLockedKey(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lockedKey]);

  return (
    // items-start, not items-center: the panel beside the canvas changes height
    // when you hover a workspace (Career lists nine modules, the idle panel is
    // shorter). Centering re-flows that difference into the canvas's position,
    // which slides the planet out from under the cursor mid-hover.
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start">
      <OrbitalCanvas
        activeKey={activeKey}
        lockedKey={lockedKey}
        onClearLock={() => setLockedKey(null)}
        onHover={setHoveredKey}
        onHoverEnd={() => setHoveredKey(null)}
        onToggleLock={(key) =>
          setLockedKey((prev) => (prev === key ? null : key))
        }
      />

      {/* Deliberately NO min-height: reserving the tallest panel's height stops
          the page reflowing on hover, but leaves a dead band of empty canvas
          under the idle panel that's far more obvious than the reflow it fixes.
          The canvas is anchored with items-start, so a taller panel grows
          downward and never moves the orbit. */}
      <div className="w-full min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: 10 }}
            key={activeKey ?? "idle"}
            transition={panelTransition}
          >
            {active ? (
              <WorkspacePanel
                locked={lockedKey !== null}
                onClose={() => setLockedKey(null)}
                workspace={active}
              />
            ) : (
              idlePanel
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
