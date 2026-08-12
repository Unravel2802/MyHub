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
// 96, not the reference's CLUSTER_R of 112 — a deliberate, requested
// deviation (2026-08-13), and the one number here that is knowingly NOT the
// reference's. Two reasons it holds up beyond taste: the labels hang radially
// outward from each planet, so a tighter ring keeps them further from the
// card's edges; and an expanded cluster reaches ORBIT_R + MOON_RX from the
// hub, which at 112 was 166 against a half-height of 160 — its lowest moons
// were being clipped by the card. At 96 that reach is 150 and the whole
// expansion fits.
export const ORBIT_RX = 96;
export const ORBIT_RY = 96;
export const CENTER_R = 22;
export const NODE_R = 22;

// The hub sits at the reference's CX/CY = (222, 160) — deliberately LEFT of
// the canvas midpoint (240), because planet labels hang radially outward and
// the right side needs the extra room for "start"-anchored labels. Centring
// the hub was one of the port's silent deviations; every scene position is
// relative to this point, so it shifted the whole picture.
export const CX = 222;
export const CY = 160;
export const CX_PCT = (CX / CANVAS_W) * 100;
export const CY_PCT = (CY / CANVAS_H) * 100;

// Sphere sizes as a PERCENTAGE of the container width, not fixed pixels: the
// canvas is fluid (percentage offsets into an aspect-ratio box), so px spheres
// would grow relatively larger as the container shrank and the scene would
// stop being the same picture at different widths.
export const CENTER_PCT = ((CENTER_R * 2) / CANVAS_W) * 100;
export const NODE_PCT = ((NODE_R * 2) / CANVAS_W) * 100;

// Radians per millisecond. The reference's own OMEGA_P: one full revolution
// every 38 seconds.
export const SPEED = (2 * Math.PI) / 38000;

// Degrees per millisecond. The reference's hub-ring rotation is
// `(t / 9000) * 360` — one revolution every 9 seconds, the same period as the
// moons. The port previously derived this from SPEED with a magic ×32, which
// landed at one revolution per ~68s: visibly near-static.
export const HUB_RING_SPEED = 360 / 9000;

/**
 * Where a workspace's planet starts, in radians, from its reference `deg`
 * (the CLUSTERS table's own values: 270 / 30 / 150). The reference offsets by
 * -90° so deg 0 reads as "up".
 */
export function planetStartAngle(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

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
   because the main ring used to be an ellipse. Moons are NAVIGATION, not
   decoration (2026-08-12): each one is a real <Link> to its module, since
   the WorkspacePanel that used to hold the module list is gone — the
   reference never swaps the Momentum rail for one. Painted radius is small;
   the hit target is the 32-unit circle OrbitalHub overlays on each moon. */
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
      and in a background tab, where rAF is throttled, per-frame sampling
      would stretch the trail into a string of far-apart beads.
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

// The particle stream (three pulses travelling the expanded spoke) was
// removed 2026-08-12 in the literal-match pass: the reference implementation
// has no particles anywhere — it was another embellishment layered onto the
// port (like depthOf above), and every such addition has been a standing
// source of "this doesn't look like the design" reports.

// STARS, SPHERE_BACKGROUND and HUB_BACKGROUND (the pre-port sphere/starfield
// visual system) were removed 2026-08-12 once the reticle port replaced every
// call site: the dot-grid + vignette in OrbitalHub.tsx replaced STARS, the
// reticle SVG per node replaced SPHERE_BACKGROUND, and OrbitCenterHub's flat
// bordered circle replaced HUB_BACKGROUND. See
// docs/handoff/dashboard-redesign-port.md.
