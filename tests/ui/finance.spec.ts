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

type BudgetRow = {
  id: string;
  category: string;
  amount_cents: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReceivableRow = {
  id: string;
  person: string;
  amount_cents: number;
  reason: string | null;
  due_on: string | null;
  status: "not_requested" | "requested" | "paid";
  transaction_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function mockFinance(page: Page) {
  const historicalDate = format(addMonths(new Date(), -2), "yyyy-MM-dd");
  const historicalTimestamp = new Date().toISOString();
  const rows: FinanceRow[] = [
    {
      id: "historical-burn",
      kind: "expense",
      amount_cents: 20000,
      category: "rent",
      occurred_on: historicalDate,
      note: "Historical rent",
      bill_id: null,
      paid_at: historicalTimestamp,
      deleted_at: null,
      created_at: historicalTimestamp,
      updated_at: historicalTimestamp,
    },
  ];
  const bills: BillRow[] = [];
  const budgets: BudgetRow[] = [];
  const receivables: ReceivableRow[] = [];
  let savingsCents = 0;
  let sequence = 0;

  return page.route(
    /\/rest\/v1\/(finance_transactions|recurring_bills|finance_budgets|finance_settings|finance_receivables)/,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table = url.pathname.split("/").pop();
      const now = new Date().toISOString();

      if (table === "finance_receivables") {
        if (request.method() === "GET") {
          const id = url.searchParams.get("id")?.replace("eq.", "");
          const matching = receivables.filter(
            (receivable) =>
              !receivable.deleted_at && (!id || receivable.id === id),
          );
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(id ? matching[0] : matching),
          });
          return;
        }

        if (request.method() === "POST") {
          const input = request.postDataJSON() as Partial<ReceivableRow>;
          const receivable: ReceivableRow = {
            id: `receivable-${++sequence}`,
            person: input.person ?? "Someone",
            amount_cents: input.amount_cents ?? 0,
            reason: input.reason ?? null,
            due_on: input.due_on ?? null,
            status: input.status ?? "not_requested",
            transaction_id: null,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          };
          receivables.unshift(receivable);
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(receivable),
          });
          return;
        }

        if (request.method() === "PATCH") {
          const id = url.searchParams.get("id")?.replace("eq.", "");
          const input = request.postDataJSON() as Partial<ReceivableRow>;
          const receivable = receivables.find((item) => item.id === id);
          if (!receivable) {
            await route.fulfill({ status: 404, body: "{}" });
            return;
          }
          Object.assign(receivable, input, { updated_at: now });
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(receivable),
          });
          return;
        }
      }

      if (table === "finance_budgets") {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              budgets.filter((budget) => !budget.deleted_at),
            ),
          });
          return;
        }

        if (request.method() === "POST") {
          const input = request.postDataJSON() as Partial<BudgetRow>;
          const existing = budgets.find(
            (budget) => budget.category === input.category,
          );
          const budget: BudgetRow = existing ?? {
            id: `budget-${++sequence}`,
            category: input.category ?? "other",
            amount_cents: 0,
            deleted_at: null,
            created_at: now,
            updated_at: now,
          };
          Object.assign(budget, input, { deleted_at: null, updated_at: now });
          if (!existing) budgets.push(budget);
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(budget),
          });
          return;
        }

        if (request.method() === "PATCH") {
          const id = url.searchParams.get("id")?.replace("eq.", "");
          const input = request.postDataJSON() as Partial<BudgetRow>;
          const budget = budgets.find((item) => item.id === id);
          if (!budget) {
            await route.fulfill({ status: 404, body: "{}" });
            return;
          }
          Object.assign(budget, input, { updated_at: now });
          await route.fulfill({ status: 204, body: "" });
          return;
        }
      }

      if (table === "finance_settings") {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ current_savings_cents: savingsCents }),
          });
          return;
        }

        if (request.method() === "POST") {
          const input = request.postDataJSON() as {
            current_savings_cents?: number;
          };
          savingsCents = input.current_savings_cents ?? 0;
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ current_savings_cents: savingsCents }),
          });
          return;
        }
      }

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
  const monthSummary = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: format(new Date(), "MMMM yyyy"),
        exact: true,
      }),
    })
    .last();
  const ledgerView = page.getByRole("group", { name: "Ledger view" });
  await expect(
    ledgerView.getByRole("button", { name: "Table" }),
  ).toHaveAttribute("aria-pressed", "true");
  await ledgerView.getByRole("button", { name: "Cards" }).click();

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
  await expect(monthSummary.getByText("—", { exact: true })).toHaveCount(3);

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
  await expect(monthSummary.getByText("—", { exact: true })).toHaveCount(3);

  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByText("Due", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark paid" })).toHaveCount(0);
  await expect(page.getByText("$75.00", { exact: true })).toHaveCount(2);
  await expect(page.getByText("-$75.00", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "Set budget" }).click();
  const budgetDialog = page.getByRole("dialog", { name: "Set a budget" });
  await budgetDialog.getByLabel("Category").selectOption("utilities");
  await budgetDialog.getByLabel("Monthly limit").fill("bad limit");
  await budgetDialog.getByRole("button", { name: "Set budget" }).click();
  await expect(
    budgetDialog.getByText("Enter a valid non-negative amount."),
  ).toBeVisible();

  await budgetDialog.getByLabel("Monthly limit").fill("50");
  await budgetDialog.getByRole("button", { name: "Set budget" }).click();
  await expect(budgetDialog).toHaveCount(0);
  await expect(page.getByText("$75.00 spent of $50.00")).toBeVisible();
  await expect(page.getByText("Over by $25.00")).toBeVisible();

  await page.getByLabel("Current savings").fill("1000");
  await page.getByRole("button", { name: "Update savings" }).click();
  await expect(page.getByText("5.0 months", { exact: true })).toBeVisible();
  await expect(
    page.getByText("$200.00 average monthly burn", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  const incomeDialog = page.getByRole("dialog", { name: "Add transaction" });
  await incomeDialog.getByRole("button", { name: "Income" }).click();
  await incomeDialog.getByLabel("Amount").fill("300");
  await incomeDialog.getByLabel("Note").fill("Contract payment");
  await incomeDialog.getByRole("button", { name: "Add transaction" }).click();
  await expect(incomeDialog).toHaveCount(0);

  await ledgerView.getByRole("button", { name: "Table" }).click();
  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  await table.getByRole("button", { name: "Amount", exact: true }).click();
  const rows = table.locator("tbody tr");
  await expect(rows.nth(0)).toContainText("Electricity");
  await expect(rows.nth(1)).toContainText("Contract payment");

  await table.getByRole("button", { name: "Amount", exact: true }).click();
  await expect(rows.nth(0)).toContainText("Contract payment");
  await expect(rows.nth(1)).toContainText("Electricity");

  await table
    .getByRole("button", { name: "Edit amount for Contract payment" })
    .click();
  const inlineAmount = table.getByLabel("Amount for Contract payment");
  await inlineAmount.fill("400");
  await inlineAmount.press("Enter");
  await expect(page.getByText("$400.00", { exact: true })).toHaveCount(2);
  await expect(page.getByText("$325.00", { exact: true })).toBeVisible();

  await table
    .getByRole("button", { name: "Edit amount for Contract payment" })
    .click();
  const invalidAmount = table.getByLabel("Amount for Contract payment");
  await invalidAmount.fill("not an amount");
  await invalidAmount.press("Enter");
  await expect(
    table.getByText("Enter a valid non-negative amount."),
  ).toBeVisible();
  await expect(invalidAmount).toBeVisible();
  await invalidAmount.press("Escape");
  await expect(
    table.getByText("Enter a valid non-negative amount."),
  ).toHaveCount(0);
  await expect(page.getByText("$400.00", { exact: true })).toHaveCount(2);

  const receivablesPanel = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Owed to me", exact: true }),
    })
    .last();
  await expect(
    receivablesPanel.getByText("Nobody owes you money"),
  ).toBeVisible();
  await receivablesPanel
    .getByRole("button", { name: "Add money owed", exact: true })
    .click();
  const receivableDialog = page.getByRole("dialog", {
    name: "Add money owed",
  });
  await receivableDialog.getByLabel("Person").fill("Jordan");
  await receivableDialog.getByLabel("Amount").fill("not money");
  await receivableDialog
    .getByRole("button", { name: "Add money owed" })
    .click();
  await expect(
    receivableDialog.getByText("Enter a valid non-negative amount."),
  ).toBeVisible();

  await receivableDialog.getByLabel("Amount").fill("50");
  await receivableDialog.getByLabel("Reason").fill("Movie tickets");
  await receivableDialog
    .getByLabel("Due date")
    .fill(format(new Date(), "yyyy-MM-dd"));
  await receivableDialog
    .getByRole("button", { name: "Add money owed" })
    .click();

  await expect(receivableDialog).toHaveCount(0);
  await expect(receivablesPanel.getByText("Jordan")).toBeVisible();
  await expect(receivablesPanel.getByText("1 not requested")).toBeVisible();
  await receivablesPanel
    .getByRole("button", { name: "Mark requested" })
    .click();
  await expect(
    receivablesPanel.getByText("Requested", { exact: true }),
  ).toBeVisible();
  await expect(receivablesPanel.getByText("0 not requested")).toBeVisible();

  await receivablesPanel.getByRole("button", { name: "Mark paid" }).click();
  await expect(
    receivablesPanel.getByText("Nobody owes you money"),
  ).toBeVisible();
  await expect(
    receivablesPanel.getByText("Paid", { exact: true }),
  ).toBeVisible();
  const reimbursementRow = table.locator("tbody tr").filter({
    hasText: "Jordan: Movie tickets",
  });
  await expect(reimbursementRow).toContainText("Reimbursement");
  await expect(reimbursementRow).toContainText("$50.00");
  await expect(page.getByText("$450.00", { exact: true })).toBeVisible();
  await expect(page.getByText("$375.00", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Ledger view" })
      .getByRole("button", { name: "Table" }),
  ).toHaveAttribute("aria-pressed", "true");
});
