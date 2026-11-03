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
      expect(html).toMatch(/aria-label="Application stage"[^>]*disabled=""/);
    }
  });
});
