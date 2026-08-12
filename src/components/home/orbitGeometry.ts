// The orbital scene's geometry and palette, separated from the component that
// renders it so the numbers can be read — and the depth function tested —
// without wading through 400 lines of JSX.

// Logical canvas. Everything is expressed in these units and rendered into an
// SVG viewBox / percentage offsets, so the whole scene scales with its
// container instead of needing a breakpoint per size.
//
// The orbit is a heavily flattened ellipse (RX ~2.8x RY) — that ratio IS the
// perspective. A circle would read as a flat wheel seen head-on; this reads as
// a ring receding into the screen.
export const CANVAS_W = 560;
export const CANVAS_H = 370;
export const ORBIT_RX = 215;
export const ORBIT_RY = 76;
export const CENTER_R = 52;
export const NODE_R = 36;

// Sphere sizes as a PERCENTAGE of the container width, not fixed pixels: the
// canvas is fluid (percentage offsets into an aspect-ratio box), so px spheres
// would grow relatively larger as the container shrank and the scene would
// stop being the same picture at different widths.
export const CENTER_PCT = ((CENTER_R * 2) / CANVAS_W) * 100;
export const NODE_PCT = ((NODE_R * 2) / CANVAS_W) * 100;

// Radians per millisecond. One lap takes ~14s — fast enough that the motion
// reads as alive at a glance, without fighting the content beside it.
export const SPEED = 0.00045;

/**
 * 0 at the far side of the ellipse (top), 1 at the near side (bottom).
 *
 * This single number drives opacity, scale AND stacking order together, which
 * is what makes the ring read as 3D rather than as a flat oval: a planet that
 * dims must also shrink and pass BEHIND the hub, or the illusion breaks.
 */
export function depthOf(angle: number): number {
  return (Math.sin(angle) + 1) / 2;
}

/* ── Moons: a workspace's modules orbiting their own planet ──────────────────
   Published for the Figma Make redesign port (docs/handoff/dashboard-redesign-
   port.md). The prototype orbits moons on a TRUE CIRCLE; this doesn't, and the
   difference is deliberate. The main ring is a 2.8:1 flattened ellipse, and
   that flattening IS the scene's perspective — a circular sub-orbit inside it
   would read as a wheel lying in a different plane from the ring carrying it,
   which reads as a bug rather than as depth. Moons use the same axis ratio.

   Moons are DECORATION, not navigation. WorkspacePanel keeps the keyboard path
   to every module (see app/page.tsx's comment on why the duplicate card grid
   was deleted). A moon that becomes clickable must be a real <button> with a
   48px hit area, whatever its painted radius. */
export const MOON_RX = 54;
export const MOON_RY = MOON_RX * (ORBIT_RY / ORBIT_RX); // same perspective
export const MOON_SPEED = 0.0007; // rad/ms — ~9s a lap, faster than the ring

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

// Static star field. Fixed coordinates rather than random so the scene is
// identical between server and client render — a Math.random() field here
// would be a hydration mismatch.
export const STARS = [
  { x: 48, y: 24, r: 0.8, o: 0.34 },
  { x: 497, y: 67, r: 1, o: 0.42 },
  { x: 112, y: 292, r: 0.7, o: 0.28 },
  { x: 453, y: 308, r: 0.9, o: 0.36 },
  { x: 26, y: 198, r: 0.6, o: 0.3 },
  { x: 527, y: 148, r: 0.8, o: 0.34 },
  { x: 74, y: 347, r: 1, o: 0.28 },
  { x: 386, y: 36, r: 0.7, o: 0.4 },
  { x: 202, y: 17, r: 0.6, o: 0.26 },
  { x: 37, y: 114, r: 0.9, o: 0.3 },
  { x: 532, y: 252, r: 0.7, o: 0.34 },
  { x: 158, y: 58, r: 0.8, o: 0.28 },
  { x: 477, y: 188, r: 0.6, o: 0.26 },
  { x: 310, y: 355, r: 0.9, o: 0.3 },
];

// A sphere, not a disc: a specular highlight up-left, the hue bouncing back
// from down-right, and a body gradient between two shades of the module's own
// hue. Built from `--hue` + color-mix so it re-shades itself in light mode
// instead of naming a raw color (see moduleHues.ts).
//
// The dark end blends toward `--canvas` rather than toward black: in dark mode
// that IS near-black, but in light mode it resolves pale, so the same one
// declaration gives a shaded ball on both themes instead of a black blob on
// white.
export const SPHERE_BACKGROUND = `
  radial-gradient(circle at 30% 26%, color-mix(in srgb, white 30%, transparent) 0%, transparent 52%),
  radial-gradient(circle at 68% 72%, color-mix(in srgb, var(--hue) 22%, transparent) 0%, transparent 48%),
  linear-gradient(140deg, color-mix(in srgb, var(--hue) 32%, var(--hue-surface)) 0%, color-mix(in srgb, var(--hue-surface) 80%, var(--canvas)) 100%)
`;

// The hub is the light source of the scene, so its body is a RADIAL gradient
// (lit from the middle out) where the planets' is linear.
export const HUB_BACKGROUND = `
  radial-gradient(circle at 32% 28%, color-mix(in srgb, white 46%, transparent) 0%, transparent 48%),
  radial-gradient(circle at 68% 72%, color-mix(in srgb, var(--accent) 62%, var(--canvas)) 0%, transparent 55%),
  radial-gradient(circle at 50% 50%, var(--accent) 0%, color-mix(in srgb, var(--accent) 48%, var(--canvas)) 100%)
`;
