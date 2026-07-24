-- Adds optional total time spent to each LeetCode problem. This is stored on
-- the problem row alongside its notes and contributes to Prep time allocation.

alter table leetcode_problems
  add column time_min int;
