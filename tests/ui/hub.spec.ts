import { expect, test } from "./fixtures";
import { FakeTaskDb, mockSupabaseTasks, row } from "./supabaseTasksMock";

// The orbit nodes reposition every frame via requestAnimationFrame, so
// Playwright's `.click()`/`.hover()` — which wait for the target's bounding
// box to be stable before acting — never resolve against them (a real
// mouse settles the scene by entering the canvas first; a synthetic click
// teleports straight to a coordinate that's already moved on). Driving the
// interaction via focus + Enter sidesteps that entirely, and is exactly how
// a keyboard user activates a node for real — see OrbitalHub.tsx's onFocus.
async function activateNode(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByRole("button", { name }).focus();
  await page.keyboard.press("Enter");
}

test("activating an orbit node expands its moons as real module links", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  // The Momentum rail is fixed — the reference never swaps it out, so it's
  // visible before, during, and after an expansion.
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();

  await activateNode(page, "Show Career's modules");
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();
  await expect(page.locator('a[data-orbit-moon="career"]')).toHaveCount(9);
  await expect(
    page.getByRole("link", { name: "Dashboard" }).last(),
  ).toHaveAttribute("href", "/dashboard");

  // Escape collapses — the explicit close action.
  await page.keyboard.press("Escape");
  await expect(page.locator("a[data-orbit-moon]")).toHaveCount(0);

  await activateNode(page, "Show Money's modules");
  await expect(
    page.getByRole("link", { name: "Finances" }).last(),
  ).toHaveAttribute("href", "/finance");

  // Activating the already-expanded node again toggles it closed: the
  // accessible name and pressed state flip back. Not located by accessible
  // name — that name itself is what's about to change (Show -> Hide).
  // The node's visible label lives in the paint-only SVG now, so locate by
  // the aria-label ("Show/Hide Money's modules" — both contain "Money").
  const moneyNode = page.locator('button.orbit-node[aria-label*="Money"]');
  await expect(moneyNode).toHaveAttribute("aria-pressed", "true");
  await moneyNode.focus();
  await page.keyboard.press("Enter");
  await expect(moneyNode).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("a[data-orbit-moon]")).toHaveCount(0);

  await activateNode(page, "Show Core Tools' modules");
  await expect(
    page.getByRole("link", { name: "Task Engine" }).last(),
  ).toHaveAttribute("href", "/tasks");
  await expect(
    page.getByRole("link", { name: "Knowledge Base" }).last(),
  ).toHaveAttribute("href", "/notes");
});

// The test above drives nodes with `.focus()`, which is the right tool for
// asserting what activation DOES — but it proves nothing about reachability.
// `.focus()` succeeds on an element the Tab sequence can never land on: a
// `tabindex="-1"` button, or a node rebuilt as a decorative SVG wrapper with a
// focus handler bolted on. So the one regression that would actually strand a
// keyboard user — the orbit ceasing to be tabbable — passes that test happily.
//
// This matters now specifically: the Figma Make port (docs/handoff/dashboard-
// redesign-port.md §3.4) rebuilds these nodes as reticles, and the reference
// implementation it ports FROM uses `<g onClick>` with no keyboard path at all.
// app/page.tsx deleted the duplicate card grid precisely because the orbit
// became the accessible route to every module; if the rebuild regresses that,
// there is no second way in.
test("every orbit node is reachable by Tab, and Tab continues into its panel", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  const nodes = page.locator("button.orbit-node");
  const expected = await nodes.count();
  expect(expected).toBeGreaterThan(0);

  // Walk the real Tab sequence from the top of the document. No `.focus()`
  // anywhere in this test — that's the whole point.
  const reached = new Set<string>();
  for (let press = 0; press < 60 && reached.size < expected; press++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return null;
      return {
        isNode: el.classList.contains("orbit-node"),
        label: el.getAttribute("aria-label"),
      };
    });
    if (focused?.isNode && focused.label) reached.add(focused.label);
  }

  expect(
    reached.size,
    `Tab reached ${reached.size} of ${expected} orbit nodes: ${[...reached].join(", ")}`,
  ).toBe(expected);

  // Focus is on an orbit node. Activating it must expand its moons, and Tab
  // must then continue INTO those moon links — they're interleaved in DOM
  // order right after their planet's button, so the module links are the
  // very next stops in the sequence. This is the second half of the claim in
  // app/page.tsx's comment, and the half the deleted WorkspacePanel used to
  // provide.
  await page.keyboard.press("Enter");
  await expect(page.locator("a[data-orbit-moon]").first()).toBeAttached();

  await page.keyboard.press("Tab");
  const landedOnMoon = await page.evaluate(() => {
    const el = document.activeElement;
    return (
      el instanceof HTMLAnchorElement && el.hasAttribute("data-orbit-moon")
    );
  });
  expect(
    landedOnMoon,
    "Tab after activating a node should reach its moon module links",
  ).toBe(true);
});

// The prototype has no reduced-motion handling at all; the shipped loop runs
// exactly one placement pass and then returns. That single pass is load-bearing
// — drop it while porting and every node stacks at the canvas origin for anyone
// who asks their OS to stop animations, which no other assertion would notice.
test("reduced motion still places the orbit nodes, not stacked at the origin", async ({
  page,
}) => {
  // `page.emulateMedia` rather than `test.use({ reducedMotion })`: our `test`
  // is the extended fixture from ./fixtures, and its type params don't surface
  // Playwright's own options to `test.use`.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  const positions = await page
    .locator("button.orbit-node")
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${(el as HTMLElement).style.left}|${(el as HTMLElement).style.top}`,
      ),
    );

  expect(positions.length).toBeGreaterThan(0);
  for (const position of positions) {
    expect(position, "a node was never placed by the paint pass").not.toBe("|");
  }
  // Distinct positions, i.e. spread around the ellipse rather than all landing
  // on the same default.
  expect(new Set(positions).size).toBe(positions.length);

  // Moons mount only on expansion, which under reduced motion happens AFTER
  // the single placement pass — a dedicated repaint on expand must place
  // them rather than leaving a stack at the canvas origin.
  await activateNode(page, "Show Career's modules");
  const moonPositions = await page
    .locator('a[data-orbit-moon="career"]')
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${(el as HTMLElement).style.left}|${(el as HTMLElement).style.top}`,
      ),
    );
  expect(moonPositions.length).toBeGreaterThan(0);
  expect(new Set(moonPositions).size).toBe(moonPositions.length);
  for (const position of moonPositions) expect(position).not.toBe("|");
});

// A "literal match to the reference" pass (2026-08-12) removed the pause-on-
// hover settling this test pins, on the reasoning that the reference's own
// motion never stops. That reasoning doesn't transfer: the reference detects
// hover via a per-mousemove distance check against each node's live
// position, so a mouse that holds still keeps reading as "hovering" even
// after the target has drifted, because nothing re-evaluates the hit test
// until the next real mousemove. Our nodes are real <button>s (required for
// keyboard access — see the Tab-reachability test above), which use native
// :hover, continuously recomputed against live layout by the browser itself.
// Combine that with a target that never stops moving and hover physically
// cannot hold — it registers for a frame, then the box slides out from under
// a stationary cursor. This regressed silently because no test asserted
// stillness; it does now.
test("the scene settles to a stop while a node is focused, and resumes after", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  const careerNode = page.getByRole("button", {
    name: "Show Career's modules",
  });

  // Polls position every 150ms rather than assuming a fixed wall-clock wait
  // converges the ease: the paint loop clamps each frame's own elapsed-time
  // at 50ms (a deliberate guard against one huge jump after the tab was
  // backgrounded), so under CPU contention from parallel test workers, real
  // frames can arrive sparser than expected and the ease covers LESS
  // wall-clock ground per second than it would running alone. A fixed wait
  // flaked under `npx playwright test` (4 workers) while passing every time
  // in isolation — this polls for the actual behaviour instead of guessing
  // how long it takes to appear.
  async function samplePositions(count: number, intervalMs: number) {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const box = await careerNode.boundingBox();
      expect(box, "orbit node has no layout box").not.toBeNull();
      points.push({ x: box!.x, y: box!.y });
      if (i < count - 1) await page.waitForTimeout(intervalMs);
    }
    return points;
  }

  await careerNode.focus();
  const whileFocused = await samplePositions(8, 250); // ~1.75s
  // Only the TAIL needs to be still — the first couple of samples are the
  // ease-in transient itself, not a failure to settle.
  const tail = whileFocused.slice(-4);
  let maxTailDrift = 0;
  for (let i = 1; i < tail.length; i++) {
    maxTailDrift = Math.max(
      maxTailDrift,
      Math.hypot(tail[i].x - tail[i - 1].x, tail[i].y - tail[i - 1].y),
    );
  }
  expect(
    maxTailDrift,
    "a focused node kept moving instead of settling — hover/focus can't hold on a moving target",
  ).toBeLessThan(3);

  // Release focus and confirm motion actually resumes rather than staying
  // stuck paused. blur() directly rather than focusing some other element,
  // so this can't accidentally re-settle on a different node instead.
  await careerNode.evaluate((el) => (el as HTMLElement).blur());
  const afterRelease = await samplePositions(8, 250);
  const first = afterRelease[0];
  const maxDriftFromFirst = Math.max(
    ...afterRelease
      .slice(1)
      .map((p) => Math.hypot(p.x - first.x, p.y - first.y)),
  );
  expect(
    maxDriftFromFirst,
    "the scene never resumed after focus/hover was released",
  ).toBeGreaterThan(3);
});

// The "inner guide ring" this test used to also check doesn't exist any
// more: it was one of several embellishments layered on top of the Figma
// reference (docs/handoff/dashboard-redesign-port.md), never part of the
// design being ported, and was removed along with the ellipse-perspective
// and depth-simulation system in the same pass. Only the reference's own
// single dashed orbit ring remains, marked data-orbit-ring="main".
test("the orbit ring stays a neutral guide, and cluster labels never fade", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  const mainRing = page.locator('[data-orbit-ring="main"]');
  await expect(mainRing).toHaveAttribute("stroke", "var(--border)");
  await expect(mainRing).toHaveAttribute("stroke-width", "0.75");
  // "4 7" is the reference's own dash pattern; the port's "1.5 13" was a
  // quieter re-tune that also read as a different ring.
  await expect(mainRing).toHaveAttribute("stroke-dasharray", "4 7");
  await expect(page.locator("#ring-glow")).toHaveCount(0);
  await expect(page.locator('[data-orbit-ring="inner"]')).toHaveCount(0);

  // Cluster labels are always visible per the reference's own spec —
  // "Planet labels always visible, moon labels visible on hover only" —
  // there is no per-frame fade left to sample, so this checks the resting
  // state stays put across a few laps rather than polling for a dip.
  const labels = page.locator("[data-orbit-label]");
  const expected = await labels.count();
  expect(expected).toBeGreaterThan(0);

  for (const wait of [0, 1500, 3500]) {
    if (wait > 0) await page.waitForTimeout(wait);
    for (const label of await labels.all()) {
      const key = await label.getAttribute("data-orbit-label");
      const opacity = await label.evaluate(
        (el) => getComputedStyle(el).opacity,
      );
      expect(opacity, `${key} label was not fully opaque`).toBe("1");
    }
  }
});

test("checking a focus card marks the task done", async ({ page }) => {
  const db = new FakeTaskDb([
    row({
      id: "focus-1",
      title: "Backend / systems study",
      status: "todo",
      due_date: "2026-07-13",
    }),
  ]);
  await mockSupabaseTasks(page, db);

  const patches: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "PATCH" && req.url().includes("/rest/v1/tasks"))
      patches.push(req.postData() ?? "");
  });

  await page.goto("/");
  const title = page.getByText("Backend / systems study");
  await expect(title).toBeVisible();

  await page.getByRole("button", { name: /Mark .* done/ }).click();

  // The card confirms visually (strikethrough + filled check) rather than
  // just vanishing the instant it's clicked...
  await expect(title).toHaveClass(/line-through/);
  // ...the status write actually goes out...
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(patches[0]).toContain('"status":"done"');
  // ...and it persists, so the card leaves for good instead of rolling back.
  await expect(title).toBeHidden({ timeout: 5000 });
  expect(db.rows[0].status).toBe("done");
});
