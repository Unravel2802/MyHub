import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const timestamp = "2026-07-13T08:00:00.000Z";

async function mockDashboard(page: Page) {
  await page.route("**/rest/v1/*", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    const rows: Record<string, unknown>[] =
      table === "tasks"
        ? [
            {
              id: "gate",
              title: "Gate: July 2026",
              description: null,
              status: "todo",
              position: 0,
              due_date: null,
              parent_task_id: null,
              recurs_weekly: false,
              weekday: null,
              recurrence_template_id: null,
              occurrence_date: null,
              deleted_at: null,
              created_at: timestamp,
              updated_at: timestamp,
            },
            {
              id: "gate-item",
              title: "Run diagnostics",
              description: null,
              status: "done",
              position: 1,
              due_date: null,
              parent_task_id: "gate",
              recurs_weekly: false,
              weekday: null,
              recurrence_template_id: null,
              occurrence_date: null,
              deleted_at: null,
              created_at: timestamp,
              updated_at: timestamp,
            },
            {
              id: "schedule",
              title: "Algorithms practice",
              description: null,
              status: "todo",
              position: 2,
              due_date: "2026-07-13",
              parent_task_id: null,
              recurs_weekly: false,
              weekday: null,
              recurrence_template_id: "weekly-rule",
              occurrence_date: "2026-07-13",
              deleted_at: null,
              created_at: timestamp,
              updated_at: timestamp,
            },
          ]
        : table === "prep_entries"
          ? [
              {
                id: "prep",
                entry_type: "algorithm",
                topic: "graphs",
                date: "2026-07-13",
                duration_min: 45,
                time_to_solve_min: 30,
                outcome: "solved",
                notes: null,
                deleted_at: null,
                created_at: timestamp,
                updated_at: timestamp,
              },
            ]
          : table === "behavioral_stories"
            ? [
                {
                  id: "story",
                  title: "Migration",
                  theme: "Leadership",
                  concise_version: "",
                  extended_version: "",
                  deleted_at: null,
                  created_at: timestamp,
                  updated_at: timestamp,
                },
              ]
            : table === "applications"
              ? [
                  {
                    id: "application",
                    company_id: "company",
                    role_title: "Platform Engineer",
                    resume_variant: "swe_backend",
                    stage: "applied",
                    applied_date: "2026-07-13",
                    last_update_date: "2026-07-13",
                    referral_source: null,
                    follow_up_date: null,
                    deleted_at: null,
                    created_at: timestamp,
                    updated_at: timestamp,
                  },
                ]
              : table === "interviews"
                ? []
                : table === "outreach_log"
                  ? [
                      {
                        id: "outreach",
                        contact_name: "Alex",
                        company_id: null,
                        channel: "linkedin",
                        date: "2026-07-13",
                        notes: null,
                        deleted_at: null,
                        created_at: timestamp,
                        updated_at: timestamp,
                      },
                    ]
                  : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    });
  });
}

test("dashboard renders cross-module progress panels", async ({ page }) => {
  await mockDashboard(page);
  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: "Keep the week honest" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This week's schedule" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Weekly cadence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prep checkpoint" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current gate checklist" }),
  ).toBeVisible();
  await expect(page.getByText("Algorithms practice")).toBeVisible();
  await expect(page.getByText("1/8")).toBeVisible();
});
