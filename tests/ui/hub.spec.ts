import { expect, test } from "./fixtures";

test("renders mini-app and core-tool destinations", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Open Career" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  await expect(page.getByRole("link", { name: "Open Money" })).toHaveAttribute(
    "href",
    "/finance",
  );
  await expect(
    page.getByRole("link", { name: "Open Task Engine" }),
  ).toHaveAttribute("href", "/tasks");
  await expect(
    page.getByRole("link", { name: "Open Knowledge Base" }),
  ).toHaveAttribute("href", "/notes");
});
