-- Design Drills: seed the 'coding_design' category (migration 0044) with 8
-- Google-interview-style data-structure design problems, each a framing of a
-- LeetCode "Design" classic (the editorial's references link the original):
--
--   warmup    hit-counter, time-travel-kv-store
--   core      bookshelf-bookmark, text-editor-cursor, random-pick-inventory,
--             in-memory-file-system, live-leaderboard
--   advanced  constant-time-frequency-tracker
--
-- Prompts are staged (Part 1 -> Part 2 -> follow-ups), mirroring how the
-- interview escalates. `solution` is the plain-text fallback (editorial prose
-- + the Python reference); the structured editorial is 0046.
--
-- on conflict (slug) do nothing so this stays re-runnable. Requires 0044 to
-- have been applied in an EARLIER run (new enum value, separate transaction).

insert into design_drills (slug, category, difficulty, title, prompt, rubric, solution, estimated_minutes, tags)
values
(
  'bookshelf-bookmark',
  'coding_design',
  'core',
  'Bookshelf with a Bookmark',
  $$You're building the data layer for a reading app's **bookshelf**: an ordered
list of books the user arranges by hand, plus one **bookmark** pointing at the
book they're reading right now.

Implement a `Bookshelf` class:

| Method | Behavior |
| --- | --- |
| `add(title, author, after_id=None) -> id` | Insert a new book directly after `after_id`, or at the end if omitted. Returns a new unique integer id. |
| `get(id)` | Return the book's `{id, title, author}`. |
| `update(id, title=None, author=None)` | Change whichever fields are given. |
| `delete(id)` | Remove the book. |
| `list_books()` | All books, in shelf order. |
| `set_bookmark(id)` / `get_bookmark()` | Point the bookmark at a book / return the bookmarked book, or `None`. |

**Part 1.** CRUD plus positional insert. Every method except `list_books` must
run in **O(1)**. An unknown id is an error.

**Part 2.** The bookmark must survive deletes. When the bookmarked book is
deleted, decide where the bookmark goes, say so *before* coding it, and apply
the rule consistently.

```
a = add("Dune", "Herbert")          # [Dune]
c = add("Emma", "Austen")           # [Dune, Emma]
b = add("Beloved", "Morrison", a)   # [Dune, Beloved, Emma]
set_bookmark(b)
delete(b)                           # [Dune, Emma]
get_bookmark()                      # -> per your stated policy
```

**Follow-ups** (once the core works):
- `move(id, after_id)`: reorder a book in O(1).
- Several users share the shelf, each with their own bookmark.
- `undo()` for the most recent delete.$$,
  array[
    $r$Chooses a hash map (id -> node) plus a doubly linked list and justifies it: a list alone makes lookup O(n); an array makes mid-shelf insert O(n).$r$,
    $r$Uses sentinel head/tail nodes (or handles the empty / first / last cases explicitly and correctly) when linking and unlinking.$r$,
    $r$Validates `after_id` and unknown ids before mutating anything, so a failed call leaves the shelf unchanged.$r$,
    $r$States the bookmark-on-delete policy up front (e.g. next, else previous, else none) and implements exactly that, including deleting the only book.$r$,
    $r$Issues ids from a counter that never reuses an id, and `get` returns a copy rather than the internal node.$r$,
    $r$Tests by hand: insert at the end and after a middle node, delete head / tail / the only book, delete the bookmarked book.$r$,
    $r$Handles a follow-up cleanly: `move` = unlink + relink; per-user bookmarks need either a node -> users reverse index or lazy repair on read.$r$
  ],
  $sol$Two requirements pull in different directions: **order** (insert anywhere, keep
the shelf sequence) and **lookup** (reach any book by id instantly). A doubly
linked list gives O(1) insert/remove *once you hold the node*; a hash map from
id to node gives you the node in O(1). Together they make every operation
O(1), the same composition as an LRU cache. The bookmark is a pointer into
the list, so deleting its target forces you to pick a policy and keep the
pointer valid.

APPROACH
- **Hash map `id -> node`**: O(1) access to any book, which `get`, `update`,
  `delete` and `add(after_id=...)` all need.
- **Doubly linked list of nodes**: O(1) splice in or out given a node. It needs
  *doubly* linked because `delete` must reach the previous node without a scan.
- **Sentinel `head` and `tail`**: dummy nodes at both ends, so every real node
  always has a real `prev` and `next`. No `if node is first` branches.
- **Id counter**: ids are never reused, so a stale id can't silently refer to
  a newer book.

Why not the alternatives: an array keeps order but inserting in the middle
shifts O(n) elements; a list alone needs an O(n) scan to find `after_id`.

THE BOOKMARK POLICY
The bookmark holds a **node reference**, not an index, so inserts and
unrelated deletes never disturb it. Only deleting the bookmarked node itself
needs a rule. Reasonable choices, which you should name before coding:

| Policy | Behavior | Trade-off |
| --- | --- | --- |
| Slide forward, else back, else clear | Lands on the next book; at the end, the previous one | Feels natural for "keep reading" |
| Always clear | Bookmark becomes `None` | Simplest, loses the user's place |
| Refuse the delete | Raise while bookmarked | Pushes the problem to the caller |

The reference uses *forward, else back, else clear*. Apply it **before**
unlinking, while `n.next` and `n.prev` are still meaningful.

REFERENCE IMPLEMENTATION
All operations are pointer splices plus one hash-map access. `get` returns a
copy so callers can't mutate (or keep alive) internal nodes.

class _Node:
    __slots__ = ("id", "title", "author", "prev", "next")

    def __init__(self, id=None, title=None, author=None):
        self.id, self.title, self.author = id, title, author
        self.prev = self.next = None


class Bookshelf:
    def __init__(self):
        self.head, self.tail = _Node(), _Node()  # sentinels: no empty-list special cases
        self.head.next, self.tail.prev = self.tail, self.head
        self.nodes = {}  # id -> node, so any book is reachable in O(1)
        self.bookmark = None
        self._next_id = 1

    def add(self, title, author, after_id=None):
        if after_id is not None and after_id not in self.nodes:
            raise KeyError(after_id)  # validate before mutating anything
        prev = self.nodes[after_id] if after_id is not None else self.tail.prev
        node = _Node(self._next_id, title, author)
        self._next_id += 1  # ids are never reused
        node.prev, node.next = prev, prev.next
        prev.next.prev = node
        prev.next = node
        self.nodes[node.id] = node
        return node.id

    def get(self, book_id):
        n = self.nodes[book_id]
        return {"id": n.id, "title": n.title, "author": n.author}  # a copy, never the node

    def update(self, book_id, title=None, author=None):
        n = self.nodes[book_id]
        if title is not None:
            n.title = title
        if author is not None:
            n.author = author

    def delete(self, book_id):
        n = self.nodes.pop(book_id)
        if self.bookmark is n:  # policy: slide forward, else back, else clear
            if n.next is not self.tail:
                self.bookmark = n.next
            elif n.prev is not self.head:
                self.bookmark = n.prev
            else:
                self.bookmark = None
        n.prev.next, n.next.prev = n.next, n.prev

    def set_bookmark(self, book_id):
        self.bookmark = self.nodes[book_id]

    def get_bookmark(self):
        return None if self.bookmark is None else self.get(self.bookmark.id)

    def list_books(self):
        out, cur = [], self.head.next
        while cur is not self.tail:
            out.append(self.get(cur.id))
            cur = cur.next
        return out

PITFALLS
- **Unlink order.** `n.prev.next = n.next` and `n.next.prev = n.prev` both
  read `n`'s own pointers, which stay intact, so the order between them is
  safe. Inserting is the delicate one: set the new node's pointers first,
  then `prev.next.prev` *before* overwriting `prev.next`.
- **Validate, then mutate.** Checking `after_id` after allocating an id
  leaves a gap in the id sequence (or worse, a half-linked node).
- **Bookmark before unlink.** Decide the new bookmark while the deleted node
  still points at its neighbours.
- **Identity, not equality.** Compare nodes with `is` / reference equality;
  two different books can have equal fields.

FOLLOW-UPS
- **`move(id, after_id)`**: unlink the node and relink it after the target,
  both O(1). Guard `id == after_id`, which is a no-op.
- **Per-user bookmarks**: `user -> node`. A delete can now invalidate many
  bookmarks. Either keep a reverse index `node -> set(users)` and fix them all
  (O(users on that book)), or mark the node deleted and repair a bookmark
  lazily the next time that user reads it.
- **Undo delete**: push `(node, prev, next)` on a stack. Re-linking is safe
  only if the neighbours haven't changed since, so either record operations
  more richly or limit undo to the latest operation.$sol$,
  35,
  array['hash map', 'doubly linked list', 'sentinel nodes', 'cursor']
),
(
  'hit-counter',
  'coding_design',
  'warmup',
  'Hit Counter',
  $$A monitoring dashboard shows **"requests in the last 5 minutes"**. Implement a
`HitCounter`:

- `record(timestamp)`: one hit happened at `timestamp` (integer seconds).
- `count(timestamp) -> int`: hits in the window `(timestamp - 300, timestamp]`.

Timestamps across *all* calls are non-decreasing. Several hits can share a
second.

```
record(1); record(2); record(3)
count(4)     # 3
record(300)
count(300)   # 4
count(301)   # 3  (the hit at t=1 has expired)
```

**Part 1.** Any correct implementation.

**Part 2.** The service now takes millions of hits per second. Memory must not
grow with traffic.

**Follow-ups:**
- Make the window length configurable.
- Hits can arrive up to a few seconds late (out of order).
- Many threads, or many hosts, record concurrently.$$,
  array[
    $r$Clarifies the window boundary (is a hit exactly 300 s old counted?) and that timestamps are non-decreasing.$r$,
    $r$Starts with a simple correct approach (a queue of timestamps, evicting from the front) and names its flaw: memory grows with hits, not with the window.$r$,
    $r$Moves to fixed buckets: a ring of W slots indexed by `t % W`, each holding (second, count).$r$,
    $r$Gets the stale-slot check right by comparing the stored second, so a slot left over from W seconds ago is reset instead of added to.$r$,
    $r$States complexity: O(1) record, O(W) count, O(W) memory regardless of hit rate.$r$,
    $r$Discusses a follow-up: late hits break the ring if a slot was already recycled; per-thread counters summed on read; per-host counts aggregated centrally.$r$
  ],
  $sol$Counting hits in a sliding window is easy with a queue of timestamps, but the
queue grows with traffic. The window has a fixed number of *seconds*, so keep
one counter per second in a ring of W buckets. Each bucket also remembers
which second it currently represents, so an old bucket is recycled the moment
its slot comes around again. Memory becomes O(W), independent of hit rate.

APPROACH
**Baseline: a queue.** Append every hit's timestamp. On `count(t)`, pop from
the front while `front <= t - 300`, then return the queue's length. Correct,
amortized O(1), but a million hits a second means a million queue entries a
second.

**Buckets.** All that matters is *how many* hits each second had. Keep two
arrays of length W: `times[i]` is the second slot `i` currently holds and
`counts[i]` is its hit count. Second `t` maps to slot `t % W`.

- `record(t)`: if `times[t % W] != t`, the slot holds a second at least W
  seconds old, so reset it to `(t, 0)`. Then increment.
- `count(t)`: sum `counts[i]` over slots whose `times[i]` is inside the
  window, i.e. `t - times[i] < W`.

REFERENCE IMPLEMENTATION
The stored second is what makes a slot safe to reuse. Without it, a hit at
t = 305 would be added to t = 5's count.

class HitCounter:
    """Hits in the trailing `window` seconds: O(1) record, O(window) count and memory."""

    def __init__(self, window=300):
        self.window = window
        self.times = [0] * window   # which second each bucket currently holds
        self.counts = [0] * window  # hits recorded in that second

    def record(self, timestamp):
        i = timestamp % self.window
        if self.times[i] != timestamp:  # bucket holds a stale second: recycle it
            self.times[i] = timestamp
            self.counts[i] = 0
        self.counts[i] += 1

    def count(self, timestamp):
        return sum(
            c for t, c in zip(self.times, self.counts)
            if timestamp - t < self.window
        )

TRADE-OFFS
- **O(W) count.** With W = 300 that's 300 additions, which is negligible. For a
  much larger window, keep a running total: add on `record`, and subtract a
  slot's count when you recycle it. Note that a stretch with no traffic
  leaves expired slots unrecycled, so you'd also need to sweep them on
  `count`.
- **Granularity.** For a 24-hour window, use one bucket per minute
  (1440 slots) and accept up to a minute of edge error, or keep
  second-level buckets for only the most recent minute.

FOLLOW-UPS
- **Late hits.** A hit for second `t` arriving after slot `t % W` was recycled
  for `t + W` would reset the newer data. Drop hits older than the window,
  and only apply a late hit to its slot if the slot still holds `t`.
- **Concurrency.** Shard the counters (per thread or CPU) and sum on read, or
  use atomic increments per slot; the reset needs a compare-and-swap on
  `times[i]`.
- **Many hosts.** Each host keeps its own ring and periodically ships
  per-second counts to an aggregator. Global counts are then slightly delayed,
  which is fine for a dashboard.$sol$,
  20,
  array['sliding window', 'ring buffer', 'queue', 'streaming']
),
(
  'time-travel-kv-store',
  'coding_design',
  'warmup',
  'Time-Travel Key-Value Store',
  $$A configuration service keeps the **full history** of every key so engineers
can ask "what was this flag set to at 3 pm yesterday?". Implement `TimeMap`:

- `set(key, value, timestamp)`: record a write.
- `get(key, timestamp)`: the value from the latest write to `key` with
  write-timestamp `<= timestamp`, or `None` if there is none.

For any one key, `set` timestamps are strictly increasing.

```
set("flag", "on", 10)
get("flag", 5)     # None   (before the first write)
get("flag", 10)    # "on"
set("flag", "off", 20)
get("flag", 15)    # "on"
get("flag", 99)    # "off"
```

**Part 1.** `set` and `get` as above, with `get` faster than a linear scan.

**Part 2.** Add `delete(key, timestamp)`. A `get` at or after the delete
returns `None`; a `get` before it still sees the old value; a later `set`
brings the key back.

**Follow-ups:**
- Writes for a key can now arrive out of order.
- History is too large: keep only what's needed.
- `get_range(key, t1, t2)`: every value written in that interval.$$,
  array[
    $r$Keeps a per-key history sorted by timestamp, noting that increasing timestamps make a plain append keep it sorted.$r$,
    $r$Finds the latest write <= t with binary search (bisect_right - 1 / upper_bound - 1), not a linear scan, and handles a query before the first write.$r$,
    $r$Rejects (or explicitly defines behavior for) a non-increasing timestamp instead of silently corrupting the sort order.$r$,
    $r$Implements delete as an appended tombstone rather than erasing history, so earlier reads still work and a later set revives the key.$r$,
    $r$States complexity: O(1) amortized set, O(log h) get where h is that key's history length, O(total writes) space.$r$,
    $r$Handles a follow-up: out-of-order writes need sorted insert (O(h)) or a balanced tree / skip list (O(log h)); compaction keeps the latest version before the oldest queryable time.$r$
  ],
  $sol$Each key's history is a list of `(timestamp, value)` that only ever grows at
the end, and because timestamps increase, the list stays sorted for free. A
point-in-time read is then the classic "last element <= t" binary search.
Deletes don't erase history; they append a **tombstone** so the timeline
stays intact for reads before the delete.

APPROACH
- `times[key]`: ascending write timestamps. `values[key]`: values in the same
  order (parallel arrays, or one list of pairs).
- `set`: append to both. Strictly increasing timestamps mean no sort is ever
  needed. Reject a timestamp `<=` the last one instead of corrupting the order.
- `get(key, t)`: `i = bisect_right(times, t) - 1` is the index of the last
  write with timestamp `<= t`. If `i < 0`, the query predates the first write.

DELETES AS TOMBSTONES
Physically removing history would break "what was it *before* the delete?".
Instead, `delete(key, t)` appends a sentinel value at `t`. `get` treats
landing on the sentinel as "absent". A later `set` appends after it, so the
key comes back naturally. This is the same idea LSM-tree databases use for
deletes.

REFERENCE IMPLEMENTATION
`bisect_right` returns the first index whose timestamp is strictly greater
than `t`, so one step back is the answer. Using `bisect_left` would wrongly
skip a write made exactly at `t`.

import bisect

_TOMBSTONE = object()


class TimeMap:
    def __init__(self):
        self.times = {}   # key -> ascending write timestamps
        self.values = {}  # key -> values, parallel to self.times[key]

    def set(self, key, value, timestamp):
        ts = self.times.setdefault(key, [])
        if ts and timestamp <= ts[-1]:
            raise ValueError("timestamps must strictly increase per key")
        ts.append(timestamp)  # appends keep the list sorted for free
        self.values.setdefault(key, []).append(value)

    def delete(self, key, timestamp):
        self.set(key, _TOMBSTONE, timestamp)  # history is append-only

    def get(self, key, timestamp):
        ts = self.times.get(key)
        if not ts:
            return None
        i = bisect.bisect_right(ts, timestamp) - 1  # latest write at or before timestamp
        if i < 0:
            return None
        value = self.values[key][i]
        return None if value is _TOMBSTONE else value

FOLLOW-UPS
- **Out-of-order writes**: `insort` keeps the list sorted at O(h) per write,
  which is fine for small histories. Otherwise use a balanced BST per key
  (`TreeMap.floorEntry` in Java, `std::map::upper_bound` in C++), O(log h)
  for both operations.
- **Compaction**: if nobody queries before time `T`, drop every version older
  than the *last* version at or before `T`. That one must stay, because it's
  the answer for queries just after `T`.
- **`get_range`**: two binary searches (`bisect_left(t1)`, `bisect_right(t2)`)
  and a slice, O(log h + answer size).$sol$,
  25,
  array['hash map', 'binary search', 'versioning', 'tombstones']
),
(
  'text-editor-cursor',
  'coding_design',
  'core',
  'Text Editor with Cursor and Undo',
  $$Implement the core of a plain-text editor with a single cursor:

- `add_text(text)`: insert `text` at the cursor; the cursor ends up after it.
- `delete_text(k) -> int`: backspace up to `k` characters (only characters
  left of the cursor can be deleted). Return how many were deleted.
- `cursor_left(k) -> str` / `cursor_right(k) -> str`: move the cursor up to
  `k` positions, stopping at the ends. Return the last `min(10, n)`
  characters to the left of the cursor.

```
add_text("leetcode")   # "leetcode|"
delete_text(4)         # 4   -> "leet|"
add_text("practice")   # "leetpractice|"
cursor_right(3)        # "etpractice"   (already at the end)
cursor_left(8)         # "leet"         -> "leet|practice"
delete_text(10)        # 4   -> "|practice"
```

**Part 1.** Every operation must cost **O(k)**, where k is the number of
characters touched, never O(document length).

**Part 2.** Add `undo() -> bool`, which reverts the most recent operation
(edits *and* cursor moves) that hasn't been undone yet. Return `False` if
there's nothing to undo. Still O(k).

**Follow-ups:**
- `redo()`.
- Group a burst of typing into one undo step.
- Multiple cursors.$$,
  array[
    $r$Represents the text as two stacks, characters left of the cursor and characters right of it (nearest on top), so every edit happens at a stack top.$r$,
    $r$Rejects plain string / array insertion at an index as O(n) per edit.$r$,
    $r$Clamps k for deletes and moves, and returns the clamped count / the correct 10-character view.$r$,
    $r$For undo, records the actual effect (characters actually removed, distance actually moved), not the requested k; undoing a clamped move by the requested k is the classic bug.$r$,
    $r$Applies the exact inverse per operation: add <-> pop n, delete <-> push the removed characters back, left <-> right by the moved distance.$r$,
    $r$States complexity: O(k) per operation and per undo; space O(text + history).$r$,
    $r$Discusses redo (a second stack, cleared by any new edit) or grouping consecutive inserts.$r$
  ],
  $sol$A cursor splits the document into two halves, and every operation only
touches characters **next to the cursor**. Store the left half as a stack
(top = character just before the cursor) and the right half as a stack
(top = character just after it). Typing pushes, backspace pops, moving the
cursor pops from one stack and pushes onto the other. Undo is a history stack
of operations, each storing exactly what it *did*, so it can be inverted
precisely.

APPROACH
- `left`: characters before the cursor, nearest last.
- `right`: characters after the cursor, **stored reversed**, nearest last.

| Operation | Effect | Cost |
| --- | --- | --- |
| `add_text(s)` | push `s` onto `left` | O(len s) |
| `delete_text(k)` | pop `min(k, len(left))` from `left` | O(k) |
| `cursor_left(k)` | move `min(k, len(left))` chars from `left` to `right` | O(k) |
| `cursor_right(k)` | move `min(k, len(right))` chars from `right` to `left` | O(k) |

The 10-character view is just the top 10 of `left`.

A gap buffer (one array with a movable gap) is the production version of the
same idea; a rope or piece table helps when edits are far apart.

UNDO
Push one history entry per operation, recording what **actually** happened:

- `add` -> the number of characters inserted. Inverse: pop that many from `left`.
- `delete` -> the characters actually removed. Inverse: push them back.
- `left` / `right` -> the distance actually moved. Inverse: move the same
  distance the other way.

Recording the *requested* k instead is the trap. `cursor_left(50)` at
position 3 moves 3; undoing it by 50 would carry the cursor up to 47
characters past where it started. Each undo is O(k) for its own k, so Part 1's bound holds.

REFERENCE IMPLEMENTATION
Python lists and C++/Java strings work as stacks here: append and pop at the
end are amortized O(1).

class TextEditor:
    def __init__(self):
        self.left = []     # chars before the cursor, nearest char last
        self.right = []    # chars after the cursor, nearest char last
        self.history = []  # (op, arg) per operation, for undo

    def _view(self):
        return "".join(self.left[-10:])

    def _move(self, src, dst, k):
        k = min(k, len(src))
        for _ in range(k):
            dst.append(src.pop())
        return k

    def add_text(self, text):
        self.left.extend(text)
        self.history.append(("add", len(text)))

    def delete_text(self, k):
        k = min(k, len(self.left))
        removed = self.left[len(self.left) - k:]
        del self.left[len(self.left) - k:]
        self.history.append(("delete", removed))
        return k

    def cursor_left(self, k):
        self.history.append(("left", self._move(self.left, self.right, k)))
        return self._view()

    def cursor_right(self, k):
        self.history.append(("right", self._move(self.right, self.left, k)))
        return self._view()

    def undo(self):
        if not self.history:
            return False
        op, arg = self.history.pop()
        if op == "add":
            del self.left[len(self.left) - arg:]
        elif op == "delete":
            self.left.extend(arg)
        elif op == "left":
            self._move(self.right, self.left, arg)  # replay exactly what moved
        else:
            self._move(self.left, self.right, arg)
        return True

    def text(self):
        return "".join(self.left) + "".join(reversed(self.right))

FOLLOW-UPS
- **Redo**: `undo` pushes the inverted entry onto a redo stack; `redo` pops it
  and re-applies it. Any new edit clears the redo stack, because redoing past
  a divergent edit is meaningless.
- **Grouping**: merge consecutive `add` entries into one while there's no
  cursor move between them and the gap since the last keystroke is under N ms.
- **Multiple cursors**: two stacks no longer suffice. Use one buffer
  (gap buffer / piece table) with sorted cursor offsets, and shift the offsets
  after each edit.$sol$,
  40,
  array['two stacks', 'cursor', 'undo', 'command pattern']
),
(
  'random-pick-inventory',
  'coding_design',
  'core',
  'Inventory with Random Pick',
  $$A game's loot system keeps a **bag of items** and draws one at random when a
chest opens. Implement `Inventory`:

- `add(item)`: put one copy of `item` in the bag.
- `remove(item) -> bool`: take out one copy; `False` if there was none.
- `count(item) -> int`: copies of `item` in the bag.
- `pick_random()`: return an item, where every **copy** is equally likely.
  With 3 swords and 1 shield, a sword comes back 75% of the time.

All operations must run in **average O(1)**.

**Part 1.** Assume every item is unique (no duplicates).

**Part 2.** Duplicates are allowed, as described above.

```
add("sword"); add("sword"); add("sword"); add("shield")
pick_random()      # "sword" w.p. 3/4, "shield" w.p. 1/4
remove("sword")    # True
count("sword")     # 2
remove("bow")      # False
```

**Follow-ups:**
- Items have weights that change often; pick proportionally to weight.
- `remove_all(item)`.
- Draw without replacement until the bag is empty.$$,
  array[
    $r$Recognizes that a uniform pick needs a contiguous array (a random index), and O(1) removal needs a hash map from item to its position(s).$r$,
    $r$Removes by swapping the target with the last element and popping, then updating the moved element's recorded index.$r$,
    $r$With duplicates, maps item -> set of indices (not one index or a bare count) so any copy can be located and removed in O(1).$r$,
    $r$Handles the self-swap case where the removed copy is already in the last slot: order the index-set updates so the entry isn't left dangling.$r$,
    $r$Deletes an item's map entry when its last copy goes, keeping count/remove of absent items correct.$r$,
    $r$States average O(1) for every operation and explains why picking a random array slot is uniform over copies.$r$,
    $r$Addresses weighted picking: prefix sums + binary search for static weights, a Fenwick tree when weights change.$r$
  ],
  $sol$Uniform random choice needs the items **packed in an array**: pick a random
index. Fast removal needs to **find** an item in O(1): a hash map from item to
its array positions. The usual tension is that deleting from the middle of an
array is O(n), and the fix is to overwrite the hole with the last element and
shrink by one, since order doesn't matter. With duplicates, each item maps to
a *set* of positions.

APPROACH
- `items`: one array slot per copy. `pick_random` is `items[randrange(len)]`,
  uniform over copies by construction.
- `where[item]`: the set of slots currently holding `item`.

**Remove one copy of `x`:**
1. Remove any slot `hole` from `where[x]`.
2. Let `last` be the item in the final slot. Write `last` into `hole`.
3. Update `last`'s slot set: add `hole`, discard the final slot index.
4. Pop the array. If `where[x]` is now empty, delete the key.

In Part 1 (no duplicates), `where` maps to a single index and steps 1-4
reduce to the familiar RandomizedSet.

THE SELF-SWAP EDGE CASE
When `hole` *is* the final slot (and therefore `last == x`), step 3 must
**add before it discards**. Adding `hole` then discarding the final index
(the same number) nets out to removing it, which is correct. Discarding first
and then adding would leave a dangling index pointing past the end of the
array. Tracing the "remove the only copy" and "remove the copy in the last
slot" cases by hand is what interviewers look for here.

REFERENCE IMPLEMENTATION
In Java, watch `List.remove(int)` (by index) versus `Set.remove(Object)` (by
value). Both appear in `remove`, with `int` arguments.

import random


class Inventory:
    def __init__(self):
        self.items = []  # one slot per copy: pick_random indexes this
        self.where = {}  # item -> set of slots in self.items holding it

    def add(self, item):
        self.where.setdefault(item, set()).add(len(self.items))
        self.items.append(item)

    def remove(self, item):
        slots = self.where.get(item)
        if not slots:
            return False
        hole, last_slot = slots.pop(), len(self.items) - 1
        last = self.items[last_slot]
        # Fill the hole with the last copy, then shrink: O(1), nothing shifts.
        self.items[hole] = last
        self.where[last].add(hole)
        self.where[last].discard(last_slot)
        self.items.pop()
        if not slots:
            del self.where[item]
        return True

    def count(self, item):
        return len(self.where.get(item, ()))

    def pick_random(self):
        if not self.items:
            raise IndexError("empty inventory")
        return random.choice(self.items)  # uniform over copies, not item types

FOLLOW-UPS
- **Weighted pick**: with static weights, build prefix sums and binary-search
  a random number in `[0, total)`, O(log n). With frequently changing weights,
  a Fenwick tree gives O(log n) for both updates and picks.
- **`remove_all(x)`**: run the swap-remove once per copy, O(copies). Removing
  in descending slot order avoids moving a copy of `x` into a hole you're
  about to clear.
- **Without replacement**: `pick_random` followed by `remove` of that copy;
  this is an online Fisher-Yates shuffle.$sol$,
  30,
  array['hash map', 'array', 'swap-remove', 'randomization']
),
(
  'in-memory-file-system',
  'coding_design',
  'core',
  'In-Memory File System',
  $$Implement a small in-memory file system with absolute, `/`-separated paths:

- `mkdir(path)`: create the directory, plus any missing parents.
- `write(path, data)`: append `data` to the file, creating the file (and any
  missing parent directories) if needed.
- `read(path) -> str`: the file's full contents.
- `ls(path) -> list`: for a directory, its children's names in sorted order;
  for a file, a one-element list with the file's own name.
- `size(path) -> int`: bytes in a file, or the total under a directory.

These are errors: reading or writing a directory, creating anything *under* a
file, and any missing path on `read` / `ls` / `size`.

```
mkdir("/a/b")
write("/a/b/notes.txt", "hello")
write("/a/b/notes.txt", " world")
read("/a/b/notes.txt")   # "hello world"
ls("/a")                 # ["b"]
ls("/a/b/notes.txt")     # ["notes.txt"]
write("/a/c", "12")
size("/a")               # 13
```

**Part 1.** `mkdir`, `write`, `read`, `ls`.

**Part 2.** `size`.

**Follow-ups:**
- `size` is called constantly: make it O(depth).
- `mv(src, dst)` and `rm(path)`.
- Files are gigabytes large.$$,
  array[
    $r$Models the tree as a trie of nodes keyed by path segment, with an explicit file-vs-directory flag (an empty directory and an empty file must differ).$r$,
    $r$Parses paths robustly: root `/`, trailing slashes, repeated slashes.$r$,
    $r$Factors traversal into one walk(path, create) helper instead of re-implementing it in every method.$r$,
    $r$Enforces the error cases, including the subtle one: the parent of a `write` must not be a file.$r$,
    $r$Returns `ls` sorted, either by sorting at read time or by keeping children in an ordered map, and states the trade-off.$r$,
    $r$Appends file data efficiently (chunk list or string builder), not by repeated immutable-string concatenation.$r$,
    $r$Computes size recursively, then for the follow-up maintains per-directory byte totals updated along the path on every write.$r$
  ],
  $sol$Paths are sequences of names, and a directory tree is a **trie** over those
names: each node maps a child name to a child node. One `walk` helper that
follows (and optionally creates) the path does almost all the work; each
public method is a few lines on top of it. The details interviewers probe are
the file/directory distinction and the error cases.

APPROACH
- **Node**: `children: name -> Node` for directories; `content` for files.
  Keep an explicit marker of which it is (here, `content is None` means
  directory). Inferring it from "has no children" breaks on empty directories.
- **`walk(parts, create)`**: start at the root and step through each name,
  creating missing directories if `create` is set. Refuse to step *through* a
  file.
- **`write`**: walk to the parent with `create=True`, check the parent isn't a
  file, then create the file node if needed and append.
- **`ls`**: a file returns its own name; a directory returns its sorted child
  names.
- **`size`**: a file's length, or the recursive sum over children.

REFERENCE IMPLEMENTATION
C++ and Java keep children in an ordered map (`std::map` / `TreeMap`), so
`ls` is already sorted at the cost of O(log c) lookups. Python uses a dict and
sorts in `ls`. Either is fine; say which you chose and why.

class _Node:
    __slots__ = ("children", "content")

    def __init__(self, is_file=False):
        self.children = {}                     # name -> _Node (directories only)
        self.content = [] if is_file else None  # chunks for a file, None for a dir


class FileSystem:
    def __init__(self):
        self.root = _Node()

    def _walk(self, parts, create=False):
        node = self.root
        for part in parts:
            if node.content is not None:
                raise NotADirectoryError("/".join(parts))
            child = node.children.get(part)
            if child is None:
                if not create:
                    raise FileNotFoundError("/".join(parts))
                child = node.children[part] = _Node()
            node = child
        return node

    @staticmethod
    def _split(path):
        return [p for p in path.split("/") if p]

    def mkdir(self, path):
        if self._walk(self._split(path), create=True).content is not None:
            raise FileExistsError(path)

    def write(self, path, data):
        *dirs, name = self._split(path)
        parent = self._walk(dirs, create=True)
        if parent.content is not None:
            raise NotADirectoryError(path)
        node = parent.children.get(name)
        if node is None:
            node = parent.children[name] = _Node(is_file=True)
        elif node.content is None:
            raise IsADirectoryError(path)
        node.content.append(data)  # O(1) append; join on read

    def read(self, path):
        node = self._walk(self._split(path))
        if node.content is None:
            raise IsADirectoryError(path)
        return "".join(node.content)

    def ls(self, path):
        parts = self._split(path)
        node = self._walk(parts)
        return [parts[-1]] if node.content is not None else sorted(node.children)

    def size(self, path):
        return self._size(self._walk(self._split(path)))

    def _size(self, node):
        if node.content is not None:
            return sum(map(len, node.content))
        return sum(self._size(child) for child in node.children.values())

PITFALLS
- **Write under a file.** `walk` checks for files *between* path segments,
  but for `write("/notes.txt/x", ...)` the parent itself is the file. That
  needs its own check, or you'll silently create a child under a file.
- **Path splitting.** `"/".split("/")` yields empty strings, so filter them
  out. Then `"/"`, `"/a/"` and `"//a"` all behave.
- **Appending.** Concatenating immutable strings on every write is O(file
  size) each time. Append to a list or builder and join on read.

FOLLOW-UPS
- **O(depth) `size`**: store `total_bytes` on every directory node. On
  `write`, add `len(data)` to each directory along the path, which `walk`
  visits anyway. `rm` and `mv` subtract and add the subtree's total along the
  old and new paths.
- **`mv(src, dst)`**: detach the node from its parent's children and attach it
  under the new name. Reject moving a directory into its own subtree.
- **Huge files**: store content as fixed-size chunks (blocks), so appends and
  reads at an offset don't copy the whole file. This is how real file systems
  lay data out.$sol$,
  40,
  array['trie', 'tree', 'recursion', 'path parsing']
),
(
  'live-leaderboard',
  'coding_design',
  'core',
  'Live Leaderboard',
  $$A multiplayer game shows a **live leaderboard**. Implement `Leaderboard`:

- `update(player, delta) -> int`: add `delta` (possibly negative) to the
  player's score, starting from 0 for a new player. Return the new score.
- `remove(player) -> bool`: drop the player; `False` if unknown.
- `top(k)`: the `k` best `(player, score)` pairs, highest score first, ties
  broken by player name ascending.

```
update("ana", 50); update("bo", 80); update("cy", 50)
top(2)          # [("bo", 80), ("ana", 50)]
update("cy", 40)
top(2)          # [("cy", 90), ("bo", 80)]
```

**Part 1.** Any correct implementation.

**Part 2.** There are a million players, and `update` and `top(k)` are both
called constantly. Make `update` O(log n) and `top(k)` O(k).

**Follow-ups:**
- `rank(player)`: the player's 1-based position.
- The leaderboard is too big for one machine.
- A separate daily leaderboard that resets at midnight.$$,
  array[
    $r$Gives a baseline (a score map plus a sort, O(n log n), or a size-k heap, O(n log k), per `top`) and explains why it's too slow when `top` is frequent.$r$,
    $r$Maintains an ordered set keyed by (-score, name) alongside the player -> score map.$r$,
    $r$Updates by removing the old (score, name) entry and inserting the new one, never mutating a key inside an ordered structure.$r$,
    $r$Encodes the tie-break in the key, so `top(k)` is deterministic.$r$,
    $r$States O(log n) update / remove and O(k) top for a balanced BST, and notes Python has no built-in ordered set (bisect on a list is an O(n) memmove).$r$,
    $r$Handles a follow-up: rank via an order-statistics tree or a Fenwick tree over bounded scores; sharding with a per-shard top-k merge.$r$
  ],
  $sol$`top(k)` wants players **already sorted by score**; `update` changes one
player's position in that order. An ordered set (balanced BST) keyed by
`(-score, name)` keeps the order under updates in O(log n), and `top(k)` is
the first k elements. A hash map from player to current score lets you find
and remove the old key before inserting the new one.

APPROACH
- `score[player]`: the current score, for O(1) lookup.
- `ranked`: an ordered set of `(-score, player)`. Negating the score makes
  ascending order mean best first, and the name breaks ties ascending.

`update` removes `(-old, player)`, computes the new score, and inserts
`(-new, player)`. `top(k)` walks the first k entries.

WHY NOT A HEAP?
| Approach | update | top(k) |
| --- | --- | --- |
| Map + sort on read | O(1) | O(n log n) |
| Map + heap of size k on read | O(1) | O(n log k) |
| Max-heap with lazy deletion | O(log n) | O(k log n), but popped entries must be pushed back, and stale entries pile up |
| **Map + ordered set** | **O(log n)** | **O(k)** |

A heap can't remove an arbitrary element or iterate in order without
destroying itself, which is exactly what a changing score needs.

REFERENCE IMPLEMENTATION
C++ `std::set` and Java `TreeSet` are red-black trees. Python's standard
library has no ordered set, so the Python version keeps a sorted list with
`bisect`, which is correct but O(n) per update because of the shifting. In an
interview, say so and name `sortedcontainers.SortedList` as the practical
fix.

import bisect


class Leaderboard:
    def __init__(self):
        self.score = {}   # player -> current score
        self.ranked = []  # sorted (-score, player): best first, ties by name

    def _unrank(self, player, score):
        self.ranked.pop(bisect.bisect_left(self.ranked, (-score, player)))

    def update(self, player, delta):
        old = self.score.get(player)
        if old is not None:
            self._unrank(player, old)  # re-key = remove + insert, never mutate in place
        new = (old or 0) + delta
        self.score[player] = new
        bisect.insort(self.ranked, (-new, player))
        return new

    def remove(self, player):
        old = self.score.pop(player, None)
        if old is None:
            return False
        self._unrank(player, old)
        return True

    def top(self, k):
        return [(player, -neg) for neg, player in self.ranked[:k]]

FOLLOW-UPS
- **`rank(player)`**: a plain red-black tree can't count the elements before a
  node in O(log n). Use an order-statistics tree (subtree sizes), or, if
  scores are bounded integers, a Fenwick tree indexed by score that counts
  players at each score.
- **Sharding**: partition players by hash. The global top-k is guaranteed to
  be among the union of each shard's top-k, so merge s lists of k.
- **Daily board**: key the structure by day and create a fresh one at
  midnight. That's cheaper than resetting scores, and yesterday's board stays
  queryable.$sol$,
  30,
  array['ordered set', 'balanced bst', 'heap', 'top-k']
),
(
  'constant-time-frequency-tracker',
  'coding_design',
  'advanced',
  'Constant-Time Frequency Tracker',
  $$Track how often each string key occurs, with **every operation in O(1)**:

- `inc(key)`: increment the key's count, starting from 0 for a new key.
- `dec(key)`: decrement it. A key whose count reaches 0 is removed. `dec` of
  an absent key does nothing.
- `max_key()`: any key with the highest count, or `None` if empty.
- `min_key()`: any key with the lowest count, or `None` if empty.

```
inc("a"); inc("b"); inc("b")
max_key()   # "b"
min_key()   # "a"
dec("b"); dec("b")
max_key()   # "a"   (b's count hit 0, so b is gone)
```

**Part 1.** Only `inc` and `max_key`.

**Part 2.** Add `dec` and `min_key`. Your Part 1 approach probably breaks:
explain why before fixing it.

**Follow-ups:**
- Return *all* keys tied for the max.
- The k most frequent keys.
- Turn this into an LFU cache.$$,
  array[
    $r$For Part 1, notes that a running max suffices when counts only grow, then explains why `dec` breaks it and why a heap is O(log n), not O(1).$r$,
    $r$Designs a doubly linked list of count buckets in ascending order, each holding the set of keys with that count, plus a key -> bucket map.$r$,
    $r$inc / dec move a key to the neighbouring bucket, creating it only when the neighbour's count isn't exactly +/-1.$r$,
    $r$Removes empty buckets immediately, so the list's ends are always the min and max.$r$,
    $r$Gets the ordering right: links the new bucket before removing the key from (and possibly unlinking) the old one.$r$,
    $r$Handles count reaching 0 (remove from the map, no bucket for 0) and `dec` of an absent key.$r$,
    $r$Connects the structure to an LFU cache: the same buckets, with an LRU order inside each bucket.$r$
  ],
  $sol$O(1) min and max under both increments and decrements rules out heaps and
running extremes. The insight is that a count only ever changes by **1**, so
a key only moves to an *adjacent* count. Keep a doubly linked list of buckets
sorted by count, each holding the keys at that count. The head is the min,
the tail is the max, and every move is a constant number of pointer and
hash-set operations.

APPROACH
- **Bucket**: `count`, the set of `keys` with that count, `prev`, `next`.
- **List**: buckets in ascending `count` order between `head` and `tail`
  sentinels, with no empty buckets ever left in it.
- **`bucket_of[key]`**: the bucket currently holding the key.

`inc(key)`: let `cur` be the key's bucket (or `head`, standing for count 0).
If `cur.next` doesn't have count `cur.count + 1`, insert a new bucket right
after `cur`. Move the key there. If `cur` is now empty, unlink it.

`dec(key)` mirrors this toward `prev`, except that a key at count 1 is simply
removed from `bucket_of`.

`max_key` / `min_key`: any key in `tail.prev` / `head.next`.

WHY THE OBVIOUS APPROACHES FAIL
- **Running max**: fine for Part 1, since counts only grow. After `dec` on the
  max key you'd need the *second* largest count, which you don't have.
- **Heap**: O(log n) per update, and it needs lazy deletion or an indexed heap
  to reposition a key.
- **Count -> keys map alone**: finding the next non-empty count after a bucket
  empties is a scan.

The linked list fixes the last one: neighbours in the list are neighbours in
count, and empty buckets are removed, so the ends are always the extremes.

REFERENCE IMPLEMENTATION
The C++ version uses `std::list` iterators, which stay valid when other
elements are inserted or erased. Python and Java hand-roll the list with
sentinels, the same as the bookshelf drill.

class _Bucket:
    __slots__ = ("count", "keys", "prev", "next")

    def __init__(self, count):
        self.count, self.keys = count, set()
        self.prev = self.next = None


class FrequencyTracker:
    def __init__(self):
        # Buckets ascend by count from head to tail; sentinels hold count 0.
        self.head, self.tail = _Bucket(0), _Bucket(0)
        self.head.next, self.tail.prev = self.tail, self.head
        self.bucket_of = {}  # key -> the bucket currently holding it

    def _insert_after(self, prev, count):
        b = _Bucket(count)
        b.prev, b.next = prev, prev.next
        prev.next.prev = b
        prev.next = b
        return b

    def _drop(self, bucket, key):
        bucket.keys.discard(key)
        if not bucket.keys:  # never keep an empty bucket: min/max must stay O(1)
            bucket.prev.next, bucket.next.prev = bucket.next, bucket.prev

    def inc(self, key):
        cur = self.bucket_of.get(key, self.head)
        nxt = cur.next
        if nxt is self.tail or nxt.count != cur.count + 1:
            nxt = self._insert_after(cur, cur.count + 1)  # link before cur can vanish
        nxt.keys.add(key)
        self.bucket_of[key] = nxt
        if cur is not self.head:
            self._drop(cur, key)

    def dec(self, key):
        cur = self.bucket_of.get(key)
        if cur is None:
            return
        if cur.count == 1:
            del self.bucket_of[key]
        else:
            prv = cur.prev
            if prv is self.head or prv.count != cur.count - 1:
                prv = self._insert_after(prv, cur.count - 1)
            prv.keys.add(key)
            self.bucket_of[key] = prv
        self._drop(cur, key)

    def max_key(self):
        return None if self.tail.prev is self.head else next(iter(self.tail.prev.keys))

    def min_key(self):
        return None if self.head.next is self.tail else next(iter(self.head.next.keys))

PITFALLS
- **Order of operations.** Insert the destination bucket *relative to `cur`*
  before removing the key from `cur`. Removing first can unlink `cur`, and
  then there's nothing to insert next to.
- **The count-0 state.** A key is never stored at count 0. `inc` of a new
  key treats `head` as its "bucket"; `dec` at count 1 deletes the key.
- **Ties.** Any key in the extreme bucket is a valid answer, so tests must
  check the *count* of the returned key, not a specific key.

FOLLOW-UPS
- **All keys tied for the max**: return `tail.prev.keys`, O(size of the tie).
- **Top k keys**: walk buckets from the tail, O(k) total.
- **LFU cache**: these buckets keyed by access count, plus an LRU order
  *within* each bucket (an ordered dict / linked hash set). Evict the
  least-recently-used key from `head.next`. Every operation stays O(1).$sol$,
  45,
  array['doubly linked list', 'hash map', 'buckets', 'o(1) design']
)
on conflict (slug) do nothing;
