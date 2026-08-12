"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  CENTER_PCT,
  CX_PCT,
  CY_PCT,
} from "@/src/components/home/orbitGeometry";

// The "MH" at the centre of the orbit. Purely decorative and self-contained:
// it holds no orbit state, so it is separated from the canvas that does.
//
// Flat surface circle with a border, not a glowing gradient sphere: the
// reference design (docs/handoff/dashboard-redesign-port.md) draws the hub as
// surfCol fill + borderCol stroke + an inner accent ring at low opacity — the
// ambient light comes from the large low-opacity `hub-ambient` radial
// gradient painted behind the whole scene in OrbitalHub.tsx, not from a glow
// on the hub itself. A bright sphere here competed with the workspace nodes
// for "the brightest thing on screen"; the hub should read as a fixed point,
// not another planet.
export function OrbitCenterHub() {
  const reducedMotion = useReducedMotion();

  // z-10, under the planet buttons (z-20) — the reference's fixed stacking
  // order, not a depth cue. Positioned at the reference's off-centre CX/CY,
  // the same origin every scene element is painted relative to.
  return (
    <div
      aria-hidden="true"
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${CX_PCT}%`,
        top: `${CY_PCT}%`,
        width: `${CENTER_PCT}%`,
      }}
    >
      {/* Two concentric sonar rings, out of phase (1.2s stagger) so they
          never pulse in lockstep. Static (no animate prop) under reduced
          motion rather than omitted — the rings are still meaningful as a
          resting halo around the hub, just not moving. */}
      {[1.9, 1.5].map((scale, index) => (
        <motion.span
          animate={
            reducedMotion
              ? undefined
              : {
                  opacity: [0.06, 0.14, 0.06],
                  scale: [scale, scale * 1.04, scale],
                }
          }
          className="absolute inset-0 rounded-full border border-accent"
          initial={{ opacity: 0.06, scale }}
          key={scale}
          transition={{
            delay: index * 1.2,
            duration: 3.5 + index * 1.2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
      <div
        className="relative flex aspect-square w-full items-center justify-center rounded-full bg-surface"
        style={{ border: "1.5px solid var(--border)" }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[14%] rounded-full border"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
            borderWidth: "0.5px",
          }}
        />
        <span className="relative text-sm font-semibold tracking-tight text-foreground">
          MH
        </span>
      </div>
    </div>
  );
}
