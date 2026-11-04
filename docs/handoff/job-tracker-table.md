# Job tracker: table-first UI

The approved Notion-style mockup is implemented using the existing application store contract. The main view shows company, role, status, applied date, and notes. Interviews and funnel statistics are collapsed; row details retain resume, referral, rejection takeaway, and deletion controls.

Quick add reuses a company by case-insensitive name or creates it through the existing store action before creating the application. New companies default to Match, and new applications default to Researching with the SWE / Backend resume. Resume is editable through row details. The separate company-management section was removed 2026-11-04 at the user's request: companies are only ever created implicitly by quick add, and the store's `createCompany`/`deleteCompany` contract is unchanged. A failed create retains the draft; a company created before a failed application remains available for retry.

## Contract gaps for Claude Code

- ~~The approved mockup includes a job-posting Link column. No URL field exists in the contract.~~ **Published 2026-11-02** — see "Link column (for Codex)" below.
- Company is displayed as a row label. Reassigning an application to another company is not supported by UpdateApplicationInput.

No schema, repository, store, event, or domain logic changes are included.

## Link column (for Codex)

The contract now has the posting URL. Migration `0048_application_posting_url.sql` adds a nullable `applications.posting_url`. Apply it before deploying the UI.

- **Contract:** `Application.postingUrl: string | null`, and `postingUrl?: string | null` on both `CreateApplicationInput` and `UpdateApplicationInput`. The repository and the store's optimistic row already handle it, and `store.updateApplication(id, { postingUrl })` works with no store changes.
- **Normalise before saving:** always pass user input through `normalizePostingUrl(raw)` from `src/modules/jobApplications/postingUrl.ts`. Never pass raw text. The function returns `{ ok: true, value }`, where `value: null` means the cell was cleared, or `{ ok: false }` for input that can't be accepted. A bare host such as `linkedin.com/jobs/...` gets `https://` added. Only http(s) is accepted.
- **Why the normaliser is required:** the value is rendered as an `<a href>`, so a `javascript:` URL would run on click. The DB check constraint rejects anything that isn't http(s), so skipping the normaliser turns an invalid paste into a generic save failure instead of a helpful message.
- **What to build:**
  - A Link column in `ApplicationTable` between Applied and Notes, with a column width you rebalance.
  - The cell shows an external link (`target="_blank" rel="noopener noreferrer"`, `lucide-react` `ExternalLink` icon, the hostname as text) plus an edit affordance. When empty, it shows an editable cell like the others.
  - On `{ ok: false }`, keep the draft and show an inline field error ("Enter a web address, e.g. https://…"). Don't call `onUpdate`.
  - Optional: a third Link field in `QuickAddApplication`. If you add it, `quickCreate` passes `postingUrl` to `createApplication`.
- **E2E (extend `tests/ui/job-crm.spec.ts`):**
  - A pasted bare host saves as `https://…` and renders a link.
  - Clearing the cell stores `null`.
  - `javascript:alert(1)` shows the field error, never reaches `db.applications`, and leaves no `<a>` with that href.
  - `FakeJobDb` rows already include `posting_url: null`.

## Stage rework (2026-11-04)

Migration `0049_application_stage_rework.sql` changes `application_stage` to
`researching → applied → oa → interview → onsite → awaiting_result → offer → rejected`.
`phone_screen` was renamed to `interview`, `awaiting_result` ("Waiting for result") is new, and
`withdrawn` was removed. Existing withdrawn rows were converted to `rejected`. `awaiting_result`
counts as a response in the funnel and is _not_ terminal, so a stale one still shows in the
dashboard's follow-up list. Older docs (`myhub_plan.md` §2.3, `docs/color-refresh.md`) describe the
original eight stages and are left as a record.
