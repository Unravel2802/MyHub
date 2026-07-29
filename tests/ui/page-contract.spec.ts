import { expect, test } from "./fixtures";

// The page contract gate (docs/ui-upgrade-wave3.md Part 3).
//
// PageTemplate makes "data before forms" structural, but only for routes that
// actually use it. This asserts the contract holds on every converted route,
// and — via UNCONVERTED below — tracks the ones still to go.
//
// Trading is why this exists: it shipped a nine-field entry form above its
// equity curve and journal, the exact defect docs/visual-refresh.md §1.5 had
// already diagnosed and fixed for three other modules. Nothing caught it.

const ROUTES = [
  "/dashboard",
  "/",
  "/tasks",
  "/prep",
  "/applications",
  "/outreach",
  "/achievements",
  "/review",
  "/offers",
  "/notes",
  "/finance",
  "/trading",
  "/design-drills",
];

// Routes not yet migrated to PageTemplate (X1).
//
// This list is the X1 progress tracker, and deleting its last entry is the
// definition of done. Do not add to it — a new route starts on the template.
//
// "/" (the hub) stays here deliberately, not as debt: its shared centered
// max-w-5xl header/content layout has no equivalent in the current contract,
// and X1's brief said to flag that rather than force a wrapper-width hook into
// PageTemplate to cover one page. Removing it means either the contract grows
// that hook or the hub's layout is rebuilt to fit — a decision for whoever
// picks up the hub, not a silent side effect of this list shrinking.
const UNCONVERTED = new Set(["/"]);

for (const path of ROUTES) {
  const converted = !UNCONVERTED.has(path);

  test(`page contract: ${path}${converted ? "" : " (unconverted)"}`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForTimeout(1000);

    const slots = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-page-slot]")).map((el) =>
        el.getAttribute("data-page-slot"),
      ),
    );

    if (!converted) {
      // Keeps the allowlist honest in both directions: once a route is
      // converted, this fails until it is removed from UNCONVERTED, so the
      // tracker cannot silently go stale.
      expect(
        slots,
        `${path} is on PageTemplate now — remove it from UNCONVERTED`,
      ).toHaveLength(0);
      return;
    }

    // A page has at most one focal point. `hero={null}` is a legitimate choice
    // for content-first pages, so zero is allowed; two never is.
    expect(
      slots.filter((slot) => slot === "hero").length,
      `${path} has more than one hero`,
    ).toBeLessThanOrEqual(1);

    // The contract itself: entry forms render after the data, never before.
    const dataAt = slots.indexOf("data");
    const composeAt = slots.indexOf("compose");
    expect(dataAt, `${path} renders no data slot`).toBeGreaterThanOrEqual(0);
    if (composeAt !== -1)
      expect(
        composeAt,
        `${path} renders its compose slot before its data`,
      ).toBeGreaterThan(dataAt);

    // And the same rule expressed the way a reader experiences it: the first
    // ENTRY-COMPOSER form on the page must not sit above the first data panel.
    // This catches a form smuggled into `children` ahead of the content, which
    // the slot-order check alone cannot see.
    //
    // Forms inside the `<header>` are excluded on purpose: `actions` can
    // legitimately hold a small persistent toolbar form (Task Board's inline
    // "quick add" search-and-create bar), which is a control at the same
    // structural level as Outreach's Refresh button, not the entry-composer
    // panel ("Log an entry", "Log a conversation") the form-first rule is
    // actually about. Found by running this gate against X1's real output —
    // the first version of this check flagged Task Board's toolbar form as a
    // violation before this exclusion existed.
    const formAboveData = await page.evaluate(() => {
      const data = document.querySelector('[data-page-slot="data"]');
      if (!data) return false;
      const form = Array.from(document.querySelectorAll("form")).find(
        (candidate) => !candidate.closest("header"),
      );
      if (!form) return false;
      // Forms nested inside the data slot are fine — an inline editor on a row.
      if (data.contains(form)) return false;
      return !!(
        form.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(formAboveData, `${path} puts a form above its data`).toBe(false);

    // "Never headline absence" (§2.2). Checked here rather than in StatCard
    // because every real hero in this app passes a preformatted template string
    // ("0 days · 0 applications · 0 outreach"), which the component's null/zero
    // detection cannot see. The rendered text can.
    //
    // The fixture stubs all reads to `[]`, so every page here IS the fresh
    // account — the exact case the rule exists for.
    // Counted before it is read: a hero need not be a StatCard at all (Outreach
    // uses a bespoke cadence panel), and calling textContent() on a locator
    // that matches nothing waits out the whole test timeout instead of
    // returning empty.
    const heroValues = page.locator(
      '[data-page-slot="hero"] [data-stat-value]',
    );
    const heroValue =
      (await heroValues.count()) > 0
        ? (await heroValues.first().textContent())?.trim()
        : undefined;

    if (heroValue && !HEADLINES_ABSENCE.has(path))
      expect(
        headlinesAbsence(heroValue),
        `${path} headlines absence: hero reads "${heroValue}"`,
      ).toBe(false);
  });
}

// A hero headlines absence when it is an em-dash, or when it contains digits
// and every one of them is zero: "0 days · 0 applications", "0%", "0/8".
// A hero with no digits at all is prose ("Start today's streak") and fine, as
// is any real measurement ("14 days", "May 2027", "$1,204.00").
function headlinesAbsence(text: string): boolean {
  if (text === "—") return true;
  if (!/\d/.test(text)) return false;
  return !/[1-9]/.test(text);
}

// Known violations, owned by X7 (the quiet-state copy pass). Each needs
// `absent` + `whenAbsent` on its hero StatCard and a line saying what to do
// next instead of what has not happened.
//
// This list only shrinks. Emptying it completes X7.
const HEADLINES_ABSENCE = new Set([
  "/dashboard", // "0 days · 0 applications · 0 outreach" — the app's front door
  "/achievements", // "0 days"
  "/prep", // "0%"
]);
