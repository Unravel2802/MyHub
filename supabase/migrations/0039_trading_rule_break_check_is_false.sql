-- Fixes a CHECK in migration 0038 that silently failed to reject.
--
-- The constraint was written as:
--
--   check (rule_break is null or rules_followed = false)
--
-- and the intent (stated in 0038's own comment and in types.ts) was that a
-- rule-break note requires rules_followed to be explicitly false. But
-- `rules_followed = false` is NULL — not FALSE — when rules_followed is NULL,
-- so the whole expression evaluated to `false OR NULL` = NULL, and a CHECK
-- constraint PASSES on NULL. It only rejects on FALSE.
--
-- So an unjudged entry could carry a rule-break note: "I haven't decided whether
-- I followed the rules" and "here is the rule I broke", on the same row. That is
-- incoherent, and it would have quietly skewed the compliance stat's denominator
-- against rows that visibly contradict themselves.
--
-- `IS FALSE` returns TRUE or FALSE and never NULL, so the NULL case now
-- evaluates to `false OR false` = FALSE and is rejected as intended.
--
-- Caught by src/modules/trading/TradingRepository.db.test.ts, which asserts the
-- constraint REJECTS rather than only that the happy path works — exactly the
-- class of silently-passing bug docs/db-integration-tests.md exists for. A new
-- migration rather than an edit to 0038, because 0038 has already been applied.

alter table trading_entries
  drop constraint trading_entries_rule_break_needs_a_break;

alter table trading_entries
  add constraint trading_entries_rule_break_needs_a_break check (
    rule_break is null or rules_followed is false
  );
