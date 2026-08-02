"use client";

import { useEffect, useRef, useState } from "react";

// Cubic ease-out count-up. Restarts whenever `target` changes, so a value that
// arrives asynchronously (the streak, a weekly count) animates from wherever
// the previous run left it rather than snapping.
//
// Respects prefers-reduced-motion by jumping straight to the target — the
// global CSS rule in globals.css only neutralizes CSS animations, and this is
// a JS one.
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || duration <= 0) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      fromRef.current = next;
      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
