-- Replaces leetcode_problems.url with question_number: the user wants to key
-- problems by LeetCode's own problem number (e.g. 1 for "Two Sum") rather
-- than paste a link. int, nullable — same optionality url had.

alter table leetcode_problems
  drop column url;

alter table leetcode_problems
  add column question_number int;
