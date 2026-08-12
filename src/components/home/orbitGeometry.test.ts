import { describe, expect, it } from "vitest";
import {
  MOON_RX,
  MOON_RY,
  ORBIT_RX,
  ORBIT_RY,
  PARTICLE_COUNT,
  PARTICLE_PERIOD,
  TRAIL_MAX,
  TRAIL_MIN_STEP,
  type TrailPoint,
  depthOf,
  labelAnchorFor,
  moonAngleFor,
  moonOffset,
  particleFade,
  particlePosition,
  particleProgress,
  pushTrailPoint,
  reticleTicks,
  trailPointStyle,
} from "@/src/components/home/orbitGeometry";

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

// The moon sub-orbit must sit in the SAME plane as the ring carrying it. A
// circular sub-orbit inside a 2.8:1 ellipse reads as a wheel lying at a
// different angle — a bug, not depth. This is the assertion that keeps the two
// in step if either radius is ever retuned.
describe("moon orbit", () => {
  it("uses the same axis ratio as the main ring", () => {
    expect(MOON_RY / MOON_RX).toBeCloseTo(ORBIT_RY / ORBIT_RX);
  });

  it("spaces moons evenly around a full lap", () => {
    const total = 4;
    const angles = Array.from({ length: total }, (_, i) =>
      moonAngleFor(i, total),
    );
    expect(angles).toEqual([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]);
  });

  it("survives a workspace with no modules", () => {
    expect(moonAngleFor(0, 0)).toBe(0);
    expect(Number.isNaN(moonAngleFor(0, 0))).toBe(false);
  });

  it("offsets along the flattened ellipse, not a circle", () => {
    expect(moonOffset(0)).toEqual({ x: MOON_RX, y: 0 });
    const quarter = moonOffset(Math.PI / 2);
    expect(quarter.x).toBeCloseTo(0);
    expect(quarter.y).toBeCloseTo(MOON_RY);
    // The vertical reach is materially shorter than the horizontal — that IS
    // the perspective.
    expect(Math.abs(quarter.y)).toBeLessThan(MOON_RX / 2);
  });
});

describe("trails", () => {
  it("takes the first sample unconditionally", () => {
    const trail: TrailPoint[] = [];
    expect(pushTrailPoint(trail, { x: 0, y: 0 })).toBe(true);
    expect(trail).toHaveLength(1);
  });

  it("skips samples closer than the minimum step", () => {
    const trail: TrailPoint[] = [{ x: 0, y: 0 }];
    const tooClose = TRAIL_MIN_STEP / 2;
    expect(pushTrailPoint(trail, { x: tooClose, y: 0 })).toBe(false);
    expect(trail).toHaveLength(1);
  });

  it("samples by distance, so a halted scene stops growing the trail", () => {
    // The scene eases to a stop on hover. Sampling per frame would pile 24
    // points on one spot at exactly the moment the user is looking at it.
    const trail: TrailPoint[] = [{ x: 10, y: 10 }];
    for (let frame = 0; frame < 200; frame++) {
      pushTrailPoint(trail, { x: 10, y: 10 });
    }
    expect(trail).toHaveLength(1);
  });

  it("caps the buffer, so an indefinitely animating page doesn't leak", () => {
    const trail: TrailPoint[] = [];
    for (let i = 0; i < TRAIL_MAX * 5; i++) {
      pushTrailPoint(trail, { x: i * TRAIL_MIN_STEP * 2, y: 0 });
    }
    expect(trail).toHaveLength(TRAIL_MAX);
  });

  it("keeps the newest samples when it evicts", () => {
    const trail: TrailPoint[] = [];
    for (let i = 0; i < TRAIL_MAX + 3; i++) {
      pushTrailPoint(trail, { x: i * TRAIL_MIN_STEP * 2, y: 0 });
    }
    const newest = trail[trail.length - 1];
    expect(newest.x).toBeCloseTo((TRAIL_MAX + 2) * TRAIL_MIN_STEP * 2);
  });

  it("paints oldest faintest and newest strongest", () => {
    const oldest = trailPointStyle(0, TRAIL_MAX);
    const newest = trailPointStyle(TRAIL_MAX - 1, TRAIL_MAX);
    expect(oldest.radius).toBeLessThan(newest.radius);
    expect(oldest.opacity).toBeLessThan(newest.opacity);
    expect(newest.opacity).toBeLessThanOrEqual(0.3);
  });

  it("does not divide by zero on a single-sample trail", () => {
    const only = trailPointStyle(0, 1);
    expect(Number.isFinite(only.radius)).toBe(true);
    expect(Number.isFinite(only.opacity)).toBe(true);
  });
});

describe("reticle ticks", () => {
  it("emits four cardinal segments pointing outward", () => {
    const ticks = reticleTicks(100, 100, 10, 4);
    expect(ticks).toHaveLength(4);
    for (const tick of ticks) {
      const inner = Math.hypot(tick.x1 - 100, tick.y1 - 100);
      const outer = Math.hypot(tick.x2 - 100, tick.y2 - 100);
      expect(inner).toBeCloseTo(10);
      expect(outer).toBeCloseTo(14);
    }
  });
});

describe("labelAnchorFor", () => {
  it("hangs the label away from the node", () => {
    expect(labelAnchorFor(40)).toBe("start");
    expect(labelAnchorFor(-40)).toBe("end");
  });

  it("centres inside a dead zone, so a node crossing the vertical doesn't flip", () => {
    expect(labelAnchorFor(0)).toBe("middle");
    expect(labelAnchorFor(9)).toBe("middle");
    expect(labelAnchorFor(-9)).toBe("middle");
  });
});

describe("particleProgress", () => {
  it("starts each particle at an even phase offset", () => {
    const atZero = Array.from({ length: PARTICLE_COUNT }, (_, i) =>
      particleProgress(i, 0),
    );
    expect(atZero).toEqual([0, 1 / 3, 2 / 3]);
  });

  it("wraps around after one full period", () => {
    expect(particleProgress(0, PARTICLE_PERIOD)).toBeCloseTo(0);
    expect(particleProgress(0, PARTICLE_PERIOD * 2.5)).toBeCloseTo(0.5);
  });

  it("stays within [0, 1) for a negative-leaning phase", () => {
    // index/PARTICLE_COUNT is always >= 0, but this guards the normalization
    // branch directly rather than relying on the inputs never producing it.
    for (let t = -PARTICLE_PERIOD * 3; t < 0; t += 137) {
      const u = particleProgress(1, t);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe("particleFade", () => {
  it("is 0 at the very start and very end of the spoke", () => {
    expect(particleFade(0)).toBeCloseTo(0);
    expect(particleFade(1)).toBeCloseTo(0);
  });

  it("is fully opaque through the middle", () => {
    expect(particleFade(0.5)).toBe(1);
    expect(particleFade(0.12)).toBe(1);
    expect(particleFade(0.82)).toBe(1);
  });

  it("fades out over a longer window than it fades in", () => {
    // 12% in, 18% out — arriving at the planet is the slower half.
    const fadeInWindow = 0.12;
    const fadeOutWindow = 1 - 0.82;
    expect(fadeOutWindow).toBeGreaterThan(fadeInWindow);
  });

  it("never goes negative just past either edge", () => {
    expect(particleFade(0.001)).toBeGreaterThan(0);
    expect(particleFade(0.999)).toBeGreaterThan(0);
  });
});

describe("particlePosition", () => {
  it("sits at the start when u=0 and the end when u=1", () => {
    expect(particlePosition(0, 0, 100, 40, 0)).toEqual({ x: 0, y: 0 });
    expect(particlePosition(0, 0, 100, 40, 1)).toEqual({ x: 100, y: 40 });
  });

  it("interpolates linearly at the midpoint", () => {
    expect(particlePosition(0, 0, 100, 40, 0.5)).toEqual({ x: 50, y: 20 });
  });

  it("works from a non-origin start, matching a planet-to-planet spoke", () => {
    expect(particlePosition(10, -10, 30, 30, 0.5)).toEqual({ x: 20, y: 10 });
  });
});
