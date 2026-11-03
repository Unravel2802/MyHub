# Job tracker: table-first UI

The approved Notion-style mockup is implemented using the existing application store contract. The main view shows company, role, status, applied date, and notes. Interviews, funnel statistics, and company management are collapsed; row details retain resume, referral, rejection takeaway, and deletion controls.

Quick add reuses a company by case-insensitive name or creates it through the existing store action before creating the application. New companies default to Match, and new applications default to Researching with the SWE / Backend resume. Company management retains the full company form (including tier), and resume is editable through row details. A failed create retains the draft; a company created before a failed application remains available for retry.

## Contract gaps for Claude Code

- The approved mockup includes a job-posting Link column. No URL field exists in Application, CreateApplicationInput, UpdateApplicationInput, or the database contract. The UI omits that column until Claude publishes the field and migration. URLs are not stuffed into another field.
- Company is displayed as a row label. Reassigning an application to another company is not supported by UpdateApplicationInput. Company management retains the existing creation and deletion controls.

No schema, repository, store, event, or domain logic changes are included.
