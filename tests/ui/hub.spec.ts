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

test("activating an orbit node locks it open and links to its destinations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  // Idle state: the momentum panel, not any workspace.
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();

  await activateNode(page, "Show Career's modules");

  await expect(page.getByText("Momentum", { exact: true })).toBeHidden();
  await expect(page.getByRole("link", { name: "Open Career" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await expect(
    page.getByRole("link", { name: "Dashboard" }).last(),
  ).toHaveAttribute("href", "/dashboard");

  // Locked, so it stays open on its own — closing it is an explicit action.
  await page
    .getByRole("button", { name: "Close and resume orbiting" })
    .click({ force: true });
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();

  await activateNode(page, "Show Money's modules");
  await expect(page.getByRole("link", { name: "Open Money" })).toHaveAttribute(
    "href",
    "/finance",
  );

  // Activating the already-locked node again toggles the lock off — the
  // panel keeps showing it regardless, since keyboard focus is still
  // literally on that node (the same way a mouse still resting on it would),
  // but it's no longer STICKY: the accessible name and pressed state flip
  // back, which is what actually distinguishes locked from just-hovered.
  // Not located by accessible name: that name itself is what's about to
  // change (Show -> Hide), so a name-bound locator would stop resolving the
  // moment the label it was built from flips. `activateNode` above already
  // pressed Enter once (the lock) — this checks that state, then presses it
  // a second time (the unlock).
  const moneyNode = page
    .locator("button.orbit-node")
    .filter({ hasText: "Money" });
  await expect(moneyNode).toHaveAttribute("aria-pressed", "true");
  await moneyNode.focus();
  await page.keyboard.press("Enter");
  await expect(moneyNode).toHaveAttribute("aria-pressed", "false");

  // Tabbing would just land on the NEXT node and preview that one, so drop
  // focus entirely — with nothing locked and nothing hovered, the panel
  // falls back to idle.
  await moneyNode.blur();
  await expect(page.getByText("Momentum", { exact: true })).toBeVisible();

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

  // Focus is on an orbit node. Activating it must open the panel, and Tab must
  // then continue INTO that panel — the second half of the claim in
  // app/page.tsx's comment, and the half a grid would otherwise provide.
  await page.keyboard.press("Enter");
  await expect(page.getByText("Momentum", { exact: true })).toBeHidden();

  await page.keyboard.press("Tab");
  const landedOnLink = await page.evaluate(
    () => document.activeElement instanceof HTMLAnchorElement,
  );
  expect(
    landedOnLink,
    "Tab after activating a node should reach the panel's module links",
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

  // Moons are decoration, but the same one-pass guarantee applies: locking a
  // workspace after the reduced-motion loop stops must reveal already-placed
  // moons rather than a stack at the canvas origin.
  await activateNode(page, "Show Career's modules");
  const moonPositions = await page
    .locator('[data-orbit-moon="career"]')
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${(el as HTMLElement).style.left}|${(el as HTMLElement).style.top}`,
      ),
    );
  expect(moonPositions.length).toBeGreaterThan(0);
  expect(new Set(moonPositions).size).toBe(moonPositions.length);
  for (const position of moonPositions) expect(position).not.toBe("|");
  await expect(page.locator('button[data-orbit-moon="career"]')).toHaveCount(0);
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
