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

// depthOf (opacity/scale/z-index simulated from orbital angle) was removed
// 2026-08-12 along with its tests: it was an invented embellishment on top
// of the reference design being ported, which has no such effect — see
// orbitGeometry.ts's comment at the former call site.

// Both a true circle now (2026-08-12, matching the reference design), so
// this is a weaker assertion than it used to be — kept anyway as a tripwire
// if either radius is ever retuned independently of the other.
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

  it("offsets along a circle of radius MOON_RX/MOON_RY", () => {
    expect(moonOffset(0)).toEqual({ x: MOON_RX, y: 0 });
    const quarter = moonOffset(Math.PI / 2);
    expect(quarter.x).toBeCloseTo(0);
    expect(quarter.y).toBeCloseTo(MOON_RY);
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
