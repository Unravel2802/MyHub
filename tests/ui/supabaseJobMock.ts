import type { Page } from "@playwright/test";

type Table = "companies" | "applications" | "interviews";
type Row = Record<string, unknown>;
const STAMP = "2026-07-12T00:00:00.000Z";

export function companyRow(overrides: Row = {}): Row {
  return {
    id: "company",
    name: "Acme",
    tier: "match",
    notes: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}
export function applicationRow(overrides: Row = {}): Row {
  return {
    id: "application",
    company_id: "company",
    role_title: "Backend Engineer",
    resume_variant: "swe_backend",
    stage: "researching",
    applied_date: null,
    last_update_date: "2026-07-12",
    referral_source: null,
    follow_up_date: null,
    notes: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}
export function interviewRow(overrides: Row = {}): Row {
  return {
    id: "interview",
    application_id: "application",
    round_type: "coding",
    scheduled_at: STAMP,
    completed: false,
    outcome: null,
    post_mortem_notes: null,
    completed_at: null,
    post_mortem_logged_at: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export class FakeJobDb {
  companies: Row[];
  applications: Row[];
  interviews: Row[];
  private failures: { table: Table; method: string }[] = [];
  constructor(
    companies: Row[] = [],
    applications: Row[] = [],
    interviews: Row[] = [],
  ) {
    this.companies = companies;
    this.applications = applications;
    this.interviews = interviews;
  }
  failNext(table: Table, method: "POST" | "PATCH") {
    this.failures.push({ table, method });
  }
  takeFailure(table: Table, method: string) {
    const index = this.failures.findIndex(
      (failure) => failure.table === table && failure.method === method,
    );
    if (index < 0) return false;
    this.failures.splice(index, 1);
    return true;
  }
}

const reserved = new Set(["select", "order", "limit", "offset"]);
function filter(rows: Row[], url: URL) {
  const filters = [...url.searchParams.entries()].filter(
    ([key]) => !reserved.has(key),
  );
  return rows.filter((row) =>
    filters.every(([column, expression]) =>
      expression === "is.null"
        ? row[column] === null
        : expression.startsWith("eq.")
          ? String(row[column]) === expression.slice(3)
          : true,
    ),
  );
}

export async function mockSupabaseJob(page: Page, db: FakeJobDb) {
  for (const table of [
    "companies",
    "applications",
    "interviews",
  ] satisfies Table[]) {
    await page.route(`**/rest/v1/${table}*`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (db.takeFailure(table, method)) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulated database failure" }),
        });
        return;
      }
      const rows = db[table];
      const wantsObject = (request.headers()["accept"] ?? "").includes(
        "vnd.pgrst.object+json",
      );
      const respond = async (result: Row[]) =>
        route.fulfill({
          status: method === "POST" ? 201 : 200,
          contentType: "application/json",
          body: JSON.stringify(wantsObject ? (result[0] ?? null) : result),
        });
      if (method === "GET") {
        await respond(filter(rows, url));
        return;
      }
      if (method === "POST") {
        const payload = request.postDataJSON() as Row;
        const created = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: STAMP,
          updated_at: STAMP,
          ...(table === "applications"
            ? { stage: "researching", last_update_date: "2026-07-12" }
            : {}),
          ...(table === "interviews" ? { completed: false } : {}),
          ...payload,
        };
        rows.push(created);
        await respond([created]);
        return;
      }
      if (method === "PATCH") {
        const payload = request.postDataJSON() as Row;
        const targets = filter(rows, url);
        targets.forEach((row) =>
          Object.assign(row, payload, { updated_at: STAMP }),
        );
        if (!url.searchParams.has("select")) {
          await route.fulfill({ status: 204, body: "" });
          return;
        }
        await respond(targets);
        return;
      }
      await route.fulfill({ status: 405, body: "" });
    });
  }
}
