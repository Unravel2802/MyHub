import type { Page } from "@playwright/test";

// In-memory stand-in for the reader_documents / reader_annotations REST
// endpoints AND the Storage bucket, so the reader can be driven end-to-end
// without a real Supabase.
//
// Storage is mocked at the network layer too (`/storage/v1/**`): the upload
// POST, the sign POST, and the GET that actually serves the bytes. The bytes
// come from tests/ui/fixtures/sample.pdf, so PDF.js does real parsing and real
// text-layer rendering — mocking the PDF itself would leave the one thing this
// module exists to do (select text on a rendered page) untested.

export interface ReaderDocumentRow {
  id: string;
  title: string;
  storage_path: string;
  page_count: number | null;
  size_bytes: number;
  last_page_read: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReaderAnnotationRow {
  id: string;
  document_id: string;
  page_number: number;
  kind: "highlight" | "comment";
  selected_text: string;
  comment: string | null;
  hue: string;
  rects: unknown;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const STAMP = "2026-08-11T00:00:00.000Z";

export function readerDocumentRow(
  overrides: Partial<ReaderDocumentRow> &
    Pick<ReaderDocumentRow, "id" | "title" | "storage_path">,
): ReaderDocumentRow {
  return {
    page_count: null,
    size_bytes: 693,
    last_page_read: 1,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export class FakeReaderDb {
  documents: ReaderDocumentRow[];
  annotations: ReaderAnnotationRow[] = [];

  constructor(documents: ReaderDocumentRow[] = []) {
    this.documents = documents;
  }
}

function matches(row: Record<string, unknown>, url: URL): boolean {
  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const [op, ...rest] = raw.split(".");
    const value = rest.join(".");
    const actual = row[key];
    if (op === "eq" && String(actual) !== value) return false;
    if (op === "is" && value === "null" && actual !== null) return false;
  }
  return true;
}

export async function mockSupabaseReader(
  page: Page,
  db: FakeReaderDb,
  pdfBytes: Buffer,
) {
  // --- Storage -------------------------------------------------------------
  await page.route("**/storage/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    // Signing a URL for a private object. Returns a path this same handler
    // serves below, so the viewer's fetch stays inside the mock.
    if (url.pathname.includes("/object/sign/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signedURL: `/storage/v1/object/authenticated/reader-documents/mock.pdf?token=test`,
        }),
      });
      return;
    }

    // Serving the bytes.
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: pdfBytes,
      });
      return;
    }

    // Upload.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ Key: "reader-documents/uploaded.pdf" }),
    });
  });

  // --- Tables --------------------------------------------------------------
  await page.route("**/rest/v1/reader_*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const table = url.pathname.split("/").pop();
    const rows: Record<string, unknown>[] =
      table === "reader_documents"
        ? (db.documents as unknown as Record<string, unknown>[])
        : (db.annotations as unknown as Record<string, unknown>[]);

    const wantsObject = (request.headers()["accept"] ?? "").includes(
      "vnd.pgrst.object",
    );
    const respond = async (result: Record<string, unknown>[]) =>
      route.fulfill({
        status: method === "POST" ? 201 : 200,
        contentType: "application/json",
        body: JSON.stringify(wantsObject ? (result[0] ?? null) : result),
      });

    if (method === "GET") {
      await respond(rows.filter((row) => matches(row, url)));
      return;
    }

    if (method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const created = {
        id: crypto.randomUUID(),
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Column defaults the DB would apply.
        ...(table === "reader_documents"
          ? { page_count: null, last_page_read: 1 }
          : { comment: null, hue: "amber" }),
        ...payload,
      };
      rows.push(created);
      await respond([created]);
      return;
    }

    if (method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const targets = rows.filter((row) => matches(row, url));
      for (const target of targets)
        Object.assign(target, payload, {
          updated_at: new Date().toISOString(),
        });
      if (!url.searchParams.has("select")) {
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await respond(targets);
      return;
    }

    await route.fulfill({ status: 405, body: "" });
  });
}
