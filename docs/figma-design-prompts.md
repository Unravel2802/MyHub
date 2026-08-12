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
Raycast. Crisp, dense, high-contrast, quiet. Precision, not personality. Nothing decorative.
No hero sections, no marketing gradients, no illustrations, no drop-shadowed floating cards.

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
  (light hex / dark hex)

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
- Touch targets 40px minimum.

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

### Home / orbital hub

```
This is the home screen — an orbital navigator, not a dashboard. Keep the concept, improve it.

A center hub with the app mark and slow pulse rings. Ten module nodes orbiting on two elliptical
rings at different depths: far-side nodes smaller, dimmer, behind the hub; near-side nodes larger
and in front. Each node is a circular icon in its module hue.

Hover state: the node springs larger, its hue glow intensifies, and an info panel crossfades in
at the bottom-right with the module name, a one-line description and 2-3 live stats. Idle state:
today's date, current streak, and the single next action across all modules.

Dark mode is the primary here. Deep space but restrained — no starfields, no neon. The module
hues are the only color on screen.
```

---

## Prompt R — Responsive pass

Paste the 390px mobile screenshot:

```
This is the same page at 390px. Redesign it for mobile.

Rules: the 240px nav rail must NOT stack above the content — it collapses into a Menu button in a
sticky top bar, so the first screenful is content, not a list of nav links. Stat tiles go 2-up,
never 1-up. Tables become stacked cards with label:value pairs. A Kanban board becomes one column
with a horizontal stage switcher above it. Touch targets 40px minimum.
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
