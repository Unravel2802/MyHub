import { addMonths, format } from "date-fns";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

type FinanceRow = {
  id: string;
  kind: "income" | "expense";
  amount_cents: number;
  category: string;
  occurred_on: string;
  note: string | null;
  bill_id: string | null;
  paid_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type BillRow = {
  id: string;
  name: string;
  amount_cents: number;
  category: string;
  day_of_month: number;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function mockFinance(page: Page) {
  const rows: FinanceRow[] = [];
  const bills: BillRow[] = [];
  let sequence = 0;

  return page.route(
    /\/rest\/v1\/(finance_transactions|recurring_bills)/,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table = url.pathname.split("/").pop();
      const now = new Date().toISOString();

      if (table === "recurring_bills") {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(bills.filter((bill) => !bill.deleted_at)),
          });
          return;
        }

        if (request.method() === "POST") {
          const input = request.postDataJSON() as Partial<BillRow>;
          const bill: BillRow = {
            id: `bill-${++sequence}`,
            name: input.name ?? "Recurring bill",
            amount_cents: input.amount_cents ?? 0,
            category: input.category ?? "rent",
            day_of_month: input.day_of_month ?? 1,
            active: input.active ?? true,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          };
          bills.push(bill);
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(bill),
          });
          return;
        }

        if (request.method() === "PATCH") {
          const id = url.searchParams.get("id")?.replace("eq.", "");
          const input = request.postDataJSON() as Partial<BillRow>;
          const bill = bills.find((item) => item.id === id);
          if (!bill) {
            await route.fulfill({ status: 404, body: "{}" });
            return;
          }
          Object.assign(bill, input, { updated_at: now });
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(bill),
          });
          return;
        }
      }

      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(rows.filter((row) => !row.deleted_at)),
        });
        return;
      }

      if (request.method() === "POST") {
        const input = request.postDataJSON() as Partial<FinanceRow>;
        const row: FinanceRow = {
          id: `finance-${++sequence}`,
          kind: input.kind ?? "expense",
          amount_cents: input.amount_cents ?? 0,
          category: input.category ?? "other",
          occurred_on: input.occurred_on ?? format(new Date(), "yyyy-MM-dd"),
          note: input.note ?? null,
          bill_id: input.bill_id ?? null,
          paid_at: "paid_at" in input ? (input.paid_at ?? null) : now,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };
        rows.unshift(row);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(row),
        });
        return;
      }

      if (request.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const input = request.postDataJSON() as Partial<FinanceRow>;
        const row = rows.find((item) => item.id === id);
        if (!row) {
          await route.fulfill({ status: 404, body: "{}" });
          return;
        }
        Object.assign(row, input, { updated_at: now });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(row),
        });
        return;
      }

      await route.continue();
    },
  );
}

test("adds, edits, and deletes a transaction with live summary updates", async ({
  page,
}) => {
  await mockFinance(page);
  await page.goto("/finance");
  await expect(
    page.getByRole("heading", { name: "Know where the month went" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Amount").fill("twelve dollars");
  await dialog.getByRole("button", { name: "Add transaction" }).click();
  await expect(
    dialog.getByText("Enter a valid non-negative amount."),
  ).toBeVisible();
  await expect(page.getByText("No transactions this month")).toBeVisible();

  await dialog.getByLabel("Amount").fill("125.50");
  await dialog.getByLabel("Category").selectOption("groceries");
  await dialog.getByLabel("Note").fill("Weekly groceries");
  await dialog.getByRole("button", { name: "Add transaction" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Weekly groceries")).toBeVisible();
  await expect(page.getByText("-$125.50", { exact: true })).toHaveCount(2);
  await expect(page.getByText("$125.50", { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(
    page.getByRole("heading", {
      name: format(addMonths(new Date(), -1), "MMMM yyyy"),
    }),
  ).toBeVisible();
  await expect(page.getByText("No transactions this month")).toBeVisible();
  await page.getByRole("button", { name: "Current month" }).click();
  await expect(page.getByText("Weekly groceries")).toBeVisible();

  await page.getByRole("button", { name: "Edit Groceries" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit transaction" });
  await expect(editDialog.getByLabel("Amount")).toHaveValue("125.50");
  await editDialog.getByLabel("Amount").fill("200");
  await editDialog.getByLabel("Note").fill("Groceries and household items");
  await editDialog.getByRole("button", { name: "Save changes" }).click();

  await expect(editDialog).toHaveCount(0);
  await expect(page.getByText("Groceries and household items")).toBeVisible();
  await expect(page.getByText("-$200.00", { exact: true })).toHaveCount(2);
  await expect(page.getByText("$200.00", { exact: true })).toHaveCount(1);

  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Delete Groceries" }).click();
  await expect(page.getByText("No transactions this month")).toBeVisible();
  await expect(page.getByText("$200.00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);

  await page.getByRole("button", { name: "Add recurring bill" }).click();
  const billDialog = page.getByRole("dialog", { name: "Add recurring bill" });
  await billDialog.getByLabel("Name").fill("Electricity");
  await billDialog.getByLabel("Amount").fill("not money");
  await billDialog.getByRole("button", { name: "Add recurring bill" }).click();
  await expect(
    billDialog.getByText("Enter a valid non-negative amount."),
  ).toBeVisible();

  await billDialog.getByLabel("Amount").fill("75");
  await billDialog.getByLabel("Category").selectOption("utilities");
  await billDialog.getByLabel("Day of month").fill("15");
  await billDialog.getByRole("button", { name: "Add recurring bill" }).click();

  await expect(billDialog).toHaveCount(0);
  await expect(page.getByText("Electricity")).toHaveCount(2);
  await expect(page.getByText("Due", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible();
  await expect(page.getByText("—", { exact: true })).toHaveCount(3);

  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByText("Due", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark paid" })).toHaveCount(0);
  await expect(page.getByText("$75.00", { exact: true })).toHaveCount(2);
  await expect(page.getByText("-$75.00", { exact: true })).toHaveCount(2);
});
