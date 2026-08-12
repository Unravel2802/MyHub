# Codex prompt — orbit ring wash + vanishing labels

Two verified (not guessed) bugs in `src/components/home/OrbitalHub.tsx`, found by comparing a
live screenshot against `Redesign MyHub Dashboard/src/App.tsx` line by line and confirming each
one against actual computed styles in the browser, not by eyeballing.

---

```
Fix two verified regressions in the Home orbit (src/components/home/OrbitalHub.tsx) against the
reference design at "Redesign MyHub Dashboard/src/App.tsx". Both are confirmed, not guesses — I
checked computed styles in a live browser before writing this.

READ "Redesign MyHub Dashboard/src/App.tsx" BEFORE making either change below — it's the Figma
Make export of the actual design these two fixes are restoring. It's kept on disk as a reference
and is deliberately untracked/excluded from tsconfig, eslint and prettier (it's a separate Vite
app with its own deps) — read it, don't import from it or add it back to any build config. The
two line ranges quoted below are copy-pasted from it so you don't have to search, but skim the
surrounding "Planet orbit ring" and "Planet labels always visible" sections yourself too — there
may be other small details worth matching that these two bugs don't cover.

BUG 1 — the orbit ring is a glowing accent-purple band, not a thin neutral guide.

OrbitalHub.tsx lines ~424-444 draw the ring as:
  - a blurred 4px accent-colored ellipse at 0.3 opacity (filter="url(#ring-glow)")
  - a crisp accent-colored dashed ellipse on top at 0.55 opacity, strokeWidth 0.75

Two coats of `var(--accent)` (indigo/purple) tracing the full ellipse perimeter is the single most
visually dominant thing in the scene, and it's why the whole card reads as "washed in purple"
instead of the reference's high-contrast near-black-with-bright-points look.

The reference's equivalent ("Planet orbit ring" in App.tsx) is:
  <circle r={CLUSTER_R} fill="none" stroke={borderCol} strokeWidth="0.75"
    strokeDasharray="4 7" strokeOpacity="0.5" />
borderCol there is a NEUTRAL gray (dark:#2a2a2e), not accent, and there is no blur/glow layer at
all — it's meant to read as an architectural guide line, not a decoration.

FIX: change the ring's stroke from `var(--accent)` to `var(--border)` on both ellipses (the
blurred one and the crisp dashed one, lines ~427-444), and DELETE the blurred glow ellipse
entirely (lines 427-435, the one with filter="url(#ring-glow)") — keep only the crisp dashed
hairline (opacity 0.55, strokeWidth 0.75, strokeDasharray "1.5 13"), also switched to
`var(--border)`. If removing the whole `#ring-glow` <filter> definition (lines ~326-329) leaves it
unused elsewhere in the file, delete the filter def too rather than leaving dead defs.

Same treatment for the "inner guide ring" right above it (lines ~410-422, rx={ORBIT_RX * 0.68}):
it's already at a whisper-thin 0.1 opacity, but it's still tinted `var(--accent)` — switch it to
`var(--border)` too, for the same reason. Its own comment already says "It has to sit at the very
edge of visible... drawn any stronger it starts reading as a second orbit" — the fix agrees with
that comment's intent, it's just the wrong color doing it.

Leave the per-workspace SPOKE lines (the hub→planet radial lines, using
`stroke={`url(#spoke-${workspace.key})`}`, gradient from each workspace's own hue) exactly as they
are — those are supposed to be colored, that's what tells you which spoke belongs to which
workspace. Only the two ELLIPSE rings (main orbit + inner guide) get recolored to neutral.

BUG 2 — cluster labels vanish for part of every orbit lap.

Lines ~227-230:
  const legibility = Math.max(0, Math.min(1, (depth - 0.28) / 0.34));
  label.style.opacity = String(isActive ? 1 : legibility);

This fades a workspace's label to fully 0 opacity while its node is on the far third of the
ellipse. I confirmed this live: on load, "Career"'s label was invisible (opacity 0); three seconds
later, after it had orbited further, it read opacity 1. It's not a crash, it's working exactly as
coded — but it's wrong relative to the reference, which states directly in its own spec: "Planet
labels always visible, moon labels visible on hover only." Only MOON labels are supposed to be
conditional; cluster labels never are.

FIX: cluster labels must never fully disappear. Don't just delete the fade — the comment above it
explains WHY it exists ("A sphere half-occluded by the hub reads as depth; a name tag sliced down
the middle just reads as broken... labels fade out over the far third of the arc so they're gone
before they can be clipped"), which is a real clipping problem on the far arc, not a made-up one.
So: keep the fade curve, but give it a floor instead of a ceiling of 0 — e.g.
  const legibility = Math.max(0.35, Math.min(1, (depth - 0.28) / 0.34 + 0.35));
or similar — tune the floor so the label is always at least dimly legible instead of vanishing
outright, while still dimming on the far arc where clipping is a real risk. Whatever curve you
land on, it must never reach exactly 0 for a cluster label. (Moon labels are unaffected by this —
they're correctly hover-only per WorkspacePanel's own separate logic, don't touch those.)

VERIFY: after both fixes, screenshot the Home page in the browser (both themes) and confirm (a)
the orbit ring reads as a thin, subtle, near-invisible guide rather than the brightest thing on
the card, and (b) let the scene run for at least 5 seconds and confirm no cluster label ever drops
to fully invisible. Run the existing gate: npm run lint, npm run typecheck, npm run test:ui,
npx playwright test tests/ui/hub.spec.ts.
```

---

## Why I didn't just fix this myself

Home/orbit work has been contract-and-implementation both mine this session, which is already off
the CLAUDE.md 35/65 split — a CSS color swap and a fade-floor tweak are exactly the kind of
mechanical, non-domain-logic change that belongs to Codex. Flagging it back to that split now that
the user asked for a Codex prompt explicitly, rather than continuing to do UI polish myself.

## What I checked and ruled out before writing this

- **Label position tracking a different node than intended** — checked the JSX: the label `<span>`
  is a direct child of the node `<button>`, positioned via `top-full -translate-x-1/2`, so it
  structurally cannot desync from its own node's position. Not a bug.
- **Money's hue being "wrong"** (lime instead of the reference's literal emerald) — already
  verified correct in a prior pass: lime is Finance's real, established hue everywhere else in the
  app. Not a bug, don't let Codex "fix" this.
- **Hub-ambient ellipse being proportionally wider than the reference's circle** (rx=130 vs the
  reference's r=85, on canvases of different total width) — real but minor, roughly 46% vs 35% of
  half-width. Left out of the prompt above; worth a look only if the ring-color fix doesn't fully
  resolve the "washed out" impression on its own.
