import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// DB integration tests — the layer the unit + E2E suites can't see. Unit tests
// mock the repository; the Playwright mock accepts any POST. So a schema /
// ON CONFLICT / constraint bug (the 42P10 class that shipped green THREE times)
// is invisible everywhere except here, where these call the REAL repository
// against a REAL PostgREST + Postgres. See docs/db-integration-tests.md.
//
// The repository is imported dynamically in beforeAll so it reads the test-DB
// env that vitest.db.setup.ts installed (its top-level createClient runs at
// import time). `admin` is a raw service-role client used only for teardown.

let FinanceRepository: typeof import("@/src/modules/finance/FinanceRepository");
let admin: SupabaseClient;

const TEST_CATEGORY = "__dbtest_budget__";
const TEST_PERSON = "__dbtest_person__";

beforeAll(async () => {
  FinanceRepository = await import("@/src/modules/finance/FinanceRepository");
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
});

describe("FinanceRepository budgets (db)", () => {
  afterEach(async () => {
    await admin.from("finance_budgets").delete().eq("category", TEST_CATEGORY);
  });

  it("upsertBudget persists — a partial-index ON CONFLICT would 42P10 here", async () => {
    const created = await FinanceRepository.upsertBudget(TEST_CATEGORY, 50000);
    expect(created.amountCents).toBe(50000);

    // The second call is the ON CONFLICT (category) path — the exact shape that
    // failed with 42P10 against a partial unique index. It must UPDATE, not throw.
    const updated = await FinanceRepository.upsertBudget(TEST_CATEGORY, 75000);
    expect(updated.amountCents).toBe(75000);

    const all = await FinanceRepository.getBudgets();
    const mine = all.filter((budget) => budget.category === TEST_CATEGORY);
    expect(mine).toHaveLength(1);
    expect(mine[0].amountCents).toBe(75000);
  });
});

describe("FinanceRepository settings (db)", () => {
  let original: number;

  beforeAll(async () => {
    original = (await FinanceRepository.getSettings()).currentSavingsCents;
  });

  afterAll(async () => {
    // Restore the pristine (no-row) state so a test run never leaves a savings
    // figure behind — the single-row table is shared, real state.
    await admin.from("finance_settings").delete().eq("id", true);
    if (original !== 0) await FinanceRepository.updateSavings(original);
  });

  it("updateSavings single-row upsert persists (id-boolean-true key)", async () => {
    const saved = await FinanceRepository.updateSavings(4242);
    expect(saved.currentSavingsCents).toBe(4242);
    expect((await FinanceRepository.getSettings()).currentSavingsCents).toBe(
      4242,
    );
  });
});

describe("FinanceRepository receivable → income (db)", () => {
  const receivableIds: string[] = [];
  const transactionIds: string[] = [];

  afterEach(async () => {
    // Receivables FK-reference the transaction, so delete them first.
    for (const id of receivableIds) {
      await admin.from("finance_receivables").delete().eq("id", id);
    }
    for (const id of transactionIds) {
      await admin.from("finance_transactions").delete().eq("id", id);
    }
    receivableIds.length = 0;
    transactionIds.length = 0;
  });

  it("markReceivablePaid creates a linked reimbursement income transaction", async () => {
    const receivable = await FinanceRepository.createReceivable({
      person: TEST_PERSON,
      amountCents: 4200,
      reason: "probe",
    });
    receivableIds.push(receivable.id);

    const result = await FinanceRepository.markReceivablePaid(receivable.id);
    transactionIds.push(result.transaction.id);

    expect(result.receivable.status).toBe("paid");
    expect(result.receivable.transactionId).toBe(result.transaction.id);
    expect(result.transaction.kind).toBe("income");
    expect(result.transaction.category).toBe("reimbursement");
    expect(result.transaction.amountCents).toBe(4200);
    // paid_at set => it's SETTLED income, so it counts in the ledger.
    expect(result.transaction.paidAt).not.toBeNull();
  });
});
