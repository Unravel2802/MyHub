import type { Interview } from "@/src/modules/jobApplications/types";

// The interview lifecycle timestamp rules (myhub_plan.md Part B, Phase 4),
// pulled out of useApplicationStore so they're testable in isolation. The store
// owns these — not the repository — because deciding whether a transition
// happened requires knowing the PREVIOUS state, and the repository never sees
// it.

export function isPostMortemWritten(notes: string | null | undefined): boolean {
  return typeof notes === "string" && notes.trim().length > 0;
}

// What `post_mortem_logged_at` should be set to on an update, or `undefined`
// to leave the column alone entirely (which is different from setting it null).
//
// The rule: stamp it the FIRST time notes go empty -> non-empty, and never
// touch it again. Not on later edits, and not even if the notes are cleared
// back to empty — this records when you first wrote the post-mortem, and
// Phase 5's "post-mortem within 24h" achievement measures that instant against
// the interview's scheduledAt. A typo fix three days later must not
// retroactively cost you the unlock.
export function postMortemLoggedAtFor(
  current: Interview,
  nextNotes: string | null | undefined,
  now: string,
): string | undefined {
  if (current.postMortemLoggedAt !== null) return undefined;
  if (nextNotes === undefined) return undefined;
  if (isPostMortemWritten(current.postMortemNotes)) return undefined;
  return isPostMortemWritten(nextNotes) ? now : undefined;
}
