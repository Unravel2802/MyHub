import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import {
  FakeReaderDb,
  mockSupabaseReader,
  readerDocumentRow,
} from "./supabaseReaderMock";

// process.cwd(), not import.meta.dirname: `import.meta` forces this file to
// be treated as ESM, which breaks Playwright's CJS test loader. Playwright
// always runs from the repo root.
const PDF_BYTES = readFileSync(
  path.join(process.cwd(), "tests/ui/fixtures/sample.pdf"),
);

// Anything that waits on PDF.js gets this instead of the 10s default. The
// /reader route cold-compiles under Turbopack AND pulls a ~1.2MB worker plus
// the pdfjs library before a single glyph appears; with four Playwright
// workers competing for CPU that legitimately exceeds 10s, which made this
// spec pass alone and fail in the full suite. A generous ceiling on the
// PDF-dependent waits only — a genuinely broken viewer still fails, just
// later. The global expect timeout is deliberately left alone so the other
// 130 tests keep failing fast.
const PDF_READY = { timeout: 45_000 };

// The library row's open button and its "Remove X" button both contain the
// title, so the name is anchored to exclude the latter.
function openDocument(page: import("@playwright/test").Page) {
  return page
    .getByRole("button", { name: /^Attention Is All You Need/ })
    .click();
}

function dbWithOneDocument() {
  return new FakeReaderDb([
    readerDocumentRow({
      id: "doc-1",
      title: "Attention Is All You Need",
      storage_path: "doc-1.pdf",
    }),
  ]);
}

test("renders a real PDF's text layer and records its page count", async ({
  page,
}) => {
  const db = dbWithOneDocument();
  await mockSupabaseReader(page, db, PDF_BYTES);

  await page.goto("/reader");
  await openDocument(page);

  // The text layer is what makes highlighting possible at all — if PDF.js
  // rendered only the canvas, this text would not exist in the DOM.
  await expect(
    page.locator(".pdf-text-layer").getByText("Attention Is All You Need"),
  ).toBeVisible(PDF_READY);
  await expect(page.getByText("1 / 1")).toBeVisible(PDF_READY);

  // Page count is written back once PDF.js reports it.
  await expect.poll(() => db.documents[0].page_count, PDF_READY).toBe(1);
});

test("select-to-highlight persists and survives a reload at the same position", async ({
  page,
}) => {
  const db = dbWithOneDocument();
  await mockSupabaseReader(page, db, PDF_BYTES);

  await page.goto("/reader");
  await openDocument(page);

  const target = page
    .locator(".pdf-text-layer")
    .getByText("Attention Is All You Need");
  await expect(target).toBeVisible(PDF_READY);

  // A real browser selection over the rendered text layer, so the geometry
  // under test is the geometry the user would produce.
  await target.selectText();
  await target.dispatchEvent("mouseup");

  await page.getByRole("button", { name: "Highlight amber" }).click();

  await expect.poll(() => db.annotations.length, PDF_READY).toBe(1);
  const saved = db.annotations[0];
  expect(saved.selected_text).toContain("Attention");
  expect(saved.page_number).toBe(1);
  expect(saved.hue).toBe("amber");

  // The contract's core invariant: coordinates are NORMALIZED 0-1, never
  // pixels. A pixel value here means highlights will scatter at another zoom
  // or window size — the exact failure annotationGeometry.ts exists to prevent.
  const rects = saved.rects as {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  expect(rects.length).toBeGreaterThan(0);
  for (const rect of rects) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x).toBeLessThanOrEqual(1);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeLessThanOrEqual(1);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.width).toBeLessThanOrEqual(1);
  }

  // It shows up in the sidebar...
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible(
    PDF_READY,
  );

  // ...and survives a reload, drawn from the stored normalized rects.
  await page.reload();
  await openDocument(page);
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible(
    PDF_READY,
  );
  expect(db.annotations).toHaveLength(1);
});

test("adding a note turns a highlight into a comment", async ({ page }) => {
  const db = dbWithOneDocument();
  db.annotations.push({
    id: "ann-1",
    document_id: "doc-1",
    page_number: 1,
    kind: "highlight",
    selected_text: "The dominant sequence transduction models",
    comment: null,
    hue: "amber",
    rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.02 }],
    deleted_at: null,
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: "2026-08-11T00:00:00.000Z",
  });
  await mockSupabaseReader(page, db, PDF_BYTES);

  await page.goto("/reader");
  await openDocument(page);

  await page.getByRole("button", { name: "Add note" }).click(PDF_READY);
  await page.getByLabel("Note").fill("This is the core claim.");
  await page.getByRole("button", { name: "Save" }).click();

  await expect.poll(() => db.annotations[0].comment).toContain("claim");
  // kind is DERIVED from whether a note exists — the two can never disagree.
  await expect.poll(() => db.annotations[0].kind).toBe("comment");
});

test("rejects a non-PDF before uploading anything", async ({ page }) => {
  const db = new FakeReaderDb();
  await mockSupabaseReader(page, db, PDF_BYTES);

  await page.goto("/reader");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });

  await expect(
    page.getByText("Only PDF files can be added to the reader."),
  ).toBeVisible();
  expect(db.documents).toHaveLength(0);
});
