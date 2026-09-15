---
title: Data fetching and caching
minutes: 18
summary: Server state's own concerns — staleness, revalidation, and optimistic updates — that client state simply doesn't have.
---

The client-state chapter drew a hard line between client state and server
state precisely because server state has problems client state never
encounters: the data can go stale behind your back, the same request might
be needed by five components at once, and a failed write needs a defined
rollback. This chapter is those problems, and the tools built specifically
to solve them.

## Why server state needs its own tooling

```text
  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser);
  }, []);
```

```text
  this hand-rolled version is missing, silently:

    ✗  CACHING — navigating away and back refetches from
       scratch, even though nothing changed
    ✗  DEDUPLICATION — two components fetching the same
       endpoint on the same page fire TWO requests
    ✗  RACE CONDITIONS — if the user id changes before the
       first fetch resolves, the OLD response can arrive after
       the new one and overwrite it with STALE data
    ✗  RETRY, loading/error states beyond the most basic
```

```text
  → a data-fetching library (React Query / TanStack Query, SWR)
    exists to solve exactly this list — not "fetch is hard to
    call," but "these specific, easy-to-miss failure modes
    recur in every hand-rolled fetch effect."
```

## Cache keys and staleness

```text
  useQuery(['user', userId], () => fetchUser(userId))

  → the KEY (['user', userId]) identifies WHICH data this is —
    two components querying the SAME key share ONE cached
    result and ONE in-flight request, automatically
    deduplicated; querying a DIFFERENT userId is correctly
    treated as different data needing its own fetch.
```

```text
  STALE-WHILE-REVALIDATE: show the CACHED (possibly stale) data
  IMMEDIATELY, while fetching a fresh copy in the background —
  the user sees SOMETHING instantly (rather than a loading
  spinner) and it updates in place once the fresh data arrives.

  → this is a real UX improvement over "always show a spinner
    until the fetch resolves," and it's the default behavior of
    most modern data-fetching libraries, not an opt-in feature.
```

## Revalidation triggers

```text
  the usual moments a stale cache entry gets refetched
  automatically:

    ✓  the WINDOW REGAINS FOCUS (the user switched tabs, came
       back — the data may have changed while they were away)
    ✓  RECONNECTING after being offline
    ✓  a configured INTERVAL (poll every 30s for something
       that changes frequently)
    ✓  explicitly, after a MUTATION that's known to affect
       this data
```

```text
  → "revalidate on window focus" specifically catches the
    common case of a user leaving a tab open, another tab (or
    another user) changing the underlying data, and coming back
    to stale information — without this, "just leave the tab
    open" quietly becomes a way to see out-of-date data
    indefinitely.
```

## Optimistic updates with real rollback

```text
  the client-state chapter introduced the PATTERN; here's the
  library-level mechanics that make it safe:

    1. SNAPSHOT the current cached value
    2. WRITE the optimistic value into the cache immediately
    3. fire the mutation
    4. on SUCCESS: leave it (or replace with the server's
       authoritative response, if it differs)
    5. on FAILURE: roll the cache back to the SNAPSHOT
       from step 1
```

```text
  → step 1 (snapshot BEFORE the optimistic write) is the
    detail that's easy to get wrong hand-rolling this — without
    it, "roll back on failure" has nothing correct to roll BACK
    TO, especially if a second update happened in between the
    optimistic write and the failure being reported.
```

## Request waterfalls

```text
  function Page() {
    const user = useQuery(['user'], fetchUser);
    // ✗ this component RENDERS FIRST, THEN starts a query
    //   for the user's posts — which can't even START until
    //   the user query resolves and this component re-renders
    return user.data && <Posts userId={user.data.id} />;
  }

  function Posts({ userId }) {
    const posts = useQuery(['posts', userId], () => fetchPosts(userId));
    ...
  }
```

```text
  → this is a WATERFALL: query 2 doesn't start until query 1
    finishes and its component re-renders, even though the
    network could have fetched them CONCURRENTLY if both
    started immediately. this is the JavaScript chapter's
    sequential-await problem, reappearing specifically in
    component trees that fetch their own data at each level.
```

```text
  → the fix: fetch data as HIGH in the tree as possible and
    pass it down, or use a framework's parallel-data-loading
    mechanism (loaders that run before render, fetched together)
    — rather than letting each nested component independently
    trigger its own fetch only once it mounts.
```

## What to take away

1. A hand-rolled fetch effect is missing caching, deduplication, and race-
   condition protection by default — a data-fetching library exists
   specifically for this recurring list of failure modes, not because
   calling fetch is hard.
2. A query key identifies which data a result is — two components with the
   same key share one cached result and one in-flight request automatically.
3. Stale-while-revalidate shows cached data immediately while refetching in
   the background, which is a real UX improvement over always showing a
   spinner, and is most libraries' default behavior.
4. Revalidate-on-window-focus specifically catches a user leaving a tab open
   while the underlying data changes elsewhere — without it, that's a quiet
   way to see indefinitely stale information.
5. A request waterfall is the sequential-await problem reappearing at the
   component-tree level — fetching data as high in the tree as possible, or
   loading data in parallel before render, avoids nested components each
   independently delaying the next.
