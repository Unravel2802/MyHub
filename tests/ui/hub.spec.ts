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
