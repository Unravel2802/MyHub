-- Removes problem-level time, superseded by summing attempt-level time_to_solve_min where users actually log time.

alter table leetcode_problems
  drop column time_min;
