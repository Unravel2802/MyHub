import { expect, test } from "./fixtures";
import { FakeTradingDb, mockSupabaseTrading } from "./supabaseTradingMock";
import type { Locator, Page } from "@playwright/test";

async function choose(page: Page, control: Locator, option: string) {
  await control.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function fillBuy(page: Page) {
  const form = page.getByRole("form", { name: "Log journal entry" });
  await form.getByLabel("Ticker").fill("NVDA");
  await choose(page, form.getByLabel("Signal"), "Buy");
  await form.getByLabel("Observed price").fill("120.00");
  await form.getByLabel("Entry price").fill("120.00");
  await form.getByLabel("Stop price").fill("115.00");
  await form.getByLabel("Shares").fill("2");
  return form;
}

function statCard(page: Page, label: string) {
  return page
    .getByRole("region", { name: "Performance" })
    .getByText(label, { exact: true })
    .locator("..");
}

test("logs one linked buy and counts its close exactly once", async ({
  page,
}) => {
  const db = new FakeTradingDb();
  await mockSupabaseTrading(page, db);
  await page.goto("/trading");

  const form = await fillBuy(page);
  await form.getByRole("button", { name: "Log entry" }).click();

  await expect.poll(() => db.trades.length).toBe(1);
  await expect.poll(() => db.entries.length).toBe(1);
  expect(db.entries[0].trade_id).toBe(db.trades[0].id);
  await expect(page.getByRole("link", { name: "View trade" })).toHaveAttribute(
    "href",
    `#trade-${db.trades[0].id}`,
  );

  await page.getByRole("button", { name: "Close position" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Exit price").fill("130.00");
  await dialog.getByLabel("Realised P&L").fill("20.00");
  await dialog.getByRole("button", { name: "Save close" }).click();

  await expect.poll(() => db.trades[0].pnl_cents).toBe(2000);
  expect(db.trades).toHaveLength(1);
  expect(db.entries).toHaveLength(1);

  await expect(statCard(page, "Closed trades").getByText("1")).toBeVisible();
  await expect(statCard(page, "Win rate").getByText("100%")).toBeVisible();
  const totalPnl = statCard(page, "Total P&L");
  await expect(totalPnl.getByText("$20.00", { exact: true })).toHaveCount(1);
});

test("rolls back a failed buy create", async ({ page }) => {
  const db = new FakeTradingDb();
  db.failNext("trading_trades", "POST");
  await mockSupabaseTrading(page, db);
  await page.goto("/trading");

  const form = await fillBuy(page);
  await form.getByRole("button", { name: "Log entry" }).click();

  await expect(
    page.getByText("Something went wrong, please try again later.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(db.trades).toHaveLength(0);
  expect(db.entries).toHaveLength(0);
  await expect(page.getByText("No positions yet")).toBeVisible();
  await expect(page.getByText("No journal entries yet")).toBeVisible();
});

test("renders unavailable statistics as em-dashes rather than zeroes", async ({
  page,
}) => {
  await mockSupabaseTrading(page, new FakeTradingDb());
  await page.goto("/trading");

  for (const label of [
    "Win rate",
    "Expectancy",
    "Average win",
    "Average loss",
    "Profit factor",
    "Average R",
    "Rule compliance",
  ]) {
    const card = statCard(page, label);
    await expect(card.getByText("—", { exact: true })).toBeVisible();
    await expect(card.getByText(/^0(?:%|R)?$/)).toHaveCount(0);
  }
});

test("only offers trade and rule-break fields when they are valid", async ({
  page,
}) => {
  await mockSupabaseTrading(page, new FakeTradingDb());
  await page.goto("/trading");

  const form = page.getByRole("form", { name: "Log journal entry" });
  await expect(form.getByLabel("Linked trade")).toHaveCount(0);
  await expect(form.getByLabel("Entry price")).toHaveCount(0);
  await expect(form.getByLabel("Rule break")).toHaveCount(0);

  await choose(page, form.getByLabel("Signal"), "Sell");
  await expect(form.getByLabel("Linked trade")).toBeVisible();

  await choose(page, form.getByLabel("Rules followed"), "No");
  await expect(form.getByLabel("Rule break")).toBeVisible();

  await choose(page, form.getByLabel("Signal"), "Buy");
  await expect(form.getByLabel("Linked trade")).toHaveCount(0);
  await expect(form.getByLabel("Entry price")).toBeVisible();
});
