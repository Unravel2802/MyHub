"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  CENTER_PCT,
  HUB_BACKGROUND,
} from "@/src/components/home/orbitGeometry";

// The "M" at the centre of the orbit. Purely decorative and self-contained:
// it holds no orbit state, so it is separated from the canvas that does.
export function OrbitCenterHub() {
  const reducedMotion = useReducedMotion();

  // z-10 so near planets (up to z-20) cross in front of it and far ones pass
  // behind — the moment that sells the orbit as 3D.
  return (
    <div
      aria-hidden="true"
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: "50%", top: "50%", width: `${CENTER_PCT}%` }}
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
        className="relative flex aspect-square w-full items-center justify-center rounded-full"
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
        <motion.span
          animate={reducedMotion ? undefined : { scale: [1, 1.04, 1] }}
          className="relative text-lg font-bold text-accent-strong"
          transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
        >
          M
        </motion.span>
      </div>
    </div>
  );
}
