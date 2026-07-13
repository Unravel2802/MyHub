import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

process.loadEnvFile(".env.local");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl)
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for UI auth fixtures");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;
const fakeSession = {
  access_token:
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1aS10ZXN0Iiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.",
  refresh_token: "ui-test-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: "ui-test-user",
    aud: "authenticated",
    role: "authenticated",
    email: "ui@example.test",
  },
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ key, session }) =>
        window.localStorage.setItem(key, JSON.stringify(session)),
      { key: authStorageKey, session: fakeSession },
    );
    await page.route("**/auth/v1/**", async (route) => {
      if (route.request().url().includes("/token")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fakeSession),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
    await page.route("**/rest/v1/**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }

      await route.fulfill({
        status: method === "POST" ? 201 : 204,
        contentType: "application/json",
        body: method === "POST" ? "[]" : "",
      });
    });

    // Playwright's fixture callback is not a React component, despite the
    // callback parameter using the same name as a hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});
