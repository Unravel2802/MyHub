import { expect, test } from "./fixtures";
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
    page.getByRole("heading", { name: "Applications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Applications table" }),
  ).toHaveAttribute("aria-busy", "false");
  return db;
}

test("quick-adds a company and application without separate company setup", async ({
  page,
}) => {
  const db = await load(page);
  const form = page.getByRole("form", { name: "New application" });
  await form.getByLabel("Company", { exact: true }).fill("OpenAI");
  await form.getByLabel("Role title").fill("Backend Engineer");
  await form.getByRole("button", { name: "Add application" }).click();
  await expect(
    page.getByRole("row", { name: "Application: Backend Engineer at OpenAI" }),
  ).toBeVisible();
  await expect
    .poll(() => db.applications[0])
    .toMatchObject({ role_title: "Backend Engineer", stage: "researching" });
  expect(db.companies).toHaveLength(1);
  await expect(form.getByLabel("Role title")).toHaveValue("");
});

test("reuses an existing company regardless of letter case", async ({
  page,
}) => {
  const db = await load(page, new FakeJobDb([companyRow()]));
  await page
    .getByRole("form", { name: "New application" })
    .getByLabel("Company", { exact: true })
    .fill("acme");
  await page.getByLabel("Role title", { exact: true }).fill("New role");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect.poll(() => db.applications.length).toBe(1);
  expect(db.companies).toHaveLength(1);
  expect(db.applications[0].company_id).toBe("company");
});

test("edits a table row and persists role, status, date and multiline notes", async ({
  page,
}) => {
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()]),
  );
  await page.getByLabel("Role at Acme").fill("Platform Engineer");
  await page.getByLabel("Role at Acme").press("Enter");
  await expect
    .poll(() => db.applications[0].role_title)
    .toBe("Platform Engineer");
  await page
    .getByLabel("Application stage for Platform Engineer at Acme")
    .selectOption("applied");
  await expect.poll(() => db.applications[0].stage).toBe("applied");
  await page
    .getByLabel("Applied date for Platform Engineer at Acme")
    .fill("2026-11-02");
  await page
    .getByLabel("Applied date for Platform Engineer at Acme")
    .press("Enter");
  await expect.poll(() => db.applications[0].applied_date).toBe("2026-11-02");
  await page
    .getByLabel("Notes for Platform Engineer at Acme", { exact: true })
    .fill("Referral from Alex\nFollow up Friday");
  await page
    .getByLabel("Notes for Platform Engineer at Acme", { exact: true })
    .press("Tab");
  await expect
    .poll(() => db.applications[0].notes)
    .toBe("Referral from Alex\nFollow up Friday");
  await page.reload();
  await expect(
    page.getByLabel("Notes for Platform Engineer at Acme", { exact: true }),
  ).toHaveValue("Referral from Alex\nFollow up Friday");
});

test("distinguishes fields for the same role at different companies", async ({
  page,
}) => {
  await load(
    page,
    new FakeJobDb(
      [companyRow(), companyRow({ id: "other-company", name: "Other Co" })],
      [
        applicationRow(),
        applicationRow({
          id: "other-application",
          company_id: "other-company",
        }),
      ],
    ),
  );
  for (const company of ["Acme", "Other Co"]) {
    const application = `Backend Engineer at ${company}`;
    for (const field of ["Application stage", "Applied date", "Notes"]) {
      await expect(
        page.getByLabel(`${field} for ${application}`, { exact: true }),
      ).toHaveCount(1);
    }
    await page
      .getByRole("row", { name: `Application: ${application}`, exact: true })
      .getByRole("button", { name: "Details", exact: true })
      .click();
    for (const field of ["Resume", "Referral source"]) {
      await expect(
        page.getByLabel(`${field} for ${application}`, { exact: true }),
      ).toBeVisible();
    }
  }
});

test("restores a failed inline save and lets Escape cancel a draft", async ({
  page,
}) => {
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()]),
  );
  const role = page.getByLabel("Role at Acme");
  await role.fill("Cancelled edit");
  await role.press("Escape");
  await role.press("Tab");
  await expect(role).toHaveValue("Backend Engineer");
  expect(db.applications[0].role_title).toBe("Backend Engineer");
  db.failNext("applications", "PATCH");
  await role.fill("Failed edit");
  await role.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Something went wrong" }),
  ).toHaveText("Something went wrong, please try again later.");
  await expect(role).toHaveValue("Backend Engineer");
});

test("keeps the quick-add draft when application creation fails", async ({
  page,
}) => {
  const db = new FakeJobDb([companyRow()]);
  db.failNext("applications", "POST");
  await load(page, db);
  await page
    .getByRole("form", { name: "New application" })
    .getByLabel("Company", { exact: true })
    .fill("Acme");
  await page.getByLabel("Role title", { exact: true }).fill("Doomed role");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Something went wrong" }),
  ).toHaveText("Something went wrong, please try again later.");
  await expect(
    page.getByRole("row", { name: "Application: Doomed role at Acme" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue(
    "Doomed role",
  );
  await page.getByRole("button", { name: "Add application" }).click();
  await expect.poll(() => db.applications.length).toBe(1);
});

test("does not create an application when company creation fails", async ({
  page,
}) => {
  const db = new FakeJobDb();
  db.failNext("companies", "POST");
  await load(page, db);
  await page
    .getByRole("form", { name: "New application" })
    .getByLabel("Company", { exact: true })
    .fill("New company");
  await page.getByLabel("Role title", { exact: true }).fill("New role");
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Something went wrong" }),
  ).toBeVisible();
  expect(db.applications).toHaveLength(0);
  await expect(page.getByLabel("Role title", { exact: true })).toHaveValue(
    "New role",
  );
});

test("keeps interviews tucked away and saves a completed interview post-mortem", async ({
  page,
}) => {
  await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()], [interviewRow()]),
  );
  await expect(
    page.getByRole("button", { name: "Mark completed" }),
  ).not.toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Interviews/ })
    .click();
  await page.getByRole("button", { name: "Mark completed" }).click();
  const reminder = page.getByText("Post-mortem needed within 24 hours", {
    exact: true,
  });
  await expect(reminder).toBeVisible();
  await page.getByLabel("Post-mortem notes").fill("Review graph edge cases");
  await page.getByRole("button", { name: "Save post-mortem" }).click();
  await expect(reminder).toHaveCount(0);
});

test("saves a rejection takeaway from row details while preserving existing notes", async ({
  page,
}) => {
  const db = await load(
    page,
    new FakeJobDb(
      [companyRow()],
      [applicationRow({ stage: "applied", notes: "Existing note" })],
    ),
  );
  await page
    .getByLabel("Application stage for Backend Engineer at Acme")
    .selectOption("rejected");
  await expect.poll(() => db.applications[0].stage).toBe("rejected");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page
    .getByLabel("Rejection takeaway")
    .fill("Ask for a concrete API example");
  await page.getByRole("button", { name: "Save takeaway" }).click();
  await expect(page.getByLabel("Rejection takeaway")).toHaveCount(0);
  await expect
    .poll(() => db.applications[0].notes)
    .toBe("Existing note\nRejection takeaway: Ask for a concrete API example");
});

test("shows funnel statistics on demand with null-safe rates", async ({
  page,
}) => {
  await load(
    page,
    new FakeJobDb(
      [companyRow()],
      [applicationRow({ id: "researching", stage: "researching" })],
    ),
  );
  await page
    .locator("summary")
    .filter({ hasText: "Funnel statistics" })
    .click();
  const funnel = page.getByRole("region", { name: "Funnel snapshot" });
  await expect(funnel).toBeVisible();
  await expect(funnel.getByText("—")).toHaveCount(3);
  await expect(funnel.getByText("Researching", { exact: true })).toBeVisible();
  await expect(funnel.getByText("OA", { exact: true })).toBeVisible();
});

test("keeps a populated table and expanded details within the mobile page", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(
    page,
    new FakeJobDb(
      [companyRow()],
      [
        applicationRow({
          posting_url:
            "https://careers.a-long-company-name.example.com/jobs/view/42",
        }),
      ],
    ),
  );
  await expect
    .poll(() => page.evaluate(() => document.body.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.body.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("applications-table.png"),
    fullPage: true,
  });
});

test("normalizes a pasted posting link, renders its hostname, and clears it", async ({
  page,
}) => {
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()]),
  );
  const url = "https://linkedin.com/jobs/view/42";
  const cell = page.getByLabel("Link for Backend Engineer at Acme", {
    exact: true,
  });
  await cell.fill("linkedin.com/jobs/view/42");
  await cell.press("Tab");
  await expect.poll(() => db.applications[0].posting_url).toBe(url);
  const link = page.getByRole("link", { name: "linkedin.com", exact: true });
  await expect(link).toHaveAttribute("href", url);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await page.reload();
  await expect(link).toHaveAttribute("href", url);
  await page
    .getByRole("button", { name: /Edit link for Backend Engineer at Acme/i })
    .click();
  await expect(cell).toHaveValue(url);
  await cell.fill("");
  await cell.press("Enter");
  await expect.poll(() => db.applications[0].posting_url).toBeNull();
  await expect(link).toHaveCount(0);
  await expect(cell).toHaveValue("");
});

test("rejects unsafe posting links locally and preserves the draft for correction", async ({
  page,
}) => {
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow()]),
  );
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith("/applications")
    )
      writes.push(request.postData() ?? "");
  });
  const cell = page.getByLabel("Link for Backend Engineer at Acme", {
    exact: true,
  });
  await cell.fill("javascript:alert(1)");
  await cell.press("Tab");
  const error = page.getByText("Enter a web address, e.g. https://…", {
    exact: true,
  });
  await expect(error).toBeVisible();
  await expect(cell).toHaveValue("javascript:alert(1)");
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  await expect(cell).toHaveAttribute(
    "aria-describedby",
    (await error.getAttribute("id"))!,
  );
  expect(db.applications[0].posting_url).toBeNull();
  expect(writes).toHaveLength(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await cell.fill("linkedin.com/jobs/view/42");
  await cell.press("Enter");
  await expect
    .poll(() => db.applications[0].posting_url)
    .toBe("https://linkedin.com/jobs/view/42");
  await expect(error).toHaveCount(0);
  expect(writes.map((body) => JSON.parse(body).posting_url)).toEqual([
    "https://linkedin.com/jobs/view/42",
  ]);
});

test("does not resave an unchanged posting link and restores a failed edit", async ({
  page,
}) => {
  const url = "https://linkedin.com/jobs/view/42";
  const db = await load(
    page,
    new FakeJobDb([companyRow()], [applicationRow({ posting_url: url })]),
  );
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname.endsWith("/applications")
    )
      writes.push(request.postData() ?? "");
  });
  const edit = page.getByRole("button", {
    name: /Edit link for Backend Engineer at Acme/i,
  });
  const cell = page.getByLabel("Link for Backend Engineer at Acme", {
    exact: true,
  });
  await edit.click();
  await cell.fill("linkedin.com/jobs/view/42");
  await cell.press("Enter");
  await expect(
    page.getByRole("link", { name: "linkedin.com", exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  db.failNext("applications", "PATCH");
  await edit.click();
  await cell.fill("https://jobs.example.com/other");
  await cell.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Something went wrong" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "linkedin.com", exact: true }),
  ).toHaveAttribute("href", url);
  expect(db.applications[0].posting_url).toBe(url);
});
