-- Design Drills: a 'coding_design' category for LeetCode-"Design"-tag-style
-- problems — implement a class whose operations hit stated complexities
-- (LRU-cache-shaped), as asked in Google SWE intern/new-grad coding rounds.
-- Distinct from 'system_design': no scale or distribution, the deliverable is
-- working code plus its invariants. Same bank / timed attempt / rubric /
-- editorial machinery (migrations 0024-0031), so this is a new enum label,
-- not a new module.
--
-- Postgres forbids using a new enum value in the same transaction it's added
-- in (see 0008), so this migration ONLY adds the label. The seed rows that use
-- it are 0045; apply this one first, as its own run in the SQL editor.

alter type design_drill_category add value if not exists 'coding_design';
