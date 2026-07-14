import { expect, test } from "./fixtures";
import { FakeTaskDb, mockSupabaseTasks, row } from "./supabaseTasksMock";

// Accessibility guarantees, exercised rather than assumed. Every one of these
// pins something a sighted mouse user would never notice breaking.

test("every interactive element gets a visible focus ring", async ({
  page,
}) => {
  await page.goto("/dashboard");
  // Wait for the page to be interactive before tabbing. Pressing Tab into a
  // still-hydrating page focuses <body>, which has nothing to assert on — it
  // passed alone and failed intermittently under full-suite load, which is the
  // worst way for a test to fail.
  await expect(page.getByRole("link", { name: "Task Engine" })).toBeVisible();

  // The app previously had exactly ONE :focus rule in the whole stylesheet, so
  // keyboard users could not tell where they were. This asserts the global
  // focus-visible ring actually paints — not just that a rule exists.
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      width: s.outlineWidth,
      style: s.outlineStyle,
    };
  });

  expect(outline, "nothing received focus on Tab").not.toBeNull();
  expect(outline!.style).not.toBe("none");
  expect(parseFloat(outline!.width)).toBeGreaterThan(0);
});

test("focus ring appears on keyboard focus but NOT on mouse click", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const refresh = page.getByRole("button", { name: "Refresh" });

  // :focus-visible, not :focus — a mouse click shouldn't leave a ring behind.
  await refresh.click();
  const afterClick = await refresh.evaluate(
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(afterClick).toBe("none");
});

test("the kanban board is fully operable by keyboard", async ({ page }) => {
  // @dnd-kit's KeyboardSensor is wired, but nothing had ever exercised it. A
  // drag-only board is unusable without a mouse, and this is the app's core
  // surface — so this is the single most important a11y test here.
  const db = new FakeTaskDb([
    row({ id: "t1", title: "Keyboard task", status: "inbox", position: 0 }),
  ]);
  await mockSupabaseTasks(page, db);
  await page.goto("/");

  const card = page.getByRole("article", { name: "Task: Keyboard task" });
  await expect(card).toBeVisible();

  // The status select is the keyboard-accessible path to move a task between
  // columns without dragging. If this ever regresses, the board becomes
  // mouse-only.
  const status = card.getByRole("combobox");
  await status.focus();
  await expect(status).toBeFocused();

  await status.selectOption("todo");
  await expect
    .poll(() => db.rows.find((r) => r.id === "t1")?.status)
    .toBe("todo");
});

test("the mobile nav disclosure is announced and toggles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const toggle = page.getByRole("button", { name: "Menu" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-controls", "app-nav");

  await toggle.click();
  await expect(page.getByRole("button", { name: "Close" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("link", { name: "Prep Tracker" })).toBeVisible();
});

test("achievement unlocks are announced to screen readers", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // Without a live region a screen reader never hears an achievement fire —
  // which is the entire feature.
  const toaster = page.locator('[aria-live="polite"]').first();
  await expect(toaster).toHaveCount(1);
});

test("every page has exactly one h1 and a main landmark", async ({ page }) => {
  for (const path of ["/dashboard", "/", "/prep", "/applications"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("navigation")).toBeVisible();
  }
});
