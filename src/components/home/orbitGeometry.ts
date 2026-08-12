// The orbital scene's geometry and palette, separated from the component that
// renders it so the numbers can be read — and the depth function tested —
// without wading through 400 lines of JSX.

// Logical canvas. Everything is expressed in these units and rendered into an
// SVG viewBox / percentage offsets, so the whole scene scales with its
// container instead of needing a breakpoint per size.
//
// 2026-08-12: switched from an invented flattened-ellipse "perspective" back
// to the reference design's literal geometry — a true circle, at the
// reference's own numbers (docs/handoff/dashboard-redesign-port.md /
// "Redesign MyHub Dashboard/src/App.tsx"). The ellipse was ours, not
// Figma's, and it was one of several un-requested embellishments (see
// depthOf below) that made the shipped scene diverge from the design being
// ported. CANVAS_W/H, CLUSTER_R and CENTER_R below are the reference's exact
// VW/VH/CLUSTER_R/hub-radius values.
export const CANVAS_W = 480;
export const CANVAS_H = 320;
export const ORBIT_RX = 112;
export const ORBIT_RY = 112;
export const CENTER_R = 22;
export const NODE_R = 22;

// Sphere sizes as a PERCENTAGE of the container width, not fixed pixels: the
// canvas is fluid (percentage offsets into an aspect-ratio box), so px spheres
// would grow relatively larger as the container shrank and the scene would
// stop being the same picture at different widths.
export const CENTER_PCT = ((CENTER_R * 2) / CANVAS_W) * 100;
export const NODE_PCT = ((NODE_R * 2) / CANVAS_W) * 100;

// Radians per millisecond. The reference's own OMEGA_P: one full revolution
// every 38 seconds.
export const SPEED = (2 * Math.PI) / 38000;

// depthOf existed to dim, shrink and occlude a planet on the far side of the
// (former) ellipse, simulating 3D. Removed 2026-08-12: the reference has NO
// such effect. Its own render-order spec lists planet nodes last —
// "on top so they're always clickable" — meaning every planet is always
// full brightness, full size, and always drawn in FRONT of the hub, never
// behind it, regardless of orbital position. That z-order/opacity/scale
// simulation was an addition on top of the design being ported, not part of
// it, and it was a standing source of "this doesn't look like the reference"
// reports. OrbitalHub.tsx no longer calls this function; nothing here
// replaces it, because the reference doesn't have anything to replace it
// with.

/* ── Moons: a workspace's modules orbiting their own planet ──────────────────
   Now genuinely the reference's own circular sub-orbit (its own MOON_R),
   not an ellipse-matched approximation of it — that adaptation existed only
   because the main ring used to be an ellipse. Moons are DECORATION, not
   navigation: WorkspacePanel keeps the keyboard path to every module (see
   app/page.tsx's comment on why the duplicate card grid was deleted). A moon
   that becomes clickable must be a real <button> with a 48px hit area,
   whatever its painted radius. */
export const MOON_RX = 54;
export const MOON_RY = 54;
export const MOON_SPEED = (2 * Math.PI) / 9000; // reference's OMEGA_M

/** Where moon `index` of `total` starts, evenly spaced around its planet. */
export function moonAngleFor(index: number, total: number): number {
  return total === 0 ? 0 : (index / total) * 2 * Math.PI;
}

/** Moon offset from its planet's centre. Add to the planet's own x/y. */
export function moonOffset(angle: number): { x: number; y: number } {
  return { x: MOON_RX * Math.cos(angle), y: MOON_RY * Math.sin(angle) };
}

/* ── Motion trails ───────────────────────────────────────────────────────────
   A trail is a fixed-length ring of recent positions. Two rules matter:

   1. Sample by DISTANCE, not by frame. Sampling every frame ties trail length
      to refresh rate — the same trail is twice as long on a 120Hz display —
      and the scene eases to a halt on hover, so a per-frame trail collapses
      into a dot pile at exactly the moment the user is looking at it.
   2. Cap the buffer. Unbounded growth on a page that animates indefinitely is
      a slow leak. */
export const TRAIL_MAX = 24;
export const TRAIL_MIN_STEP = 0.35; // logical units between samples

export interface TrailPoint {
  x: number;
  y: number;
}

/**
 * Push `point` onto `trail` if it has travelled far enough since the last
 * sample. Mutates in place — this runs inside the rAF loop, where allocating a
 * new array per planet per frame is exactly the garbage the ref-mutation
 * architecture exists to avoid. Returns whether a sample was taken.
 */
export function pushTrailPoint(
  trail: TrailPoint[],
  point: TrailPoint,
): boolean {
  const last = trail[trail.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < TRAIL_MIN_STEP) {
    return false;
  }
  trail.push(point);
  if (trail.length > TRAIL_MAX) trail.shift();
  return true;
}

/**
 * How a trail sample paints: oldest is smallest and faintest, newest is
 * largest and strongest, so the trail reads as a direction rather than as a
 * string of beads. `index` 0 is the oldest sample.
 */
export function trailPointStyle(
  index: number,
  length: number,
): { radius: number; opacity: number } {
  const progress = length <= 1 ? 1 : index / (length - 1);
  return { radius: progress * 4, opacity: progress * 0.3 };
}

/* ── Reticle nodes ───────────────────────────────────────────────────────── */

export interface TickSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The four cardinal tick marks of a reticle, pointing outward from a ring of
 * radius `radius` and extending `length` beyond it.
 */
export function reticleTicks(
  cx: number,
  cy: number,
  radius: number,
  length: number,
): TickSegment[] {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx, dy]) => ({
    x1: cx + radius * dx,
    y1: cy + radius * dy,
    x2: cx + (radius + length) * dx,
    y2: cy + (radius + length) * dy,
  }));
}

/**
 * Which side of a node its label hangs off, given the label's horizontal
 * offset from the node. The dead zone around 0 keeps a label centred while a
 * node crosses the vertical, instead of flipping sides on a sub-pixel wobble.
 */
export function labelAnchorFor(dx: number): "start" | "middle" | "end" {
  if (dx > 10) return "start";
  if (dx < -10) return "end";
  return "middle";
}

/* ── Particles: three pulses travelling the hub → expanded-planet spoke ──────
   Ported from the Figma Make reference's animation-engine spec
   (docs/handoff/dashboard-redesign-port.md), adapted to this file's existing
   "pure function of elapsed time" style rather than the reference's
   setState-per-frame loop — OrbitalHub.tsx writes these into ref-held SVG
   nodes inside its own rAF callback, the same as every other animated value
   here. No stored velocity, no accumulated state: a particle's position is
   fully determined by (index, t). */
export const PARTICLE_PERIOD = 1600; // ms per lap
export const PARTICLE_COUNT = 3;

/**
 * Particle `index`'s progress along the spoke at time `t`, in [0, 1).
 * Particles are evenly staggered in phase so they read as a continuous
 * stream rather than three dots moving in lockstep.
 */
export function particleProgress(index: number, t: number): number {
  const phase = index / PARTICLE_COUNT;
  const raw = (t / PARTICLE_PERIOD + phase) % 1;
  // JS `%` can return a small negative value for negative `t`; normalize into
  // [0, 1) rather than let a particle's fade formula see a negative `u`.
  return raw < 0 ? raw + 1 : raw;
}

/**
 * Opacity multiplier for a particle at progress `u`. Ramps in over the first
 * 12% of the spoke, holds at full strength through the middle, and ramps out
 * over the last 18% — a longer fade-out than fade-in, so arriving at the
 * planet reads as a slower, more deliberate close than leaving the hub.
 */
export function particleFade(u: number): number {
  if (u < 0.12) return u / 0.12;
  if (u > 0.82) return (1 - u) / 0.18;
  return 1;
}

/** A particle's position at progress `u` along the straight line (x1,y1)→(x2,y2). */
export function particlePosition(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  u: number,
): { x: number; y: number } {
  return { x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u };
}

// STARS, SPHERE_BACKGROUND and HUB_BACKGROUND (the pre-port sphere/starfield
// visual system) were removed 2026-08-12 once the reticle port replaced every
// call site: the dot-grid + vignette in OrbitalHub.tsx replaced STARS, the
// reticle SVG per node replaced SPHERE_BACKGROUND, and OrbitCenterHub's flat
// bordered circle replaced HUB_BACKGROUND. See
// docs/handoff/dashboard-redesign-port.md.
