---
title: Git and version control
minutes: 18
summary: Commits as a DAG, and the mental model that makes rebase, bisect, and recovering from a mistake stop feeling like magic.
---

Most Git confusion comes from treating commands as a memorized incantation
list instead of operations on a specific data structure. Once the structure
is clear — a directed acyclic graph of commits, each pointing at its
parent(s) — nearly every command's behavior follows from it directly.

## The DAG

```text
  A commit is a snapshot, plus a pointer to its parent(s),
  plus metadata (author, message, timestamp).

    C1 ← C2 ← C3 ← C4        (main)
                    ↖
                     C5 ← C6  (feature)

  a BRANCH is just a movable pointer to one commit — not a
  copy of the code, not a separate timeline stored elsewhere.
  "creating a branch" is creating a pointer; nothing about
  the commits themselves changes.
```

```text
  HEAD is a pointer to "the branch you're currently on" (or,
  in "detached HEAD" state, directly to a commit) — checking
  out a branch moves HEAD to point at that branch's pointer.
```

## Merge vs rebase

```text
  MERGE                              REBASE

  C1←C2←C3←────┐                    C1←C2←C3←C5'←C6'
              C4(merge)                          (main, feature)
  C1←C4'←C5'←C6'   (feature)
       ↖
        (main's C2,C3 preserved
         as-is; a merge commit
         ties the histories
         together)

  → preserves exactly what        → REWRITES feature's commits
    happened, when                  onto main's current tip —
                                    a linear history, but the
                                    ORIGINAL commits (C5, C6)
                                    are gone, replaced by new
                                    ones (C5', C6') with new
                                    hashes
```

```text
  the rule that matters: NEVER rebase commits that have been
  pushed and that someone else might have already based work
  on. rebasing rewrites history — anyone who pulled the old
  commits now has a DIVERGED history from the rewritten ones,
  and reconciling that is worse than the problem rebase was
  solving.

  → rebase freely on a LOCAL branch nobody else has pulled;
    merge (or a fresh commit) once it's shared.
```

## The three trees

```text
  the concept that makes `git add`, `git diff`, and `git
  diff --staged` make sense as different operations rather
  than confusing variants of the same thing:

    WORKING DIRECTORY   your actual files, as edited
    STAGING AREA (INDEX) what `git add` has staged for the
                          next commit — a DRAFT of the commit
    HEAD                  the last commit on the current
                          branch

  git diff            working directory  vs  staging area
  git diff --staged   staging area        vs  HEAD
  git commit           staging area  →  a new commit, HEAD
                        moves to point at it
```

```text
  → `git add` is not "mark this file as part of git" (a one-
    time thing) — it's "update the staging area's snapshot of
    this file to its current state," and can be run again
    after further edits, before committing.
```

## Bisect

```text
  a regression was introduced somewhere in the last 200
  commits, and you don't know which one.

    git bisect start
    git bisect bad              # current commit is broken
    git bisect good <commit>    # this old one was fine

  git BINARY-SEARCHES the range: checks out the midpoint, you
  test it, tell it good or bad, it narrows the range — O(log
  n) tests instead of O(n).
```

```text
  → `git bisect run <script>` automates the "you test it"
    step entirely, given a script that exits 0 (good) or
    nonzero (bad) — a bisect over 200 commits then needs
    around 8 automated test runs, not 200 manual ones.
```

## Recovering from a mistake

```text
  the panic-inducing moment: a commit seems to have vanished
  (a hard reset, a rebase gone wrong, a deleted branch).

  → git almost never actually deletes a commit immediately.
    the REFLOG (git reflog) records every place HEAD has
    pointed, including commits no branch currently references:

    git reflog
      a1b2c3d HEAD@{0}: reset: moving to HEAD~3
      e4f5g6h HEAD@{1}: commit: the change that "vanished"

    git checkout e4f5g6h    — there it is, recoverable
```

```text
  → the reflog is LOCAL and TIME-LIMITED (default 90 days for
    reachable, 30 for unreachable commits) — it is a recovery
    net for your own recent mistakes, not a permanent
    alternative history, and it does not exist on a remote or
    for a collaborator's copy of the repo.
```

## Interactive rebase for cleanup

```text
  git rebase -i HEAD~3     — before pushing, turn three messy
                             "wip" commits into one clean,
                             reviewable commit (squash), or
                             reorder/reword/split them

  → cleanup happens BEFORE sharing, for the same reason
    rebase-in-general is safe only pre-share: after push,
    the commits are a shared resource other people may have
    already built on.
```

## What to take away

1. A branch is a movable pointer to a commit, not a copy of the code — nearly
   every confusing Git behavior follows from treating the commit graph as the
   actual data structure it is.
2. Rebase rewrites commits into new ones with new hashes; it's safe on
   unshared local work and dangerous the moment someone else may have already
   pulled or built on the originals.
3. Working directory, staging area, and HEAD are three distinct snapshots —
   `git diff` and `git diff --staged` compare different pairs of them, which
   is why they show different things.
4. Bisect turns "which of 200 commits broke this" into a binary search, and
   `bisect run` with a pass/fail script automates the testing step entirely.
5. The reflog records everywhere HEAD has pointed recently and is usually how
   a "lost" commit is recovered — but it's local, time-limited, and not a
   substitute for pushing shared work.
