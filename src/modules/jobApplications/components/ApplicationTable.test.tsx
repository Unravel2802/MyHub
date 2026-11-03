import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApplicationTable } from "./ApplicationTable";
import type { Application } from "@/src/modules/jobApplications/types";

const application: Application = {
  id: "application",
  companyId: "deleted-company",
  roleTitle: "Backend Engineer",
  resumeVariant: "swe_backend",
  stage: "phone_screen",
  appliedDate: null,
  lastUpdateDate: "2026-11-02",
  referralSource: null,
  postingUrl: null,
  notes: "First line\nSecond line",
  deletedAt: null,
  createdAt: "2026-11-02",
  updatedAt: "2026-11-02",
};
function render(item = application, pendingIds = new Set<string>()) {
  return renderToStaticMarkup(
    <ApplicationTable
      applications={[item]}
      companies={[]}
      pendingIds={pendingIds}
      isLoading={false}
      onUpdate={vi.fn()}
      onStageChange={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe("ApplicationTable", () => {
  it("renders a safe external posting link with its hostname and edit control", () => {
    const html = render({
      ...application,
      postingUrl: "https://linkedin.com/jobs/view/42",
    });
    expect(html).toContain('href="https://linkedin.com/jobs/view/42"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(">linkedin.com</span>");
    expect(html).toContain(
      'aria-label="Edit link for Backend Engineer at Unknown company"',
    );
  });
  it("renders an editable empty cell and never links an unsafe stored value", () => {
    for (const postingUrl of [null, "javascript:alert(1)"]) {
      const html = render({ ...application, postingUrl });
      expect(html).toContain(
        'aria-label="Link for Backend Engineer at Unknown company"',
      );
      expect(html).not.toContain("<a ");
    }
  });
  it("keeps historical applications visible when their company was deleted", () => {
    const html = render();
    expect(html).toContain(
      'aria-label="Application: Backend Engineer at Unknown company"',
    );
    expect(html).toContain('value="phone_screen" selected=""');
    expect(html).toContain("Phone screen");
  });
  it("preserves multiline notes in a textarea and nullable dates as empty cells", () => {
    const html = render();
    for (const field of ["Application stage", "Applied date", "Notes"]) {
      expect(html).toContain(
        `aria-label="${field} for Backend Engineer at Unknown company"`,
      );
    }
    expect(html).toContain("First line\nSecond line</textarea>");
    expect(html).toMatch(/type="date" value=""/);
  });
  it("disables field edits while a row is pending or still optimistic", () => {
    for (const html of [
      render(application, new Set([application.id])),
      render({ ...application, id: "optimistic-new" }),
    ]) {
      expect(html).toMatch(
        /aria-label="Role at Unknown company"[^>]*disabled=""/,
      );
      expect(html).toMatch(
        /aria-label="Application stage for Backend Engineer at Unknown company"[^>]*disabled=""/,
      );
    }
  });
});
