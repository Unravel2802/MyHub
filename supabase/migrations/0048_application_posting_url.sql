-- Job CRM: the job posting's URL, for the table view's Link column
-- (docs/handoff/job-tracker-table.md). Nullable — plenty of applications
-- (referrals, recruiter outreach) never had a public posting.
--
-- The check constraint is a security boundary, not just tidiness: the UI
-- renders this value as an <a href>, so a `javascript:` or `data:` URL stored
-- here would execute on click. Only http(s) is accepted. The client normalises
-- input first (postingUrl.ts adds a missing `https://`, rejects anything else),
-- so this constraint should only ever fire on a bypassed client.

alter table applications
  add column posting_url text
    check (
      posting_url is null
      or (posting_url ~* '^https?://[^[:space:]]+$' and length(posting_url) <= 2048)
    );
