# Handoff — Split a bill into "Owed to me" (Claude Code → Codex)

Follow-up to `finance-receivables.md`. You paid for something shared; enter the
people and the total, and everyone except you gets an "Owed to me" receivable
for their even share. Example: Hoang (me), Alex, Sam, $12 → Alex owes $4, Sam
owes $4, nothing is created for Hoang.

No migration — it writes ordinary `finance_receivables` rows.

## What's published (mine — don't change the interface)

- **`splitBill.ts`** (unit-tested in `splitBill.test.ts`)
  - `SplitParticipant = { name: string; isMe: boolean }`
  - `parseParticipants(text)` — splits free text on commas / newlines, trims,
    drops empties; pre-marks `me` / `myself` / `I` / `self` (any case) as you.
  - `isSelfAlias(name)`.
  - `planSplit(totalCents, participants)` returns either
    `{ ok: true, plan: { shares, myShareCents } }` or
    `{ ok: false, error: SplitError }`. Use it for the live preview. Leftover cents go to the OTHER people first, so you never get
    shorted ($10 / 3 → Alex $3.34, Sam $3.33, you $3.33). Every cent is
    accounted for.
  - `SplitError`: `invalid_total`, `no_one_else`, `multiple_me`, `blank_name`,
    `duplicate_name`, `total_too_small`.
- **`FinanceRepository.createReceivables(inputs[])`** — one INSERT, so a split
  is all-or-nothing.
- **`useFinanceStore.splitIntoReceivables(input)`**, where input is
  `{ totalCents, participants, reason?, dueOn? }`, returns
  `Promise<SplitError | null>`. Re-runs `planSplit`; on a
  planning error returns it and saves nothing. On success prepends the new
  receivables (status `not_requested`, shared reason/due date). A DB failure
  sets `store.error` (generic message) and returns `null` — same as every other
  action.

## What's yours

1. **"Split a bill" button** in `ReceivablesPanel`'s header actions, beside
   "Add money owed", opening a new `SplitBillDialog.tsx` (same Dialog /
   FormField / input styling as `ReceivableDialog`).
2. **Dialog fields:** Total (via `parseAmount`, block on null); People — a
   textarea or comma input parsed with `parseParticipants`; optional Reason;
   optional Due date.
3. **"Which one is you?"** — render the parsed people as a list with a radio
   (or a "This is me" toggle) per name, plus "I'm not part of this split". The
   user types their own name (e.g. "Hoang"), not just "me", so they must be
   able to mark any name as themself. Keep the user's choice when they edit
   the text, keyed by name; fall back to `parseParticipants`'s `isMe` for new
   names. Exactly one or zero marked.
4. **Live preview** from `planSplit`: each other person + `formatCents(share)`,
   and a muted "Your share: $X" line (not a receivable). On `ok: false` show a
   plain-English message per `SplitError` and disable submit.
5. **Submit** → `store.splitIntoReceivables(...)`; close on `null` (if
   `store.error` got set the panel already shows it). Button text e.g.
   "Add 2 people owing you".
6. **Tests** — a component test for the dialog (marking "Hoang" as me, preview
   shows $4.00 × 2, submit calls the store with the right participants), and
   extend the finance E2E: split $12 among Hoang (me), Alex, Sam → two $4.00
   rows appear under "Owed to me", none for Hoang.

## Notes

- Money is integer cents; `parseAmount` in, `formatCents` out.
- Don't re-implement the split math or the rounding in the component — call
  `planSplit`.
