import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    companies: [],
    applications: [],
    interviews: [],
  };
  class Query {
    private operation: "select" | "insert" | "update" = "select";
    private payload: Row = {};
    private filters: { column: string; value: unknown }[] = [];
    constructor(private table: string) {}
    select() {
      return this;
    }
    order() {
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }
    is(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }
    insert(payload: Row) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }
    private run() {
      if (this.operation === "insert") {
        const row = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: "2026-07-12T00:00:00Z",
          updated_at: "2026-07-12T00:00:00Z",
          ...this.payload,
        };
        tables[this.table].push(row);
        return [row];
      }
      const matched = tables[this.table].filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );
      if (this.operation === "update")
        matched.forEach((row) => Object.assign(row, this.payload));
      return matched;
    }
    single() {
      return Promise.resolve({ data: this.run()[0] ?? null, error: null });
    }
    then(
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      return Promise.resolve({ data: this.run(), error: null }).then(
        resolve,
        reject,
      );
    }
  }
  return {
    from: (table: string) => new Query(table),
    seed: (table: string, rows: Row[]) =>
      tables[table].push(...rows.map((row) => ({ ...row }))),
    rows: (table: string) => tables[table],
    reset: () => {
      tables.companies = [];
      tables.applications = [];
      tables.interviews = [];
    },
  };
});

vi.mock("@/src/lib/supabaseClient", () => ({ supabase: { from: h.from } }));

import * as CompanyRepository from "@/src/modules/jobApplications/CompanyRepository";
import * as ApplicationRepository from "@/src/modules/jobApplications/ApplicationRepository";
import * as InterviewRepository from "@/src/modules/jobApplications/InterviewRepository";

const stamp = "2026-07-12T00:00:00Z";
function companyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "company",
    name: "Acme",
    tier: "match",
    notes: null,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  };
}
function applicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "application",
    company_id: "company",
    role_title: "Backend Engineer",
    resume_variant: "swe_backend",
    stage: "researching",
    applied_date: null,
    last_update_date: "2026-07-01",
    referral_source: null,
    follow_up_date: null,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  };
}
function interviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "interview",
    application_id: "application",
    round_type: "coding",
    scheduled_at: stamp,
    completed: false,
    outcome: null,
    post_mortem_notes: null,
    deleted_at: null,
    created_at: stamp,
    updated_at: stamp,
    ...overrides,
  };
}

beforeEach(() => h.reset());

describe("company repository", () => {
  it("maps active companies and soft-deletes without cascading", async () => {
    h.seed("companies", [companyRow()]);
    h.seed("applications", [applicationRow()]);
    expect(await CompanyRepository.getCompanies()).toEqual([
      expect.objectContaining({ name: "Acme", tier: "match" }),
    ]);
    await CompanyRepository.deleteCompany("company");
    expect(h.rows("companies")[0].deleted_at).toEqual(expect.any(String));
    expect(h.rows("applications")[0].deleted_at).toBeNull();
  });
});

describe("application repository", () => {
  it("creates applications and bumps last update date on every update", async () => {
    const created = await ApplicationRepository.createApplication({
      companyId: "company",
      roleTitle: "MLE",
      resumeVariant: "mle_ml_infra",
    });
    const updated = await ApplicationRepository.updateApplication(created.id, {
      referralSource: "Alex",
    });
    expect(updated).toMatchObject({
      roleTitle: "MLE",
      referralSource: "Alex",
      lastUpdateDate: "2026-07-12",
    });
  });
  it("soft-deletes applications", async () => {
    h.seed("applications", [applicationRow()]);
    await ApplicationRepository.deleteApplication("application");
    expect(h.rows("applications")[0].deleted_at).toEqual(expect.any(String));
  });
});

describe("interview repository", () => {
  it("loads interviews for one application", async () => {
    h.seed("interviews", [
      interviewRow(),
      interviewRow({ id: "other", application_id: "other-app" }),
    ]);
    const interviews =
      await InterviewRepository.getInterviewsForApplication("application");
    expect(interviews.map((interview) => interview.id)).toEqual(["interview"]);
  });
  it("creates, completes, and soft-deletes interviews", async () => {
    const created = await InterviewRepository.createInterview({
      applicationId: "application",
      roundType: "behavioral",
      scheduledAt: stamp,
    });
    const completed = await InterviewRepository.updateInterview(created.id, {
      completed: true,
      postMortemNotes: "Review",
    });
    expect(completed).toMatchObject({
      completed: true,
      postMortemNotes: "Review",
    });
    await InterviewRepository.deleteInterview(created.id);
    expect(h.rows("interviews")[0].deleted_at).toEqual(expect.any(String));
  });
});
