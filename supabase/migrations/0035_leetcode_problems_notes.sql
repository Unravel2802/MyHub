-- Adds optional problem-level notes to the LeetCode problem bank. These are
-- distinct from per-attempt notes, which remain on leetcode_attempts.

alter table leetcode_problems
  add column notes text;
