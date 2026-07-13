import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
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
