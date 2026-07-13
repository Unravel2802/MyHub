import { expect, test } from "./fixtures";

const projectRef = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    (key) => window.localStorage.removeItem(key),
    authStorageKey,
  );
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("failed login shows a generic error", async ({ page }) => {
  await page.route("**/auth/v1/token*", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("wrong@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("Unable to sign in. Check your credentials and try again."),
  ).toBeVisible();
  await expect(page.getByText("Invalid login credentials")).toHaveCount(0);
});

test("getSession resolves from the derived storage key", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/\/login$/);
  const stored = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    authStorageKey,
  );
  expect(JSON.parse(stored ?? "null")).toMatchObject({
    user: { id: "ui-test-user" },
    access_token: expect.any(String),
  });
});
