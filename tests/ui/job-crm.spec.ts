import { expect, test } from "@playwright/test";
import {
  applicationRow,
  companyRow,
  FakeJobDb,
  interviewRow,
  mockSupabaseJob,
} from "./supabaseJobMock";

async function load(
  page: Parameters<typeof mockSupabaseJob>[0],
  db = new FakeJobDb(),
) {
  await mockSupabaseJob(page, db);
  await page.goto("/applications");
  await expect(
    page.getByRole("heading", { name: "Applications and interviews" }),
  ).toBeVisible();
  return db;
}

test("creates a company and application in the researching pipeline", async ({
  page,
}) => {
  const db = await load(page);
  await page.getByLabel("Company name").fill("OpenAI");
  await page.getByRole("button", { name: "Add company" }).click();
  await page
    .getByRole("combobox", { name: "Company", exact: true })
    .selectOption({ label: "OpenAI" });
  await page.getByLabel("Role title").fill("Backend Engineer");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByRole("region", { name: "Researching" })).toContainText(
    "Backend Engineer",
  );
  await expect
    .poll(() => db.applications[0])
    .toMatchObject({ role_title: "Backend Engineer", stage: "researching" });
});

test("moves an application to another pipeline stage", async ({ page }) => {
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()]),
  );
  const card = page.getByRole("article", {
    name: "Application: Backend Engineer at Acme",
  });
  await card.getByLabel("Application stage").selectOption("applied");
  await expect(page.getByRole("region", { name: "Applied" })).toContainText(
    "Backend Engineer",
  );
  await expect.poll(() => db.applications[0].stage).toBe("applied");
});

test("prompts for and saves a completed interview post-mortem", async ({
  page,
}) => {
  await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()], [interviewRow()]),
  );
  await page.getByRole("button", { name: "Mark completed" }).click();
  const reminder = page.getByText("Post-mortem needed within 24 hours", {
    exact: true,
  });
  await expect(reminder).toBeVisible();
  await page.getByLabel("Post-mortem notes").fill("Review graph edge cases");
  await page.getByRole("button", { name: "Save post-mortem" }).click();
  await expect(reminder).toHaveCount(0);
});

test("rolls back a failed application create", async ({ page }) => {
  const db = new FakeJobDb([companyRow()]);
  db.failNext("applications", "POST");
  await load(page, db);
  await page
    .getByRole("combobox", { name: "Company", exact: true })
    .selectOption("company");
  await page.getByLabel("Role title").fill("Doomed role");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect(page.getByText("Doomed role")).toHaveCount(0);
});
