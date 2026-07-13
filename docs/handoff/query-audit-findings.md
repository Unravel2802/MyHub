# Repository Query Audit

Audit performed 2026-07-13. No RLS changes were made.

## Findings

- `src/modules/task/TaskRepository.ts:60-65`, `127-130`, `227-231`, and the related `select("*")` reads use broad projections. They are correct for their current callers, but narrower projections would reduce data exposure and make a future RLS retrofit easier.
- `src/modules/prep/PrepRepository.ts:118-120` and `171-173`, `src/modules/jobApplications/CompanyRepository.ts:46-48`, `src/modules/jobApplications/ApplicationRepository.ts:86-88`, `src/modules/jobApplications/InterviewRepository.ts:79-81`, and `src/modules/outreach/OutreachRepository.ts:63-65` use `select("*")` for list views. These include more columns than the list components generally need.
- `src/modules/task/TaskRepository.ts:246-257`, `396-405`, and `423-438` issue ancestor-walk queries one row at a time. These are the documented cascade/ancestor N+1 cases and are intentionally not proposed for change in this audit.

## No Findings

- Active UI list queries consistently filter `deleted_at` with `is(..., null)`.
- No repository performs a hard delete.
- No additional non-ancestor N+1 query pattern was found.
