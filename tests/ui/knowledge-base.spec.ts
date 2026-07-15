import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type LinkRow = {
  id: string;
  source_note_id: string;
  target_note_id: string;
  deleted_at: string | null;
  created_at: string;
};

function mockNotes(page: Page) {
  const notes: NoteRow[] = [];
  const links: LinkRow[] = [];
  let noteSequence = 0;
  let linkSequence = 0;

  return page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const now = new Date().toISOString();

    if (table === "notes") {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(notes.filter((note) => !note.deleted_at)),
        });
        return;
      }
      if (request.method() === "POST") {
        const input = request.postDataJSON() as { title: string; body: string };
        const note: NoteRow = {
          id: `note-${++noteSequence}`,
          title: input.title,
          body: input.body ?? "",
          deleted_at: null,
          created_at: now,
          updated_at: now,
        };
        notes.unshift(note);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(note),
        });
        return;
      }
      if (request.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const input = request.postDataJSON() as Partial<NoteRow>;
        const note = notes.find((item) => item.id === id);
        if (note) Object.assign(note, input, { updated_at: now });
        await route.fulfill({ status: 204, body: "" });
        return;
      }
    }

    if (table === "note_links") {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(links.filter((link) => !link.deleted_at)),
        });
        return;
      }
      if (request.method() === "POST") {
        const input = request.postDataJSON() as {
          source_note_id: string;
          target_note_id: string;
        };
        const link: LinkRow = {
          id: `link-${++linkSequence}`,
          ...input,
          deleted_at: null,
          created_at: now,
        };
        links.push(link);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(link),
        });
        return;
      }
      if (request.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace("eq.", "");
        const link = links.find((item) => item.id === id);
        if (link) link.deleted_at = now;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
    }

    await route.continue();
  });
}

test("links two notes bidirectionally and removes the link from both sides", async ({
  page,
}) => {
  await mockNotes(page);
  await page.goto("/notes");

  await page.getByLabel("Title").fill("Alpha note");
  await page.getByLabel("Body").fill("The first idea");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page.getByText("Alpha note", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Title").fill("Beta note");
  await page.getByLabel("Body").fill("The connected idea");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page.getByText("Beta note", { exact: true })).toBeVisible();

  await page
    .getByRole("region", { name: "Your notes" })
    .getByRole("button", { name: /Alpha note/ })
    .click();
  await page.getByPlaceholder("Search titles and bodies").fill("Beta");
  await page.getByRole("button", { name: "Beta note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Linked notes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beta note", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Your notes" })
    .getByRole("button", { name: /Beta note/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Alpha note", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Unlink" }).click();
  await expect(
    page.getByText("No links yet. Connect this note to another idea below."),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Your notes" })
    .getByRole("button", { name: /Alpha note/ })
    .click();
  await expect(
    page.getByText("No links yet. Connect this note to another idea below."),
  ).toBeVisible();
});
