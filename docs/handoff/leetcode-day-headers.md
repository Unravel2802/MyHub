# Handoff — LeetCode table day headers (Claude → Codex)

When the LeetCode table is sorted by "Last attempted", group its rows under a
per-day summary header. The look is a match-history page's day strip: date on
the left, a few headline numbers on the right. **Claude published the grouping
logic below. Codex owns the header component, wiring it into the table, and
the tests for both.** Don't change the published function. If the UI needs
something it doesn't return, flag it.

## Published contract (landed by Claude)

`src/modules/leetcode/leetcodeBoard.ts`, pure and tested in
`leetcodeBoard.test.ts`:

- `groupByLastAttemptDay(problems, attempts, today) → LeetCodeDayGroup[]`
  - `problems`: the table's `visible` list, **already filtered and sorted**.
    Grouping never re-sorts. Groups come out in first-seen order, so the
    ascending/descending toggle carries through.
  - `attempts`: the table's `attempts` prop as-is.
  - `today`: the viewer's local date as `yyyy-MM-dd`, i.e.
    `format(new Date(), "yyyy-MM-dd")` from `date-fns`. Compute it in the
    component; the function never reads the clock.
- `LeetCodeDayGroup`: `date` (`yyyy-MM-dd` or `null`), `label` ("Today",
  "Yesterday", "Mon, Oct 6", the year appended only for other years, or
  "Not attempted"), `problems`, `byDifficulty`, `byStatus`, `timeMin`.
- `dayLabel(date, today)` is exported too, but you shouldn't need it
  directly.

**Counting rule (settled; don't redo it in the UI).** A problem appears only
under its _last_ attempted day. Every header number is computed from the rows
under that header. `timeMin` sums every sitting those problems logged on that
day. Problems hidden by the filters contribute nothing. Never-attempted
problems form a trailing "Not attempted" group with `timeMin` 0.

## What to build

1. **When to group.** Only when `sortKey === "lastAttempted"`. Every other
   sort renders the flat table exactly as today.
2. **Header row.** One full-width `<tr>` per group (`<td colSpan={6}>`) inside
   the existing `<tbody>`, placed before that group's rows. Keep it a table
   row, not a `<div>` between tables, so columns stay aligned and the sticky
   `<thead>` still works. Contents:
   - Left: `label`, plus the full date in muted text underneath when the
     label is "Today" or "Yesterday" (e.g. "Tue, Oct 7").
   - Middle: difficulty-mix chips using the existing `Badge` with
     `LEETCODE_DIFFICULTY_HUES`, e.g. "2 Medium". Skip zero counts.
   - Right: stat pairs, small muted label above a number. Problems
     (`problems.length`), Solved (`byStatus.solved`), To review
     (`byStatus.to_review + byStatus.needs_revisit`), and Time (`timeMin`
     shown as `74m` / `2h 10m`). Omit Time for the "Not attempted" group.
   - A left accent border: the module hue for the "Today" group, the plain
     border token for every other day.
3. **Collapsible.** Clicking the header toggles that group's rows. The header
   is a `<button aria-expanded>` inside the cell. Collapse state is local
   `useState` keyed by `date` and isn't persisted. All groups start expanded.
4. **Styling.** Semantic tokens and `cn()` only, matching the rest of the
   table (`bg-surface-subtle`, `text-muted`, `border-border`). No new
   dependencies.

Put the header in its own component file next to `LeetCodeTable.tsx`
(e.g. `LeetCodeDayHeader.tsx`). Keep `LeetCodeTable.tsx`'s change limited to
choosing grouped vs. flat rendering.

## Tests (Codex)

- Unit (`*.test.tsx`): the header renders the label, chips (no zero chips)
  and stats; Time is formatted; Time is hidden for "Not attempted"; the
  collapse toggle hides and shows its rows and flips `aria-expanded`.
- Table: sorting by any other column renders no day headers.
- E2E: on the Prep page's LeetCode table, problems attempted on two
  different days show two headers in the default sort. Flipping the sort
  direction reverses the group order.
