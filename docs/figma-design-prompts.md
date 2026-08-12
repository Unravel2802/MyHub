# Figma AI Prompts — MyHub Frontend Upgrade (screenshot-driven)

Workflow: screenshot a page → paste it into Figma AI with a prompt below → get a redesigned frame.

Prompts are written against MyHub's real tokens (`app/globals.css`) so what comes back maps onto
the existing system instead of inventing a parallel one.

---

## Before you start — how to take the screenshots

This matters more than the prompt wording. Figma AI redesigns what it can see.

1. **1440px wide, full-page** (not just the viewport). In Chrome: DevTools → Cmd+Shift+P →
   "Capture full size screenshot".
2. **One theme per shot.** Send the light one for redesign work — light mode is the weaker of the
   two and where the gains are. Ask for dark as a follow-up in the same thread.
3. **With real data on screen.** An empty page redesigns into a prettier empty page. Seed it.
4. **One page per conversation.** Figma AI drifts when you paste a second unrelated screenshot.
5. Also grab **one mobile shot at 390px** per page for the responsive pass (Prompt R).

---

## Prompt 0 — Paste this ONCE at the top of each conversation, before the screenshot

```
I'm redesigning MyHub, a personal productivity dashboard I built. I'll paste screenshots of real
pages and ask you to improve them. Read these constraints first and apply them to everything.

WHAT MYHUB IS: a data-dense internal tool for one power user. Register: Linear, Height, Vercel,
Raycast. Crisp, dense, high-contrast, quiet. Precision, not personality.
No hero sections, no marketing gradients, no stock illustrations, no drop-shadowed floating cards.

WHAT "NOT DECORATIVE" MEANS HERE — read this carefully, it is a precise rule, not a blanket ban
on visual expression:
- Banned: ornament that carries NO information. A gradient behind a table. A shape whose only job
  is to fill space. An icon that repeats the label beside it. Texture for texture's sake.
- Allowed and wanted: form that ENCODES something. Size that means magnitude. Color that means
  category. Position or depth that means relationship. Motion that means state change.
If an element looks expressive but a user could read data off it, it is functional and it stays.
Before you remove anything on aesthetic grounds, ask what it encodes. If it encodes something,
redesign it — do not delete it. If you still think it should go, say so in text and leave it in.

This rule governs the DATA PAGES. The home screen has its own brief and is exempt — see below
when I paste it.

HARD RULE — PRESERVE THE INFORMATION ARCHITECTURE. Do not remove data, columns, panels or
controls that are in my screenshot, and do not invent features that aren't. You may re-rank,
re-group and re-weight what's there. If you think something should be cut, say so in text
instead of silently deleting it.

TYPE — Geist (fallback Inter), Geist Mono for numbers and code.
- Headings: tracking-tight, weight 600. Body: 14px, relaxed leading, weight 400.
- Scale: 48 (one hero number per page) / 30 / 20 / 16 / 14 / 13 / 12.
- Section headers are 12px UPPERCASE, wide letter-spacing, muted. Use these hard — they're the
  workhorse for breaking up dense panels.
- Every figure in a table or stat tile uses tabular numerals.

COLOR — light mode
  canvas #f4f4f5 · surface #ffffff · surface-subtle #fafafa
  foreground #09090b · body #3f3f46 · muted #52525b
  border #e4e4e7 · input #d4d4d8
  accent #4f46e5 · accent-hover #4338ca · accent-surface #eef2ff · accent-border #c7d2fe
  success #15803d · danger #b91c1c

COLOR — dark mode
  canvas #09090b · surface #18181b · surface-subtle #27272a · surface-raised #1f1f23
  foreground #fafafa · body #d4d4d8 · muted #a1a1aa
  border #27272a · input #3f3f46
  accent #6366f1 · accent-hover #818cf8 · accent-surface #1e1b4b · accent-border #3730a3
  success #4ade80 · danger #f87171

MODULE HUES — each module owns ONE hue, used only for: the page-header wash, the nav icon, and
badges. Every card stays neutral zinc regardless of module.
  Tasks blue #1d4ed8 / #60a5fa · Prep violet #6d28d9 / #a78bfa · Jobs cyan #0e7490 / #22d3ee
  Finance emerald #047857 / #34d399 · Notes amber #b45309 / #fbbf24 · Reader teal #0f766e
  Drills fuchsia #a21caf · Trading orange #c2410c · Roadmap lime #3f6212
  Library rose #be123c / #fb7185
  (light hex / dark hex)

  Unassigned hues available for new modules — do NOT use these unless I name the module:
  sky #0369a1 / #38bdf8 · purple #7e22ce / #c084fc · pink #be185d / #f472b6
  slate #475569 / #94a3b8 · stone #57534e / #a8a29e

  Because there are now this many hues, hue alone is NOT a reliable way to tell modules apart.
  Every module badge must pair its hue with a distinct icon, and must stay legible if you
  desaturate the whole frame to greyscale. If a design depends on the viewer distinguishing
  purple from violet, or pink from rose, it is broken — fix it with icon and label, not color.

SPACING — only 8, 16, 24, 32px. Panel padding 24. Page gaps 24. Tight stat tiles 8. Nothing over
32. Empty containers cap at 120px tall — an empty column is a slot, not a room.

SHAPE & DEPTH
- Radius 8 (cards/panels), 6 (buttons/inputs/badges), 999 (pills/avatars).
- Depth = 1px border + a background step, NOT shadows. Light: surface #fff sits on canvas
  #f4f4f5. Dark: NO shadow at all, elevation is #09090b → #18181b → #27272a.
- Shadows only on genuinely floating things: dropdowns, toasts, modals, drag overlays.

ACCESSIBILITY — enforced by an automated test in my repo, so treat as non-negotiable:
- Every text color clears 4.5:1 on its surface. Never put #a1a1aa on white.
- Every interactive element has a visible focus ring: 2px accent, 2px offset.
- Touch targets 48px minimum (satisfies both iOS 44pt and Android 48dp).

Reply "ready" and I'll paste the first screenshot.
```

---

## Prompt A — The universal redesign prompt (works on any page)

Paste the screenshot, then:

```
Here is [PAGE NAME] in light mode at 1440px. Redesign it to the system above.

Do this in three passes and show me the result as one frame:

1. HIERARCHY — right now every card has the same visual weight. Decide what the ONE most
   important thing on this page is, make it the hero (oversized tabular number or the primary
   list), and demote everything else. Data first: if a form is taking prime real estate above
   the fold, move it behind a button or into a modal and put the data it produces in its place.

2. STRUCTURE — put it on a real grid. Normalize every gap and padding to 8/16/24/32. Group
   related panels under 12px uppercase section headers. Cap the content column at 1280px.

3. SURFACE — apply the tokens. Neutral zinc cards, module hue only in the header wash and
   badges, accent used sparingly and deliberately (primary action, active state, focus).

Then list, in text below the frame, the specific changes you made and why. Keep it to bullets.
```

That's the one you'll use most. The page-specific prompts below just replace pass 1 with a
sharper instruction, because I know what each page's actual problem is.

---

## Page-specific prompts

Paste the screenshot, then Prompt A, then **add** the matching paragraph below. Or just use these
standalone after Prompt 0.

### Daily Dashboard

```
This is the Daily Dashboard. It answers one question: "where do I stand today?"

Hero: a row of four stat tiles (Tasks Due, Streak, Applications Active, Study Minutes) — large
tabular numbers, small label above, delta-vs-yesterday chip below. The Streak tile gets a lit
flame icon with a soft accent glow; it should be the most alive element on the page.

Below: 2fr/1fr split — "Up next" task list left, stacked mini-panels right (weekly activity bars,
recent wins). Full-width momentum heatmap last, 12 weeks, 5 accent-intensity steps, with a legend.

No forms anywhere on this page.
```

### Tasks / Kanban

```
This is the Tasks board. Keep all four columns and the card content.

Fix: column headers need a name + count pill + add button and a clear rule separating them from
the cards. Cards need a proper footer row (due chip, tag pill, subtask progress "3/5"). Nested
subtasks need an indent plus a connecting rule so the hierarchy is legible at a glance.

Also draw, beside the main frame, three states I can't screenshot: a card mid-drag (lifted,
slight rotation, shadow), the drop placeholder (dashed accent-border outline), and an empty
column (120px max).

Cards stay neutral zinc. Blue appears only in the header wash and overdue chips.
```

### Job Application CRM

```
This is the Job CRM, and it has the worst problem in the app: it opens with empty forms filling
the viewport while the pipeline — the actual content — sits below the fold. A CRM must open on
your pipeline.

Restructure: every form moves into a modal behind an "Add application" button. The funnel board
becomes the page. Above it, a compact row of four stat tiles (Active, Response rate, Avg days to
reply, Offers) and a row of stage filter pills with counts.

Application card: company monogram + name, role, applied-date relative, salary chip, and a "days
in stage" indicator that goes amber past 14 days and danger past 30.

Also draw the "Add application" modal at 480px so I can see where the form went.
```

### Prep Tracker

```
This is the Prep Tracker. Same inversion problem as the CRM: it leads with "Log a prep session"
when the scorecard is what I actually open it for. Swap them — scorecard first, logging behind a
button.

The scorecard row currently breaks: one long label ("ML system design") wraps to two lines and
drops its number out of alignment with the other tiles. Fix that structurally — fixed-height
tiles, label allowed two lines, number always on the same baseline.

Progress bars at 0% currently render as an empty grey track and read as broken. Give a 0% bar a
visible treatment — a faint accent-tinted track with an inset "0%" label, or a dashed rail — so
an untouched checkpoint looks *untouched*, not *broken*.

And: sentences must not be styled as statistics. "No judged attempts" is currently rendered at
value size and weight where a number belongs. Show me the correct empty treatment for a stat
tile with no data.
```

### Finance

```
This is Personal Finance. Emerald hue.

Hero: the Net number, oversized and tabular, emerald if positive and danger if negative, with a
"vs last month" delta chip. Income and Spending are secondary tiles beside it.

Middle: spending-by-category as a horizontal bar list (category name, hue bar, right-aligned
tabular amount, muted percentage) — not a pie chart. Beside it, budget progress meters that
switch their fill to danger when over.

Bottom: the transaction table with a sticky header, hover row highlight, right-aligned tabular
amounts colored danger for outflow and emerald for inflow, and row actions revealed on hover only.
```

### Knowledge Base

```
This is the Knowledge Base, three panes: tree sidebar / note list / note detail.

The three panes currently read as one flat surface. Give them clear separation via border and a
background step, and make the active item in each pane unmistakable (amber-tinted background plus
a left accent bar).

The detail pane needs real reading typography: 24px title, a muted metadata row, then markdown
styled properly — h2, paragraphs at ~72 character measure, lists, blockquote, inline code, and a
fenced code block in Geist Mono on a surface-subtle background.

At the bottom of the detail pane, design the bi-directional links section as two labeled groups,
"Links to" and "Linked from", each a row of compact note chips.
```

### Reader

```
This is the PDF Reader. Teal hue. Three zones: page thumbnails strip, PDF canvas, annotations
panel.

The chrome should recede completely so the document is the only bright thing on screen. Toolbar
gets page N of M, zoom controls, and a 5-swatch highlight color picker (amber, teal, rose,
violet, emerald at ~35% alpha).

On the canvas, show an active text selection with a small floating popover offering the 5 colors
plus a "Note" action.

Annotation cards: color swatch, quoted text truncated at 3 lines, optional note in italic muted,
page number, delete on hover. Include the empty state.

Important for the dark variant: the PDF page itself stays paper-white, only the surrounding
chrome goes dark.
```

### Design Drills / LeetCode Tracker

```
This is a practice tracker with a code pad and rendered markdown solutions.

The code pad needs to read as a real editor: Geist Mono, a distinct surface-subtle background, a
line-number gutter, and syntax highlighting that uses the module hues rather than a stock theme
(keywords accent, strings emerald, numbers amber, comments muted).

The solution panel needs editorial typography — this is long-form reading inside a dense app.
Constrain the measure, increase leading, and set fenced code blocks apart clearly from prose.

Difficulty and status badges use tinted-surface + matching-border + hue-text pills, not solid fills.
```

### Home / orbital hub — **the exempt screen, read the override first**

Figma AI will try to delete the orbit as "decorative". It isn't — it's the navigation. Lead with
this override paragraph, then the brief.

```
OVERRIDE — the "not decorative" rule in my system prompt does NOT apply to this screen, and I
need you to actively resist your instinct to simplify it.

The orbit is not an ornament placed on a home screen. The orbit IS the navigation — it is the
only way into the ten modules from here, and it encodes real information:
- Each node is a module. Tapping it navigates. It is a button.
- Node COLOR is the module's hue — the same hue that page's header carries, so the orbit teaches
  the color system every time it's used.
- Node DEPTH and SIZE encode ring membership: two elliptical rings, near-side nodes larger and in
  front of the center hub, far-side nodes smaller, dimmer and occluded behind it. Depth is how
  ten targets fit without a grid.
- The center hub's pulse encodes liveness.
- Hovering or focusing a node surfaces that module's live stats.

So: do NOT replace it with a grid of cards. Do NOT flatten it to a static ring of evenly spaced
circles. Do NOT "clean it up" into a list with an illustration beside it. If you produce a card
grid I will have to throw the frame away.

This screen is allowed an expressive budget the rest of the app is not: depth, glow, motion,
scale, and a dark field. Spend it deliberately.

CONSTRAINTS THE BUDGET DOES NOT BUY — expressive is not the same as noisy:
- Color comes ONLY from the ten module hues and the accent. No new palette.
- No starfields, no nebulae, no lens flares, no neon outer-glow, no glassmorphism panels.
- The background is a flat deep field (#09090b), optionally with one very low-alpha radial
  vignette. Nothing more.
- Type stays on the system scale and stays perfectly legible — no tracking games, no all-caps
  headline treatment.
- Every node must be tappable at 48px minimum and reachable by keyboard with a visible focus ring.
The test: it should read as an *instrument*, like a watch face or a control surface. Not as a
screensaver.
```

Then the brief itself:

```
Design the MyHub home screen — an orbital navigator.

A center hub carrying the app mark. THREE cluster nodes orbit it on ONE heavily flattened ellipse
— roughly 2.8:1 wide-to-tall, which is what makes it read as a ring receding into the screen
rather than a flat wheel seen head-on. The clusters are Core Tools, Career and Money; each holds
several modules.

Depth is the whole illusion: a node on the near (bottom) arc renders larger, brighter and stacked
IN FRONT of the hub; a node on the far (top) arc renders smaller, dimmer and passes BEHIND it.
Opacity, scale and stacking order all move together — if a node dims without also shrinking and
passing behind, the illusion breaks. Node labels fade out over the far third of the arc, so a name
tag is never sliced in half by the hub.

Each node is a sphere in its cluster's hue — a specular highlight up-left, hue bouncing back from
down-right — not a flat disc.

Focused / hovered node: springs slightly larger, its hue glow intensifies, and an info panel
crossfades in at the bottom-right showing the module name, a one-line description and 2-3 live
stats (e.g. Tasks — "7 due today, 3 overdue").

Idle state, nothing focused: the panel shows today's date, the current streak, and the single
most urgent next action across all modules.

Dark mode is primary — this screen should look best on #09090b. Give me the light variant after.

Show me three frames: the idle state, a node focused, and the keyboard-focus state with the ring
visible on a node.
```

**Device follow-up**, same conversation — ten orbiting nodes at 402px is the genuinely hard case:

```
Now adapt the orbital home to my two devices. The override still applies — the orbit survives on
both, it does not become a grid.

Galaxy Tab S7, 1280 × 800 landscape: this is the orbit's best canvas. Widen the ellipses to use
the landscape ratio, and move the info panel to a fixed right-hand column rather than a floating
overlay, since there's room.

iPhone 16 Pro, 402 × 874 portrait: ten nodes cannot orbit legibly in 402px while staying 48px
tappable. Solve it, don't abandon it. Options to consider — pick one and justify it:
  (a) a single ring of ten, larger radius, with the ring extending past the screen edges so it
      reads as a portion of something bigger, and vertical drag rotates it;
  (b) two rings of five, the inner ring showing the five most-used modules;
  (c) a fixed near-arc of five with the other five parked as a dimmed far cluster you swipe to.
The info panel becomes a bottom sheet at a peek detent, expanding on tap.
There is no hover on touch — say explicitly what replaces it. Tap-to-preview-then-tap-to-open,
or long-press-to-preview, are both acceptable; choose and show both steps as frames.
```

---

## Device work — iPhone 16 Pro + Galaxy Tab S7

MyHub is installed to the home screen as a **PWA**, so there is no browser chrome — you get the
full frame, and safe-area insets are yours to respect.

### Frame sizes (use these exact numbers in Figma)

| Device                   | Frame (CSS px / dp) | Safe areas                                                    |
| ------------------------ | ------------------- | ------------------------------------------------------------- |
| iPhone 16 Pro, portrait  | **402 × 874**       | top 59 (Dynamic Island), bottom 34 (home indicator), sides 0  |
| iPhone 16 Pro, landscape | 874 × 402           | top 0, bottom 21, **sides 59** — the Island moves to the left |
| Galaxy Tab S7, landscape | **1280 × 800**      | bottom 24 (gesture bar), sides 0                              |
| Galaxy Tab S7, portrait  | 800 × 1280          | top 24 (status bar), bottom 24                                |

Device corner radius: iPhone ~55px, Tab S7 ~12px. Ask Figma to draw content inset from the
rounded corners — a table flush to a 55px radius clips its own first cell.

Tab S7 landscape is your primary tablet frame. iPhone portrait is your primary phone frame.

### Prompt D0 — Append this to Prompt 0 for any device work

```
ADDITIONAL — this is a PWA installed to the home screen, so there is no browser chrome and I
control the full frame. Design to these exact frames:

- iPhone 16 Pro portrait: 402 × 874. Safe area insets: 59 top (Dynamic Island), 34 bottom (home
  indicator). Device corner radius 55px — inset content so nothing clips.
- Galaxy Tab S7 landscape: 1280 × 800. Safe area: 24 bottom (gesture bar). Corner radius 12px.

TOUCH RULES, both devices:
- Minimum target 48 × 48, with at least 8px between adjacent targets.
- No hover-only affordances. Anything currently revealed on hover (row action kebabs, delete
  buttons on cards) needs a permanent, tap, or swipe equivalent — say which you chose.
- Primary actions belong in the bottom third of a phone screen, within thumb reach. Destructive
  actions do not.
- Nothing interactive within 34px of the bottom on iPhone — that's the home-indicator swipe zone.
- Scroll is vertical. Horizontal scroll is allowed only for a deliberate, obviously-swipeable
  strip (a stage switcher, a filter row), never for a table or a whole layout.

Draw the device frame with its rounded corners, the status bar / Dynamic Island, and the home
indicator or gesture bar, so I can see what the safe areas actually cost me.
```

### Prompt D1 — Tab S7 (1280 × 800 landscape), any page

Paste the desktop screenshot:

```
Here is [PAGE] on desktop at 1440px. Adapt it to a Galaxy Tab S7 in landscape: 1280 × 800,
installed as a PWA, touch-only, no mouse.

At 1280 wide you keep the desktop layout's structure — this is not a phone. What changes:

1. HEIGHT is the constraint now, not width. 800px minus a 56px top bar leaves ~744px. Decide
   what has to be visible without scrolling and compress the rest. Reduce panel padding from 24
   to 16 where it buys a row of real data.
2. The 240px nav rail becomes a 72px icon rail — icons plus 11px labels beneath, active item
   gets the hue tint and left accent bar. It expands to 240px on tap of a menu toggle, as an
   overlay, not a push.
3. Every hover-only control becomes visible or moves into a tap-target. Table row actions become
   a persistent trailing kebab column.
4. All controls to 48px minimum height. Inputs, selects and buttons grow; type sizes do not.

Show me the frame with the device bezel, and note in text which elements you had to cut from the
first screenful.
```

### Prompt D2 — iPhone 16 Pro (402 × 874), any page

```
Here is [PAGE] on desktop. Adapt it to an iPhone 16 Pro, 402 × 874, installed as a PWA. Safe
areas: 59 top, 34 bottom.

Structure:
- Sticky top bar below the 59px inset: page title left, one primary action right, 56px tall. The
  nav rail does NOT stack above the content — it becomes a bottom tab bar with the 5 most-used
  modules, or a Menu sheet if 5 isn't enough. Say which you chose and why.
- The first screenful must be content, not navigation.
- Stat tiles go 2-up in a grid, never 1-up stacked — 1-up wastes the whole screen on four numbers.
- Tables become stacked cards: primary value as the card title, the rest as label:value rows.
  Numbers stay tabular and right-aligned within the card.
- A Kanban board becomes one column with a horizontal, swipeable stage switcher above it, showing
  counts per stage.
- Multi-pane layouts (tree / list / detail) become a drill-down stack with a back affordance.
- Any form becomes a bottom sheet, not a full-page route.

Draw the frame with the Dynamic Island and home indicator visible so I can see the real usable
height.
```

---

## The Reader on touch — the one that actually needs designing

Everything else is a responsive adaptation. The Reader is a genuine redesign, because
select-to-highlight is a **mouse-drag interaction that does not exist on touch**, and it's the
entire point of the module.

Run these three in one conversation, in order.

### Prompt R1 — The selection interaction (do this FIRST, before layout)

```
Before we lay anything out, design the core interaction, because it's the hard part.

MyHub's Reader lets you select text in a PDF and highlight it in one of five colors. On desktop
that's click-drag. On touch there is no drag-to-select, so design the touch equivalent as a
storyboard of 5 frames, iPhone 16 Pro portrait, showing a paragraph of PDF body text:

Frame 1 — Idle. Text at a comfortable reading size, no chrome in the way.
Frame 2 — Long-press has landed. One word is selected, with drag handles at each end. Design the
  handles: they must be grabbable at 48px even though they look small, and they must not sit
  under the user's fingertip while dragging.
Frame 3 — The user has dragged a handle to extend the selection across two lines. Show what the
  partial-line selection geometry looks like — this is the part that has to survive being stored
  as coordinates, so the rectangles need to be honest, not idealized.
Frame 4 — The action popover. Floating above the selection: 5 color swatches (amber, teal, rose,
  violet, emerald at ~35% alpha) plus a "Note" action and a copy action. Show it correctly
  repositioned when the selection is near the top of the screen — it must flip below rather than
  hide under the Dynamic Island.
Frame 5 — Committed. The highlight is applied, the selection cleared, and a brief confirmation
  that doesn't block reading.

Then, in text, answer: how does the user distinguish a long-press-to-select from a pan-to-scroll
from a pinch-to-zoom? Propose the gesture model and name the trade-off you accepted.
```

That last question is the one worth reading carefully — the gesture conflict between
select / scroll / pinch is what will actually bite during implementation.

### Prompt R2 — Reader layout, iPhone 16 Pro

```
Now the phone layout. iPhone 16 Pro, 402 × 874, PWA, safe areas 59 top / 34 bottom.

The PDF page is the product. Everything else recedes or hides.

- Immersive by default: the toolbar auto-hides on scroll down and returns on scroll up or on a
  single tap. Show BOTH states as two frames side by side, so I can see the maximum reading area.
- Toolbar (when visible), below the 59px inset: back, document title truncated, page "12 / 340"
  as a tappable control that opens a page-jump scrubber, and an overflow menu.
- The thumbnails strip does not fit. Replace it with a bottom-edge page scrubber that appears
  during scroll — a thin track with a page-number bubble — plus a full thumbnail grid behind the
  page control.
- The annotations panel does not fit either. It becomes a bottom sheet with three detents:
  a 34px peek handle, a half sheet (~45%) listing annotation cards, and a full sheet. Draw all
  three detents.
- Annotation card in the sheet: color swatch, quoted text at 2 lines max, optional note, page
  number, and a swipe-to-delete revealed action — no hover.
- Empty state for the sheet: "No highlights yet — press and hold on any text to start." This copy
  matters, because the gesture is not discoverable.

Dark mode variant too: the PDF page stays paper-white, all chrome goes to #09090b / #18181b.
```

### Prompt R3 — Reader layout, Tab S7

```
Now the tablet. Galaxy Tab S7 landscape, 1280 × 800, PWA, 24px bottom gesture bar.

At 1280 × 800 the three-zone layout survives, but 800px of height is tight for a portrait A4
page. Design it as:

- Left: a 96px thumbnail rail, current page outlined in teal, scrollable, collapsible to 0 with
  a toggle.
- Center: the PDF, fit-to-height by default with a fit-to-width toggle. Show a two-page spread
  option as an alternative frame, since 1280 wide can hold two portrait pages side by side —
  tell me whether it's actually readable at that size or whether it's a trap.
- Right: a 320px persistent annotations panel — on tablet it does NOT need to be a sheet. Same
  card design as the phone, but with the delete action persistent rather than swipe-revealed.
- Toolbar across the top, 56px, with the same controls as the phone plus zoom in/out/fit and the
  5-swatch color picker exposed permanently rather than only in the selection popover.

Then show a second frame in PORTRAIT, 800 × 1280 — the natural reading orientation. Here the
annotations panel collapses to a bottom sheet like the phone, and the thumbnail rail hides.

Use the same selection interaction from the first prompt, scaled up. Note anything about the
handles or popover that has to change at tablet size.
```

---

## Placeholder pages — what to add and why

These are dummy pages, so the only real question is **what they buy you as design exercises**.
Every existing MyHub page is text-and-numbers on neutral cards. Pick placeholders that stress
patterns the system has never had to handle — then the design work pays for itself when a real
module needs them.

### First, the hue constraint — and extending the kit

Nine of the ten module hues are assigned; **rose is the only one free.** So the kit needs
extending. Below are six candidates, all **measured** (not estimated) against WCAG AA — light text
roles on `#ffffff`, dark text roles on both `#18181b` and `#27272a`:

| Hue        | Light text | on #fff | Dark text | on #18181b / #27272a |
| ---------- | ---------- | ------- | --------- | -------------------- |
| **sky**    | `#0369a1`  | 5.93 ✓  | `#38bdf8` | 8.27 / 6.95 ✓        |
| **purple** | `#7e22ce`  | 6.98 ✓  | `#c084fc` | 6.70 / 5.64 ✓        |
| **pink**   | `#be185d`  | 6.04 ✓  | `#f472b6` | 6.69 / 5.62 ✓        |
| **yellow** | `#854d0e`  | 6.85 ✓  | `#facc15` | 11.57 / 9.73 ✓       |
| **slate**  | `#475569`  | 7.58 ✓  | `#94a3b8` | 6.91 / 5.81 ✓        |
| **stone**  | `#57534e`  | 7.63 ✓  | `#a8a29e` | 7.02 / 5.91 ✓        |

Surface and border roles, following the existing pattern (light = 50/200, dark = a deep tint so a
pill doesn't glow, plus the 700/800 border):

| Hue    | Light surface / border | Dark surface / border |
| ------ | ---------------------- | --------------------- |
| sky    | `#f0f9ff` / `#bae6fd`  | `#04212e` / `#075985` |
| purple | `#faf5ff` / `#e9d5ff`  | `#1d0b30` / `#6b21a8` |
| pink   | `#fdf2f8` / `#fbcfe8`  | `#2b0a18` / `#9d174d` |
| yellow | `#fefce8` / `#fef08a`  | `#221a04` / `#854d0e` |
| slate  | `#f8fafc` / `#e2e8f0`  | `#17202b` / `#334155` |
| stone  | `#fafaf9` / `#e7e5e4`  | `#221f1d` / `#44403c` |

**But contrast passing is not the same as telling them apart.** Sorted by hue angle, the wheel is
already crowded, and the new entries (marked +) mostly land in the gaps _between_ existing hues:

```
 17° orange    26° amber   [+32° yellow]  [+33° stone]   86° lime
163° emerald  175° teal    193° cyan      [+201° sky]   [+215° slate]
224° blue     243° indigo(accent)  263° violet  [+272° purple]
295° fuchsia  [+335° pink]  345° rose
```

Read the deltas: **purple sits 9° from violet, pink 10° from rose, sky 8° from cyan, yellow 6°
from amber and 1° from stone.** At badge size, in a 12px pill, those pairs are not reliably
distinguishable — especially for anyone with a color vision deficiency.

Two structural facts fall out of that table, both worth knowing before you spend hues:

1. **The 86°→163° gap (lime to emerald) is the only real void in the wheel** — 77° of open green.
   It's unused because `--success` `#15803d` already owns green _semantically_. A green module hue
   would read as "this thing is OK" wherever it appears next to status.
2. **Light-mode AA is what crowds the warm end.** Yellow and lime have to darken past 4.5:1 on
   white, which browns them — that's why `+yellow` lands at 32° and collides with `+stone` at 33°.
   You cannot have a bright, canonical yellow _and_ AA in light mode. Pick one.

**So: take slate and stone first.** They read as achromatic rather than as a competing hue, so
they add capacity without crowding anyone — a neutral-toned module is a real category ("archive",
"reference", "misc"). Take sky, purple and pink only when you have a module that needs one, and
accept they're siblings of cyan/violet/rose rather than distinct. Skip yellow.

**And the mitigation that actually matters:** past roughly eight categories, hue stops being a
reliable channel on its own. Every module already has a distinct icon — make the icon load-bearing
and treat the hue as reinforcement, never as the sole carrier of meaning. A badge that says
"Movies" with a film icon is legible whether or not you can tell its rose from the next one's pink.

Applied to the placeholder pages: **one new module, `Library`, owns rose.** Movies, Books and the
rest of the family are _collections inside it_, distinguished by icon and a neutral collection pill
— not by color. That's also just better product design; "things I consume" is one mental space, not
five. Spend the new hues on genuinely new modules, not on collections.

### The shortlist, ranked by what each one stresses

| Page                       | Archetype it introduces   | Why it's worth designing                                                                                                                              |
| -------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Movies**                 | Image-first grid          | The app has **zero** images today. Poster grids force aspect-ratio cards, hover/tap overlays, and a loading story for images. Highest learning value. |
| **Books**                  | Grid + progress + rating  | Same grid, plus per-item progress and a 5-star control — and it pairs naturally with the Reader you already built.                                    |
| **Blog index**             | Editorial list            | Long-form entry points: title, excerpt, date, tag, read-time. Different rhythm from a data table.                                                     |
| **Blog post**              | Long-form reading view    | Real typography at a constrained measure, pull quotes, inline images, code. Reuses the Knowledge Base markdown styling and pressure-tests it.         |
| **Watchlist/queue**        | Ordered, reorderable list | Drag-to-reorder outside a Kanban board, plus "up next" emphasis.                                                                                      |
| **Stats / Year in review** | Charts + big numbers      | A dedicated data-viz surface — bar, line, heatmap, distribution — which the app currently only does in fragments.                                     |
| **Subscriptions**          | Recurring cost table      | Renewal dates, monthly-vs-annual toggle, and a natural link to Finance.                                                                               |
| **Places / travel log**    | Map + timeline            | The only genuinely new _layout_ on the list. Skip unless you want a map surface.                                                                      |

If you want a tight set: **Movies, Books, Blog index, Blog post, Stats.** Those five cover
image-grid, editorial-list, long-form, and charts — the four archetypes the app is missing.

### Prompt P1 — Library shell (do this first, it defines the module)

```
New module for MyHub: "Library" — things I read and watch. It owns the rose hue (#be123c light /
#fb7185 dark). Movies and Books are COLLECTIONS INSIDE this one module, not separate modules —
they share the rose hue and are distinguished by icon and a neutral collection pill, never by
their own color.

Design the Library shell at 1440px, light mode:
- Page header with the rose wash, title "Library", and a collection switcher: All / Movies /
  Books / Articles, as a segmented control with counts.
- A filter row: status (Want / In progress / Finished), rating, year, and a sort control.
- A view toggle: Grid / List.
- Four stat tiles above the content: Finished this year, In progress, Hours logged, Avg rating.

Show the empty state for a collection too. This is placeholder content, so invent plausible
realistic entries — never lorem ipsum.
```

### Prompt P2 — Movies + Books grid

```
Now the Library grid view, at 1440px.

This is the first image-first surface in an app that has been entirely text and numbers, so be
careful: the cards must still feel like MyHub, not like a streaming service.

- Movie card: 2:3 poster, title, year, and a rating. Books: 2:3 cover, title, author, plus a thin
  progress bar for in-progress reads.
- Card chrome stays neutral zinc. Rose appears only in the header wash and in the status pill.
- Show the hover/tap state: a subtle scale, and an overlay with quick actions (mark finished,
  rate, open detail).
- Show three loading skeletons and one broken-image fallback — a neutral surface with the title
  set in type. Posters fail to load and the grid must not collapse.
- Grid: 6 columns at 1440, 4 on the Tab S7 at 1280, 2 on the iPhone at 402.

For placeholder art, use abstract generated cover art or solid tinted panels with the title set
in type — do NOT use real film posters or book jackets, I don't want copyrighted artwork sitting
in my design file.

Also give me the List view of the same data: a dense table with a 32px thumbnail, title, creator,
status pill, rating, and date finished.
```

### Prompt P3 — Blog index + post

```
Two frames for a Blog section in MyHub — personal writing, mostly reviews of what's in my Library.

Frame 1, blog index at 1440px: a single-column editorial list, not cards in a grid. Each entry:
title at 20px, a 2-line excerpt in body color, then a metadata row with date, read time, and one
tag pill. A generous rule between entries instead of card borders. The most recent post gets a
larger treatment — 30px title, 3-line excerpt, optional thumbnail — so the page has one clear
entry point. A tag filter row sits at the top.

Frame 2, the post detail: this is the app's long-form reading surface, so typography is the whole
design. Title at 30px tracking-tight, a metadata line, then body at 16px with relaxed leading,
constrained to a ~68 character measure and centered in the column even though the app's other
pages are full-bleed. Style h2, h3, paragraph, blockquote/pull quote, bulleted list, inline code,
a fenced code block, an inline image with a caption, and a horizontal rule. End with a "Related"
row of three compact links.

Reuse the markdown styling from my Knowledge Base so the two reading surfaces feel like the same
app. Light and dark.
```

### Prompt P4 — Stats / Year in review

```
A "Year in review" page for the Library — the app's first dedicated data-visualization surface.

- One hero statistic, oversized tabular: films watched this year, with a delta vs last year.
- A 12-month bar chart of items finished per month.
- A rating distribution as a horizontal bar list, 1-5 stars.
- A genre breakdown using the module hue kit — this is the one place multiple hues legitimately
  appear together, since here they encode categories rather than modules.
- A 52-week activity heatmap in rose, five intensity steps, with a legend.

Chart rules: no pie charts, no 3D, no drop shadows on bars. Gridlines in border color at low
weight, axis labels in muted, values tabular. Every chart needs a visible empty state and must be
readable in both themes.
```

### A note on placeholder content

Tell Figma explicitly to invent **plausible** data — real-sounding film titles, author names,
dates, ratings — rather than lorem ipsum. A page filled with "Lorem ipsum dolor" hides exactly the
problems you're designing to find: how long titles wrap, how a 3-line excerpt sits against a
2-line one, what a 4.5 rating does to alignment. And keep real cover art out of the file.

---

## Prompt D3 — Cross-device consistency check

Once you have phone and tablet frames for a page:

```
Put the desktop, Tab S7 landscape and iPhone 16 Pro versions of [PAGE] side by side on one frame.

Check and report: does the same element have the same visual weight and the same color role in
all three? Is anything reachable on one device and genuinely missing on another? Did any type
size drift off the scale (48/30/20/16/14/13/12)? Did any spacing drift off 8/16/24/32?

List every inconsistency you find rather than silently fixing it.
```

---

## Prompt S — States pass (run once, reusable across pages)

```
Using the system, design a states sheet I can apply everywhere:

1. Loading skeletons — for a card, a stat tile, and three table rows.
2. Empty states — max 120px tall: icon, one line of copy, one primary action.
3. Error state — a danger-tinted inline notice with a Retry button. Copy must be generic
   ("Something went wrong, please try again later"), never a technical error message.
4. Focus rings on every interactive type: button, input, select, card, table row, nav item.
5. Disabled buttons that read as *unavailable*, not as dead grey slabs — reduced opacity plus a
   not-allowed affordance, still legible at 4.5:1.
```

---

## Prompt X — The extraction prompt (run when you like a design)

This is the one that makes the whole exercise implementable:

```
For this design, output two things as text:

1. A token table: every color you used, mapped to its role name from my system (surface, border,
   muted, accent, hue-blue, ...) with its hex, for both themes.
2. A "off-system" list: anything you used that was NOT in the system I gave you — new colors, new
   spacing values, new radii, new type sizes — and why you needed it.
```

The off-system list is the valuable half. It tells you exactly which new CSS variables the Figma
design would force before anyone writes a line of code.

---

## Getting it back into the app

The Figma frames are the spec, not the implementation. Per the standing split: new tokens land in
`app/globals.css` and must keep `src/lib/palette.test.ts` (AA contrast) and
`src/lib/density.test.ts` (the 8/16/24/32 ramp) green; the component work goes to Codex against
those tokens.
