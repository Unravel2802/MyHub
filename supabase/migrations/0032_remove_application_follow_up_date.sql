-- Job CRM: drop the explicit follow-up date. It read as too vague in practice
-- (a date the user had to remember to set, disconnected from actual pipeline
-- activity) and duplicated the staleness signal the Dashboard's "needs
-- follow-up" panel already derives from `last_update_date`. The panel keeps
-- working off that "7+ days since last update" fallback alone
-- (dashboardSelectors.ts's applicationsNeedingFollowUp loses its
-- follow-up-date OR-branch in the same change).

drop index if exists applications_follow_up_idx;

alter table applications drop column if exists follow_up_date;
