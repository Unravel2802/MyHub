import { describe, expect, it } from "vitest";
import { depthOf } from "@/src/components/home/orbitGeometry";

// depthOf is the one piece of orbit math worth pinning: OrbitalHub's rAF loop
// derives opacity, scale AND stacking order from this single number, so a
// sign error here would not throw — it would just make the near/far illusion
// silently invert.

describe("depthOf", () => {
  it("is 0 at the far side of the ellipse (top, angle = -π/2)", () => {
    expect(depthOf(-Math.PI / 2)).toBeCloseTo(0);
  });

  it("is 1 at the near side of the ellipse (bottom, angle = π/2)", () => {
    expect(depthOf(Math.PI / 2)).toBeCloseTo(1);
  });

  it("is 0.5 at the sides, where the planet crosses the hub's own plane", () => {
    expect(depthOf(0)).toBeCloseTo(0.5);
    expect(depthOf(Math.PI)).toBeCloseTo(0.5);
  });

  it("stays within [0, 1] across a full lap", () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const depth = depthOf((deg * Math.PI) / 180);
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
    }
  });

  it("increases monotonically from the far side to the near side", () => {
    const angles = [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2];
    const depths = angles.map(depthOf);
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeGreaterThan(depths[i - 1]);
    }
  });
});
