-- Design Drills: structured editorials for the 8 'coding_design' drills (0045).
--
-- Shape per docs/handoff/design-drills-problem-template.md §2. For these drills
-- `estimates` carries per-operation time/space complexity rather than
-- throughput/latency/cost — it's the same "quantitative panel" slot, and the
-- panel's heading is chosen per category by the UI.
--
-- Every codeExamples block is the exact source that was differentially tested
-- (Python reference vs. C++ and Java over randomized operation traces) before
-- this migration was generated; edit them as a set, not one language alone.
--
-- A plain `set`, so re-applying is harmless.

-- bookshelf-bookmark ------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Two requirements pull in different directions: **order** (insert anywhere, keep
the shelf sequence) and **lookup** (reach any book by id instantly). A doubly
linked list gives O(1) insert/remove *once you hold the node*; a hash map from
id to node gives you the node in O(1). Together they make every operation
O(1), the same composition as an LRU cache. The bookmark is a pointer into
the list, so deleting its target forces you to pick a policy and keep the
pointer valid.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- **Hash map `id -> node`**: O(1) access to any book, which `get`, `update`,
  `delete` and `add(after_id=...)` all need.
- **Doubly linked list of nodes**: O(1) splice in or out given a node. It needs
  *doubly* linked because `delete` must reach the previous node without a scan.
- **Sentinel `head` and `tail`**: dummy nodes at both ends, so every real node
  always has a real `prev` and `next`. No `if node is first` branches.
- **Id counter**: ids are never reused, so a stale id can't silently refer to
  a newer book.

Why not the alternatives: an array keeps order but inserting in the middle
shifts O(n) elements; a list alone needs an O(n) scan to find `after_id`.$md$),
    jsonb_build_object('id', 'bookmark-policy', 'heading', 'The bookmark policy', 'body', $md$The bookmark holds a **node reference**, not an index, so inserts and
unrelated deletes never disturb it. Only deleting the bookmarked node itself
needs a rule. Reasonable choices, which you should name before coding:

| Policy | Behavior | Trade-off |
| --- | --- | --- |
| Slide forward, else back, else clear | Lands on the next book; at the end, the previous one | Feels natural for "keep reading" |
| Always clear | Bookmark becomes `None` | Simplest, loses the user's place |
| Refuse the delete | Raise while bookmarked | Pushes the problem to the caller |

The reference uses *forward, else back, else clear*. Apply it **before**
unlinking, while `n.next` and `n.prev` are still meaningful.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$All operations are pointer splices plus one hash-map access. `get` returns a
copy so callers can't mutate (or keep alive) internal nodes.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$struct Book {
    int id;
    std::string title, author;
};

class Bookshelf {
    struct Node {
        Book book;
        Node* prev = nullptr;
        Node* next = nullptr;
    };
    Node head, tail;  // sentinels: no empty-list special cases
    std::unordered_map<int, std::unique_ptr<Node>> nodes;  // id -> node, O(1) access
    Node* bookmark = nullptr;
    int nextId = 1;

public:
    Bookshelf() { head.next = &tail; tail.prev = &head; }

    int add(const std::string& title, const std::string& author,
            std::optional<int> afterId = std::nullopt) {
        Node* prev = afterId ? nodes.at(*afterId).get() : tail.prev;  // throws before mutating
        auto owned = std::make_unique<Node>(Node{{nextId++, title, author}});  // ids never reused
        Node* n = owned.get();
        n->prev = prev;
        n->next = prev->next;
        prev->next->prev = n;
        prev->next = n;
        nodes[n->book.id] = std::move(owned);
        return n->book.id;
    }

    Book get(int id) const { return nodes.at(id)->book; }  // a copy, never the node

    void update(int id, std::optional<std::string> title, std::optional<std::string> author) {
        Book& b = nodes.at(id)->book;
        if (title) b.title = *title;
        if (author) b.author = *author;
    }

    void remove(int id) {
        Node* n = nodes.at(id).get();
        if (bookmark == n)  // policy: slide forward, else back, else clear
            bookmark = n->next != &tail ? n->next : n->prev != &head ? n->prev : nullptr;
        n->prev->next = n->next;
        n->next->prev = n->prev;
        nodes.erase(id);  // frees the node last, after every pointer to it is gone
    }

    void setBookmark(int id) { bookmark = nodes.at(id).get(); }

    std::optional<Book> getBookmark() const {
        if (!bookmark) return std::nullopt;
        return bookmark->book;
    }

    std::vector<Book> listBooks() const {
        std::vector<Book> out;
        for (const Node* cur = head.next; cur != &tail; cur = cur->next) out.push_back(cur->book);
        return out;
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$record Book(int id, String title, String author) {}

class Bookshelf {
    private static final class Node {
        final int id;
        String title, author;
        Node prev, next;

        Node(int id, String title, String author) {
            this.id = id;
            this.title = title;
            this.author = author;
        }
    }

    private final Node head = new Node(0, null, null);  // sentinels: no empty-list special cases
    private final Node tail = new Node(0, null, null);
    private final Map<Integer, Node> nodes = new HashMap<>();  // id -> node, O(1) access
    private Node bookmark;
    private int nextId = 1;

    Bookshelf() {
        head.next = tail;
        tail.prev = head;
    }

    int add(String title, String author, Integer afterId) {
        Node prev = afterId == null ? tail.prev : lookup(afterId);  // throws before mutating
        Node n = new Node(nextId++, title, author);  // ids are never reused
        n.prev = prev;
        n.next = prev.next;
        prev.next.prev = n;
        prev.next = n;
        nodes.put(n.id, n);
        return n.id;
    }

    Book get(int id) {
        Node n = lookup(id);
        return new Book(n.id, n.title, n.author);  // a copy, never the node
    }

    void update(int id, String title, String author) {
        Node n = lookup(id);
        if (title != null) n.title = title;
        if (author != null) n.author = author;
    }

    void delete(int id) {
        Node n = lookup(id);
        nodes.remove(id);
        if (bookmark == n)  // policy: slide forward, else back, else clear
            bookmark = n.next != tail ? n.next : n.prev != head ? n.prev : null;
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }

    void setBookmark(int id) { bookmark = lookup(id); }

    Book getBookmark() { return bookmark == null ? null : get(bookmark.id); }

    List<Book> listBooks() {
        List<Book> out = new ArrayList<>();
        for (Node cur = head.next; cur != tail; cur = cur.next) out.add(get(cur.id));
        return out;
    }

    private Node lookup(int id) {
        Node n = nodes.get(id);
        if (n == null) throw new NoSuchElementException("no book " + id);
        return n;
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$class _Node:
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
        return out$py$)
    )),
    jsonb_build_object('id', 'pitfalls', 'heading', 'Pitfalls', 'body', $md$- **Unlink order.** `n.prev.next = n.next` and `n.next.prev = n.prev` both
  read `n`'s own pointers, which stay intact, so the order between them is
  safe. Inserting is the delicate one: set the new node's pointers first,
  then `prev.next.prev` *before* overwriting `prev.next`.
- **Validate, then mutate.** Checking `after_id` after allocating an id
  leaves a gap in the id sequence (or worse, a half-linked node).
- **Bookmark before unlink.** Decide the new bookmark while the deleted node
  still points at its neighbours.
- **Identity, not equality.** Compare nodes with `is` / reference equality;
  two different books can have equal fields.$md$),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **`move(id, after_id)`**: unlink the node and relink it after the target,
  both O(1). Guard `id == after_id`, which is a no-op.
- **Per-user bookmarks**: `user -> node`. A delete can now invalidate many
  bookmarks. Either keep a reverse index `node -> set(users)` and fix them all
  (O(users on that book)), or mark the node deleted and repair a bookmark
  lazily the next time that user reads it.
- **Undo delete**: push `(node, prev, next)` on a stack. Re-linking is safe
  only if the neighbours haven't changed since, so either record operations
  more richly or limit undo to the latest operation.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$add / get / update / delete$t$, 'value', $t$O(1)$t$, 'note', $t$hash-map lookup plus a pointer splice$t$),
    jsonb_build_object('label', $t$set_bookmark / get_bookmark$t$, 'value', $t$O(1)$t$),
    jsonb_build_object('label', $t$list_books$t$, 'value', $t$O(n)$t$, 'note', $t$one walk from head to tail$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(n)$t$, 'note', $t$one node and one map entry per book$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 146: LRU Cache (same map + list composition)$t$, 'url', 'https://leetcode.com/problems/lru-cache/'),
    jsonb_build_object('label', $t$LeetCode 707: Design Linked List$t$, 'url', 'https://leetcode.com/problems/design-linked-list/')
  )
) where slug = 'bookshelf-bookmark';

-- hit-counter -------------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Counting hits in a sliding window is easy with a queue of timestamps, but the
queue grows with traffic. The window has a fixed number of *seconds*, so keep
one counter per second in a ring of W buckets. Each bucket also remembers
which second it currently represents, so an old bucket is recycled the moment
its slot comes around again. Memory becomes O(W), independent of hit rate.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$**Baseline: a queue.** Append every hit's timestamp. On `count(t)`, pop from
the front while `front <= t - 300`, then return the queue's length. Correct,
amortized O(1), but a million hits a second means a million queue entries a
second.

**Buckets.** All that matters is *how many* hits each second had. Keep two
arrays of length W: `times[i]` is the second slot `i` currently holds and
`counts[i]` is its hit count. Second `t` maps to slot `t % W`.

- `record(t)`: if `times[t % W] != t`, the slot holds a second at least W
  seconds old, so reset it to `(t, 0)`. Then increment.
- `count(t)`: sum `counts[i]` over slots whose `times[i]` is inside the
  window, i.e. `t - times[i] < W`.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$The stored second is what makes a slot safe to reuse. Without it, a hit at
t = 305 would be added to t = 5's count.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$// Hits in the trailing `window` seconds: O(1) record, O(window) count and memory.
class HitCounter {
    int window;
    std::vector<long long> times;   // which second each bucket currently holds
    std::vector<long long> counts;  // hits recorded in that second

public:
    explicit HitCounter(int window = 300) : window(window), times(window, 0), counts(window, 0) {}

    void record(long long timestamp) {
        int i = timestamp % window;
        if (times[i] != timestamp) {  // bucket holds a stale second: recycle it
            times[i] = timestamp;
            counts[i] = 0;
        }
        ++counts[i];
    }

    long long count(long long timestamp) const {
        long long total = 0;
        for (int i = 0; i < window; ++i)
            if (timestamp - times[i] < window) total += counts[i];
        return total;
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$// Hits in the trailing `window` seconds: O(1) record, O(window) count and memory.
class HitCounter {
    private final int window;
    private final long[] times;   // which second each bucket currently holds
    private final long[] counts;  // hits recorded in that second

    HitCounter(int window) {
        this.window = window;
        this.times = new long[window];
        this.counts = new long[window];
    }

    void record(long timestamp) {
        int i = (int) (timestamp % window);
        if (times[i] != timestamp) {  // bucket holds a stale second: recycle it
            times[i] = timestamp;
            counts[i] = 0;
        }
        counts[i]++;
    }

    long count(long timestamp) {
        long total = 0;
        for (int i = 0; i < window; i++)
            if (timestamp - times[i] < window) total += counts[i];
        return total;
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$class HitCounter:
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
        )$py$)
    )),
    jsonb_build_object('id', 'trade-offs', 'heading', 'Trade-offs', 'body', $md$- **O(W) count.** With W = 300 that's 300 additions, which is negligible. For a
  much larger window, keep a running total: add on `record`, and subtract a
  slot's count when you recycle it. Note that a stretch with no traffic
  leaves expired slots unrecycled, so you'd also need to sweep them on
  `count`.
- **Granularity.** For a 24-hour window, use one bucket per minute
  (1440 slots) and accept up to a minute of edge error, or keep
  second-level buckets for only the most recent minute.$md$),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **Late hits.** A hit for second `t` arriving after slot `t % W` was recycled
  for `t + W` would reset the newer data. Drop hits older than the window,
  and only apply a late hit to its slot if the slot still holds `t`.
- **Concurrency.** Shard the counters (per thread or CPU) and sum on read, or
  use atomic increments per slot; the reset needs a compare-and-swap on
  `times[i]`.
- **Many hosts.** Each host keeps its own ring and periodically ships
  per-second counts to an aggregator. Global counts are then slightly delayed,
  which is fine for a dashboard.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$record$t$, 'value', $t$O(1)$t$),
    jsonb_build_object('label', $t$count$t$, 'value', $t$O(W)$t$, 'note', $t$W = 300 slots; O(1) with a running total$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(W)$t$, 'note', $t$two W-length arrays, independent of traffic$t$),
    jsonb_build_object('label', $t$Queue baseline space$t$, 'value', $t$O(hits in window)$t$, 'note', $t$what Part 2 rules out$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 362: Design Hit Counter$t$, 'url', 'https://leetcode.com/problems/design-hit-counter/')
  )
) where slug = 'hit-counter';

-- time-travel-kv-store ----------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Each key's history is a list of `(timestamp, value)` that only ever grows at
the end, and because timestamps increase, the list stays sorted for free. A
point-in-time read is then the classic "last element <= t" binary search.
Deletes don't erase history; they append a **tombstone** so the timeline
stays intact for reads before the delete.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- `times[key]`: ascending write timestamps. `values[key]`: values in the same
  order (parallel arrays, or one list of pairs).
- `set`: append to both. Strictly increasing timestamps mean no sort is ever
  needed. Reject a timestamp `<=` the last one instead of corrupting the order.
- `get(key, t)`: `i = bisect_right(times, t) - 1` is the index of the last
  write with timestamp `<= t`. If `i < 0`, the query predates the first write.$md$),
    jsonb_build_object('id', 'tombstones', 'heading', 'Deletes as tombstones', 'body', $md$Physically removing history would break "what was it *before* the delete?".
Instead, `delete(key, t)` appends a sentinel value at `t`. `get` treats
landing on the sentinel as "absent". A later `set` appends after it, so the
key comes back naturally. This is the same idea LSM-tree databases use for
deletes.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$`bisect_right` returns the first index whose timestamp is strictly greater
than `t`, so one step back is the answer. Using `bisect_left` would wrongly
skip a write made exactly at `t`.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class TimeMap {
    // key -> (timestamp, value) in ascending timestamp order; nullopt is a delete.
    std::unordered_map<std::string,
                       std::vector<std::pair<long long, std::optional<std::string>>>> history;

    void append(const std::string& key, std::optional<std::string> value, long long timestamp) {
        auto& h = history[key];
        if (!h.empty() && timestamp <= h.back().first)
            throw std::invalid_argument("timestamps must strictly increase per key");
        h.emplace_back(timestamp, std::move(value));  // appends keep it sorted for free
    }

public:
    void set(const std::string& key, const std::string& value, long long timestamp) {
        append(key, value, timestamp);
    }

    void remove(const std::string& key, long long timestamp) {
        append(key, std::nullopt, timestamp);  // history is append-only
    }

    std::optional<std::string> get(const std::string& key, long long timestamp) const {
        auto it = history.find(key);
        if (it == history.end()) return std::nullopt;
        const auto& h = it->second;
        // First write strictly after `timestamp`; the one before it is the answer.
        auto after = std::upper_bound(h.begin(), h.end(), timestamp,
                                      [](long long t, const auto& e) { return t < e.first; });
        if (after == h.begin()) return std::nullopt;
        return std::prev(after)->second;
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class TimeMap {
    private static final Object TOMBSTONE = new Object();
    private final Map<String, List<Long>> times = new HashMap<>();     // ascending per key
    private final Map<String, List<Object>> values = new HashMap<>();  // parallel to times

    void set(String key, String value, long timestamp) { append(key, value, timestamp); }

    void delete(String key, long timestamp) { append(key, TOMBSTONE, timestamp); }  // append-only

    String get(String key, long timestamp) {
        List<Long> ts = times.get(key);
        if (ts == null) return null;
        int lo = 0, hi = ts.size();  // first write strictly after `timestamp`
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (ts.get(mid) <= timestamp) lo = mid + 1;
            else hi = mid;
        }
        if (lo == 0) return null;
        Object value = values.get(key).get(lo - 1);  // the write just before it
        return value == TOMBSTONE ? null : (String) value;
    }

    private void append(String key, Object value, long timestamp) {
        List<Long> ts = times.computeIfAbsent(key, k -> new ArrayList<>());
        if (!ts.isEmpty() && timestamp <= ts.get(ts.size() - 1))
            throw new IllegalArgumentException("timestamps must strictly increase per key");
        ts.add(timestamp);  // appends keep it sorted for free
        values.computeIfAbsent(key, k -> new ArrayList<>()).add(value);
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$import bisect

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
        return None if value is _TOMBSTONE else value$py$)
    )),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **Out-of-order writes**: `insort` keeps the list sorted at O(h) per write,
  which is fine for small histories. Otherwise use a balanced BST per key
  (`TreeMap.floorEntry` in Java, `std::map::upper_bound` in C++), O(log h)
  for both operations.
- **Compaction**: if nobody queries before time `T`, drop every version older
  than the *last* version at or before `T`. That one must stay, because it's
  the answer for queries just after `T`.
- **`get_range`**: two binary searches (`bisect_left(t1)`, `bisect_right(t2)`)
  and a slice, O(log h + answer size).$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$set / delete$t$, 'value', $t$O(1) amortized$t$, 'note', $t$append; timestamps already sorted$t$),
    jsonb_build_object('label', $t$get$t$, 'value', $t$O(log h)$t$, 'note', $t$h = writes to that key$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(total writes)$t$, 'note', $t$full history, including tombstones$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 981: Time Based Key-Value Store$t$, 'url', 'https://leetcode.com/problems/time-based-key-value-store/')
  )
) where slug = 'time-travel-kv-store';

-- text-editor-cursor ------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$A cursor splits the document into two halves, and every operation only
touches characters **next to the cursor**. Store the left half as a stack
(top = character just before the cursor) and the right half as a stack
(top = character just after it). Typing pushes, backspace pops, moving the
cursor pops from one stack and pushes onto the other. Undo is a history stack
of operations, each storing exactly what it *did*, so it can be inverted
precisely.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- `left`: characters before the cursor, nearest last.
- `right`: characters after the cursor, **stored reversed**, nearest last.

| Operation | Effect | Cost |
| --- | --- | --- |
| `add_text(s)` | push `s` onto `left` | O(len s) |
| `delete_text(k)` | pop `min(k, len(left))` from `left` | O(k) |
| `cursor_left(k)` | move `min(k, len(left))` chars from `left` to `right` | O(k) |
| `cursor_right(k)` | move `min(k, len(right))` chars from `right` to `left` | O(k) |

The 10-character view is just the top 10 of `left`.

A gap buffer (one array with a movable gap) is the production version of the
same idea; a rope or piece table helps when edits are far apart.$md$),
    jsonb_build_object('id', 'undo', 'heading', 'Undo', 'body', $md$Push one history entry per operation, recording what **actually** happened:

- `add` -> the number of characters inserted. Inverse: pop that many from `left`.
- `delete` -> the characters actually removed. Inverse: push them back.
- `left` / `right` -> the distance actually moved. Inverse: move the same
  distance the other way.

Recording the *requested* k instead is the trap. `cursor_left(50)` at
position 3 moves 3; undoing it by 50 would carry the cursor up to 47
characters past where it started. Each undo is O(k) for its own k, so Part 1's bound holds.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$Python lists and C++/Java strings work as stacks here: append and pop at the
end are amortized O(1).$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class TextEditor {
    std::string left;   // chars before the cursor, nearest char last
    std::string right;  // chars after the cursor, stored reversed: nearest char last
    struct Op {
        char kind;  // 'a'dd, 'd'elete, 'l'eft, 'r'ight
        int n;
        std::string removed;
    };
    std::vector<Op> history;

    static int move(std::string& src, std::string& dst, int k) {
        k = std::min<int>(k, src.size());
        for (int i = 0; i < k; ++i) {
            dst.push_back(src.back());
            src.pop_back();
        }
        return k;
    }

    std::string view() const { return left.substr(left.size() - std::min<size_t>(10, left.size())); }

public:
    void addText(const std::string& text) {
        left += text;
        history.push_back({'a', (int)text.size(), ""});
    }

    int deleteText(int k) {
        k = std::min<int>(k, left.size());
        std::string removed = left.substr(left.size() - k);
        left.resize(left.size() - k);
        history.push_back({'d', k, removed});
        return k;
    }

    std::string cursorLeft(int k) {
        history.push_back({'l', move(left, right, k), ""});
        return view();
    }

    std::string cursorRight(int k) {
        history.push_back({'r', move(right, left, k), ""});
        return view();
    }

    bool undo() {
        if (history.empty()) return false;
        Op op = history.back();
        history.pop_back();
        switch (op.kind) {
            case 'a': left.resize(left.size() - op.n); break;
            case 'd': left += op.removed; break;
            case 'l': move(right, left, op.n); break;  // replay exactly what moved
            case 'r': move(left, right, op.n); break;
        }
        return true;
    }

    std::string text() const { return left + std::string(right.rbegin(), right.rend()); }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class TextEditor {
    private final StringBuilder left = new StringBuilder();   // chars before the cursor
    private final StringBuilder right = new StringBuilder();  // chars after it, reversed: nearest last
    private record Op(char kind, int n, String removed) {}    // 'a'dd, 'd'elete, 'l'eft, 'r'ight
    private final Deque<Op> history = new ArrayDeque<>();

    void addText(String text) {
        left.append(text);
        history.push(new Op('a', text.length(), null));
    }

    int deleteText(int k) {
        k = Math.min(k, left.length());
        String removed = left.substring(left.length() - k);
        left.setLength(left.length() - k);
        history.push(new Op('d', k, removed));
        return k;
    }

    String cursorLeft(int k) {
        history.push(new Op('l', move(left, right, k), null));
        return view();
    }

    String cursorRight(int k) {
        history.push(new Op('r', move(right, left, k), null));
        return view();
    }

    boolean undo() {
        Op op = history.poll();
        if (op == null) return false;
        switch (op.kind()) {
            case 'a' -> left.setLength(left.length() - op.n());
            case 'd' -> left.append(op.removed());
            case 'l' -> move(right, left, op.n());  // replay exactly what moved
            case 'r' -> move(left, right, op.n());
        }
        return true;
    }

    String text() { return left + new StringBuilder(right).reverse().toString(); }

    private String view() { return left.substring(Math.max(0, left.length() - 10)); }

    private static int move(StringBuilder src, StringBuilder dst, int k) {
        k = Math.min(k, src.length());
        for (int i = 0; i < k; i++) {
            dst.append(src.charAt(src.length() - 1));
            src.setLength(src.length() - 1);
        }
        return k;
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$class TextEditor:
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
        return "".join(self.left) + "".join(reversed(self.right))$py$)
    )),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **Redo**: `undo` pushes the inverted entry onto a redo stack; `redo` pops it
  and re-applies it. Any new edit clears the redo stack, because redoing past
  a divergent edit is meaningless.
- **Grouping**: merge consecutive `add` entries into one while there's no
  cursor move between them and the gap since the last keystroke is under N ms.
- **Multiple cursors**: two stacks no longer suffice. Use one buffer
  (gap buffer / piece table) with sorted cursor offsets, and shift the offsets
  after each edit.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$add_text$t$, 'value', $t$O(len text)$t$),
    jsonb_build_object('label', $t$delete_text / cursor moves$t$, 'value', $t$O(k)$t$, 'note', $t$k clamped to the available characters$t$),
    jsonb_build_object('label', $t$undo$t$, 'value', $t$O(k)$t$, 'note', $t$k of the operation being undone$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(n + history)$t$, 'note', $t$deleted text is kept in history$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 2296: Design a Text Editor$t$, 'url', 'https://leetcode.com/problems/design-a-text-editor/')
  )
) where slug = 'text-editor-cursor';

-- random-pick-inventory ---------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Uniform random choice needs the items **packed in an array**: pick a random
index. Fast removal needs to **find** an item in O(1): a hash map from item to
its array positions. The usual tension is that deleting from the middle of an
array is O(n), and the fix is to overwrite the hole with the last element and
shrink by one, since order doesn't matter. With duplicates, each item maps to
a *set* of positions.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- `items`: one array slot per copy. `pick_random` is `items[randrange(len)]`,
  uniform over copies by construction.
- `where[item]`: the set of slots currently holding `item`.

**Remove one copy of `x`:**
1. Remove any slot `hole` from `where[x]`.
2. Let `last` be the item in the final slot. Write `last` into `hole`.
3. Update `last`'s slot set: add `hole`, discard the final slot index.
4. Pop the array. If `where[x]` is now empty, delete the key.

In Part 1 (no duplicates), `where` maps to a single index and steps 1-4
reduce to the familiar RandomizedSet.$md$),
    jsonb_build_object('id', 'self-swap', 'heading', 'The self-swap edge case', 'body', $md$When `hole` *is* the final slot (and therefore `last == x`), step 3 must
**add before it discards**. Adding `hole` then discarding the final index
(the same number) nets out to removing it, which is correct. Discarding first
and then adding would leave a dangling index pointing past the end of the
array. Tracing the "remove the only copy" and "remove the copy in the last
slot" cases by hand is what interviewers look for here.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$In Java, watch `List.remove(int)` (by index) versus `Set.remove(Object)` (by
value). Both appear in `remove`, with `int` arguments.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class Inventory {
    std::vector<std::string> items;  // one slot per copy: pickRandom indexes this
    std::unordered_map<std::string, std::unordered_set<size_t>> where;  // item -> its slots
    std::mt19937 rng{std::random_device{}()};

public:
    void add(const std::string& item) {
        where[item].insert(items.size());
        items.push_back(item);
    }

    bool remove(const std::string& item) {
        auto it = where.find(item);
        if (it == where.end()) return false;
        size_t hole = *it->second.begin(), lastSlot = items.size() - 1;
        it->second.erase(hole);
        std::string last = items[lastSlot];
        // Fill the hole with the last copy, then shrink: O(1), nothing shifts.
        items[hole] = last;
        where[last].insert(hole);
        where[last].erase(lastSlot);
        items.pop_back();
        if (it->second.empty()) where.erase(it);
        return true;
    }

    size_t count(const std::string& item) const {
        auto it = where.find(item);
        return it == where.end() ? 0 : it->second.size();
    }

    const std::string& pickRandom() {  // uniform over copies, not item types
        if (items.empty()) throw std::out_of_range("empty inventory");
        return items[std::uniform_int_distribution<size_t>(0, items.size() - 1)(rng)];
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class Inventory {
    private final List<String> items = new ArrayList<>();            // one slot per copy
    private final Map<String, Set<Integer>> where = new HashMap<>();  // item -> its slots
    private final Random rng = new Random();

    void add(String item) {
        where.computeIfAbsent(item, k -> new HashSet<>()).add(items.size());
        items.add(item);
    }

    boolean remove(String item) {
        Set<Integer> slots = where.get(item);
        if (slots == null) return false;
        int hole = slots.iterator().next(), lastSlot = items.size() - 1;
        slots.remove(hole);
        String last = items.get(lastSlot);
        // Fill the hole with the last copy, then shrink: O(1), nothing shifts.
        items.set(hole, last);
        where.get(last).add(hole);
        where.get(last).remove(lastSlot);  // Set.remove(Object): boxed, not an index
        items.remove(lastSlot);            // List.remove(int): by index
        if (slots.isEmpty()) where.remove(item);
        return true;
    }

    int count(String item) {
        Set<Integer> slots = where.get(item);
        return slots == null ? 0 : slots.size();
    }

    String pickRandom() {  // uniform over copies, not item types
        if (items.isEmpty()) throw new NoSuchElementException("empty inventory");
        return items.get(rng.nextInt(items.size()));
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$import random


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
        return random.choice(self.items)  # uniform over copies, not item types$py$)
    )),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **Weighted pick**: with static weights, build prefix sums and binary-search
  a random number in `[0, total)`, O(log n). With frequently changing weights,
  a Fenwick tree gives O(log n) for both updates and picks.
- **`remove_all(x)`**: run the swap-remove once per copy, O(copies). Removing
  in descending slot order avoids moving a copy of `x` into a hole you're
  about to clear.
- **Without replacement**: `pick_random` followed by `remove` of that copy;
  this is an online Fisher-Yates shuffle.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$add / remove / count$t$, 'value', $t$O(1) average$t$, 'note', $t$hash-set operations$t$),
    jsonb_build_object('label', $t$pick_random$t$, 'value', $t$O(1)$t$, 'note', $t$random index into a packed array$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(n)$t$, 'note', $t$n = total copies$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 380: Insert Delete GetRandom O(1)$t$, 'url', 'https://leetcode.com/problems/insert-delete-getrandom-o1/'),
    jsonb_build_object('label', $t$LeetCode 381: Insert Delete GetRandom O(1), Duplicates allowed$t$, 'url', 'https://leetcode.com/problems/insert-delete-getrandom-o1-duplicates-allowed/')
  )
) where slug = 'random-pick-inventory';

-- in-memory-file-system ---------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$Paths are sequences of names, and a directory tree is a **trie** over those
names: each node maps a child name to a child node. One `walk` helper that
follows (and optionally creates) the path does almost all the work; each
public method is a few lines on top of it. The details interviewers probe are
the file/directory distinction and the error cases.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- **Node**: `children: name -> Node` for directories; `content` for files.
  Keep an explicit marker of which it is (here, `content is None` means
  directory). Inferring it from "has no children" breaks on empty directories.
- **`walk(parts, create)`**: start at the root and step through each name,
  creating missing directories if `create` is set. Refuse to step *through* a
  file.
- **`write`**: walk to the parent with `create=True`, check the parent isn't a
  file, then create the file node if needed and append.
- **`ls`**: a file returns its own name; a directory returns its sorted child
  names.
- **`size`**: a file's length, or the recursive sum over children.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$C++ and Java keep children in an ordered map (`std::map` / `TreeMap`), so
`ls` is already sorted at the cost of O(log c) lookups. Python uses a dict and
sorts in `ls`. Either is fine; say which you chose and why.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class FileSystem {
    struct Node {
        bool isFile = false;
        std::map<std::string, std::unique_ptr<Node>> children;  // ordered: ls is sorted for free
        std::string content;
    };
    Node root;

    static std::vector<std::string> split(const std::string& path) {
        std::vector<std::string> parts;
        std::stringstream ss(path);
        for (std::string p; std::getline(ss, p, '/');)
            if (!p.empty()) parts.push_back(p);
        return parts;
    }

    Node* walk(const std::vector<std::string>& parts, size_t depth, bool create) {
        Node* node = &root;
        for (size_t i = 0; i < depth; ++i) {
            if (node->isFile) throw std::runtime_error("not a directory");
            auto it = node->children.find(parts[i]);
            if (it == node->children.end()) {
                if (!create) throw std::runtime_error("no such file or directory");
                it = node->children.emplace(parts[i], std::make_unique<Node>()).first;
            }
            node = it->second.get();
        }
        return node;
    }

    static size_t subtreeSize(const Node* node) {
        if (node->isFile) return node->content.size();
        size_t total = 0;
        for (const auto& [name, child] : node->children) total += subtreeSize(child.get());
        return total;
    }

public:
    void mkdir(const std::string& path) {
        auto parts = split(path);
        if (walk(parts, parts.size(), true)->isFile) throw std::runtime_error("file exists");
    }

    void write(const std::string& path, const std::string& data) {
        auto parts = split(path);
        if (parts.empty()) throw std::runtime_error("is a directory");
        Node* parent = walk(parts, parts.size() - 1, true);
        if (parent->isFile) throw std::runtime_error("not a directory");
        auto& slot = parent->children[parts.back()];
        if (!slot) {
            slot = std::make_unique<Node>();
            slot->isFile = true;
        } else if (!slot->isFile) {
            throw std::runtime_error("is a directory");
        }
        slot->content += data;
    }

    std::string read(const std::string& path) {
        auto parts = split(path);
        Node* node = walk(parts, parts.size(), false);
        if (!node->isFile) throw std::runtime_error("is a directory");
        return node->content;
    }

    std::vector<std::string> ls(const std::string& path) {
        auto parts = split(path);
        Node* node = walk(parts, parts.size(), false);
        if (node->isFile) return {parts.back()};
        std::vector<std::string> names;
        for (const auto& [name, child] : node->children) names.push_back(name);
        return names;
    }

    size_t size(const std::string& path) {
        auto parts = split(path);
        return subtreeSize(walk(parts, parts.size(), false));
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class FileSystem {
    private static final class Node {
        final TreeMap<String, Node> children = new TreeMap<>();  // ordered: ls is sorted for free
        StringBuilder content;  // null for a directory
    }

    private final Node root = new Node();

    void mkdir(String path) {
        String[] parts = split(path);
        if (walk(parts, parts.length, true).content != null)
            throw new IllegalStateException("file exists: " + path);
    }

    void write(String path, String data) {
        String[] parts = split(path);
        if (parts.length == 0) throw new IllegalStateException("is a directory: " + path);
        Node parent = walk(parts, parts.length - 1, true);
        if (parent.content != null) throw new IllegalStateException("not a directory: " + path);
        Node node = parent.children.get(parts[parts.length - 1]);
        if (node == null) {
            node = new Node();
            node.content = new StringBuilder();
            parent.children.put(parts[parts.length - 1], node);
        } else if (node.content == null) {
            throw new IllegalStateException("is a directory: " + path);
        }
        node.content.append(data);
    }

    String read(String path) {
        String[] parts = split(path);
        Node node = walk(parts, parts.length, false);
        if (node.content == null) throw new IllegalStateException("is a directory: " + path);
        return node.content.toString();
    }

    List<String> ls(String path) {
        String[] parts = split(path);
        Node node = walk(parts, parts.length, false);
        if (node.content != null) return List.of(parts[parts.length - 1]);
        return new ArrayList<>(node.children.keySet());
    }

    long size(String path) {
        String[] parts = split(path);
        return subtreeSize(walk(parts, parts.length, false));
    }

    private Node walk(String[] parts, int depth, boolean create) {
        Node node = root;
        for (int i = 0; i < depth; i++) {
            if (node.content != null) throw new IllegalStateException("not a directory");
            Node child = node.children.get(parts[i]);
            if (child == null) {
                if (!create) throw new NoSuchElementException("no such file or directory");
                child = new Node();
                node.children.put(parts[i], child);
            }
            node = child;
        }
        return node;
    }

    private static long subtreeSize(Node node) {
        if (node.content != null) return node.content.length();
        long total = 0;
        for (Node child : node.children.values()) total += subtreeSize(child);
        return total;
    }

    private static String[] split(String path) {
        return Arrays.stream(path.split("/")).filter(p -> !p.isEmpty()).toArray(String[]::new);
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$class _Node:
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
        return sum(self._size(child) for child in node.children.values())$py$)
    )),
    jsonb_build_object('id', 'pitfalls', 'heading', 'Pitfalls', 'body', $md$- **Write under a file.** `walk` checks for files *between* path segments,
  but for `write("/notes.txt/x", ...)` the parent itself is the file. That
  needs its own check, or you'll silently create a child under a file.
- **Path splitting.** `"/".split("/")` yields empty strings, so filter them
  out. Then `"/"`, `"/a/"` and `"//a"` all behave.
- **Appending.** Concatenating immutable strings on every write is O(file
  size) each time. Append to a list or builder and join on read.$md$),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **O(depth) `size`**: store `total_bytes` on every directory node. On
  `write`, add `len(data)` to each directory along the path, which `walk`
  visits anyway. `rm` and `mv` subtract and add the subtree's total along the
  old and new paths.
- **`mv(src, dst)`**: detach the node from its parent's children and attach it
  under the new name. Reject moving a directory into its own subtree.
- **Huge files**: store content as fixed-size chunks (blocks), so appends and
  reads at an offset don't copy the whole file. This is how real file systems
  lay data out.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$mkdir / write / read$t$, 'value', $t$O(depth + data)$t$, 'note', $t$plus O(log c) per step with ordered children$t$),
    jsonb_build_object('label', $t$ls (directory)$t$, 'value', $t$O(c log c)$t$, 'note', $t$c = children; O(c) with an ordered map$t$),
    jsonb_build_object('label', $t$size (recursive)$t$, 'value', $t$O(subtree)$t$, 'note', $t$O(depth) with per-directory totals$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(nodes + bytes)$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 588: Design In-Memory File System$t$, 'url', 'https://leetcode.com/problems/design-in-memory-file-system/')
  )
) where slug = 'in-memory-file-system';

-- live-leaderboard --------------------------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$`top(k)` wants players **already sorted by score**; `update` changes one
player's position in that order. An ordered set (balanced BST) keyed by
`(-score, name)` keeps the order under updates in O(log n), and `top(k)` is
the first k elements. A hash map from player to current score lets you find
and remove the old key before inserting the new one.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- `score[player]`: the current score, for O(1) lookup.
- `ranked`: an ordered set of `(-score, player)`. Negating the score makes
  ascending order mean best first, and the name breaks ties ascending.

`update` removes `(-old, player)`, computes the new score, and inserts
`(-new, player)`. `top(k)` walks the first k entries.$md$),
    jsonb_build_object('id', 'baselines', 'heading', 'Why not a heap?', 'body', $md$| Approach | update | top(k) |
| --- | --- | --- |
| Map + sort on read | O(1) | O(n log n) |
| Map + heap of size k on read | O(1) | O(n log k) |
| Max-heap with lazy deletion | O(log n) | O(k log n), but popped entries must be pushed back, and stale entries pile up |
| **Map + ordered set** | **O(log n)** | **O(k)** |

A heap can't remove an arbitrary element or iterate in order without
destroying itself, which is exactly what a changing score needs.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$C++ `std::set` and Java `TreeSet` are red-black trees. Python's standard
library has no ordered set, so the Python version keeps a sorted list with
`bisect`, which is correct but O(n) per update because of the shifting. In an
interview, say so and name `sortedcontainers.SortedList` as the practical
fix.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class Leaderboard {
    std::unordered_map<std::string, long long> score;  // player -> current score
    std::set<std::pair<long long, std::string>> ranked;  // (-score, player): best first, ties by name

public:
    long long update(const std::string& player, long long delta) {
        auto it = score.find(player);
        long long old = 0;
        if (it != score.end()) {
            old = it->second;
            ranked.erase({-old, player});  // re-key = remove + insert, never mutate in place
        }
        long long now = old + delta;
        score[player] = now;
        ranked.insert({-now, player});
        return now;
    }

    bool remove(const std::string& player) {
        auto it = score.find(player);
        if (it == score.end()) return false;
        ranked.erase({-it->second, player});
        score.erase(it);
        return true;
    }

    std::vector<std::pair<std::string, long long>> top(int k) const {
        std::vector<std::pair<std::string, long long>> out;
        for (auto it = ranked.begin(); it != ranked.end() && (int)out.size() < k; ++it)
            out.push_back({it->second, -it->first});
        return out;
    }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class Leaderboard {
    record Entry(String player, long score) {}

    private final Map<String, Long> score = new HashMap<>();  // player -> current score
    private final TreeSet<Entry> ranked = new TreeSet<>(      // best first, ties by name
        Comparator.comparingLong(Entry::score).reversed().thenComparing(Entry::player));

    long update(String player, long delta) {
        Long old = score.get(player);
        if (old != null) ranked.remove(new Entry(player, old));  // re-key = remove + insert
        long now = (old == null ? 0 : old) + delta;
        score.put(player, now);
        ranked.add(new Entry(player, now));
        return now;
    }

    boolean remove(String player) {
        Long old = score.remove(player);
        if (old == null) return false;
        ranked.remove(new Entry(player, old));
        return true;
    }

    List<Entry> top(int k) {
        List<Entry> out = new ArrayList<>();
        for (Entry e : ranked) {
            if (out.size() == k) break;
            out.add(e);
        }
        return out;
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$import bisect


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
        return [(player, -neg) for neg, player in self.ranked[:k]]$py$)
    )),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **`rank(player)`**: a plain red-black tree can't count the elements before a
  node in O(log n). Use an order-statistics tree (subtree sizes), or, if
  scores are bounded integers, a Fenwick tree indexed by score that counts
  players at each score.
- **Sharding**: partition players by hash. The global top-k is guaranteed to
  be among the union of each shard's top-k, so merge s lists of k.
- **Daily board**: key the structure by day and create a fresh one at
  midnight. That's cheaper than resetting scores, and yesterday's board stays
  queryable.$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$update / remove$t$, 'value', $t$O(log n)$t$, 'note', $t$balanced BST; the Python bisect version is O(n)$t$),
    jsonb_build_object('label', $t$top(k)$t$, 'value', $t$O(k)$t$, 'note', $t$in-order walk from the best entry$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(n)$t$, 'note', $t$one map entry plus one tree node per player$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 1244: Design A Leaderboard$t$, 'url', 'https://leetcode.com/problems/design-a-leaderboard/')
  )
) where slug = 'live-leaderboard';

-- constant-time-frequency-tracker -----------------------------------------
update design_drills set solution_detail = jsonb_build_object(
  'summary', $md$O(1) min and max under both increments and decrements rules out heaps and
running extremes. The insight is that a count only ever changes by **1**, so
a key only moves to an *adjacent* count. Keep a doubly linked list of buckets
sorted by count, each holding the keys at that count. The head is the min,
the tail is the max, and every move is a constant number of pointer and
hash-set operations.$md$,
  'sections', jsonb_build_array(
    jsonb_build_object('id', 'approach', 'heading', 'Approach', 'body', $md$- **Bucket**: `count`, the set of `keys` with that count, `prev`, `next`.
- **List**: buckets in ascending `count` order between `head` and `tail`
  sentinels, with no empty buckets ever left in it.
- **`bucket_of[key]`**: the bucket currently holding the key.

`inc(key)`: let `cur` be the key's bucket (or `head`, standing for count 0).
If `cur.next` doesn't have count `cur.count + 1`, insert a new bucket right
after `cur`. Move the key there. If `cur` is now empty, unlink it.

`dec(key)` mirrors this toward `prev`, except that a key at count 1 is simply
removed from `bucket_of`.

`max_key` / `min_key`: any key in `tail.prev` / `head.next`.$md$),
    jsonb_build_object('id', 'why-not-heap', 'heading', 'Why the obvious approaches fail', 'body', $md$- **Running max**: fine for Part 1, since counts only grow. After `dec` on the
  max key you'd need the *second* largest count, which you don't have.
- **Heap**: O(log n) per update, and it needs lazy deletion or an indexed heap
  to reposition a key.
- **Count -> keys map alone**: finding the next non-empty count after a bucket
  empties is a scan.

The linked list fixes the last one: neighbours in the list are neighbours in
count, and empty buckets are removed, so the ends are always the extremes.$md$),
    jsonb_build_object('id', 'reference-implementation', 'heading', 'Reference implementation', 'body', $md$The C++ version uses `std::list` iterators, which stay valid when other
elements are inserted or erased. Python and Java hand-roll the list with
sentinels, the same as the bookshelf drill.$md$, 'codeExamples', jsonb_build_array(
      jsonb_build_object('language', 'cpp', 'label', 'C++', 'code', $cpp$class FrequencyTracker {
    struct Bucket {
        int count;
        std::unordered_set<std::string> keys;
    };
    std::list<Bucket> buckets;  // ascending by count; never holds an empty bucket
    std::unordered_map<std::string, std::list<Bucket>::iterator> bucketOf;

    void drop(std::list<Bucket>::iterator b, const std::string& key) {
        b->keys.erase(key);
        if (b->keys.empty()) buckets.erase(b);  // keeps min/max at the list ends: O(1)
    }

public:
    void inc(const std::string& key) {
        auto it = bucketOf.find(key);
        bool fresh = it == bucketOf.end();
        auto cur = fresh ? buckets.end() : it->second;
        int count = fresh ? 0 : cur->count;
        auto nxt = fresh ? buckets.begin() : std::next(cur);
        if (nxt == buckets.end() || nxt->count != count + 1)
            nxt = buckets.insert(nxt, {count + 1, {}});  // link before cur can vanish
        nxt->keys.insert(key);
        bucketOf[key] = nxt;
        if (!fresh) drop(cur, key);
    }

    void dec(const std::string& key) {
        auto it = bucketOf.find(key);
        if (it == bucketOf.end()) return;
        auto cur = it->second;
        if (cur->count == 1) {
            bucketOf.erase(it);
        } else {
            auto prv = cur == buckets.begin() ? buckets.end() : std::prev(cur);
            if (prv == buckets.end() || prv->count != cur->count - 1)
                prv = buckets.insert(cur, {cur->count - 1, {}});
            prv->keys.insert(key);
            it->second = prv;
        }
        drop(cur, key);
    }

    std::string maxKey() const { return buckets.empty() ? "" : *buckets.back().keys.begin(); }
    std::string minKey() const { return buckets.empty() ? "" : *buckets.front().keys.begin(); }
};$cpp$),
      jsonb_build_object('language', 'java', 'label', 'Java', 'code', $java$class FrequencyTracker {
    private static final class Bucket {
        final int count;
        final Set<String> keys = new HashSet<>();
        Bucket prev, next;

        Bucket(int count) { this.count = count; }
    }

    // Buckets ascend by count from head to tail; sentinels hold count 0.
    private final Bucket head = new Bucket(0), tail = new Bucket(0);
    private final Map<String, Bucket> bucketOf = new HashMap<>();

    FrequencyTracker() {
        head.next = tail;
        tail.prev = head;
    }

    void inc(String key) {
        Bucket cur = bucketOf.getOrDefault(key, head);
        Bucket nxt = cur.next;
        if (nxt == tail || nxt.count != cur.count + 1)
            nxt = insertAfter(cur, cur.count + 1);  // link before cur can vanish
        nxt.keys.add(key);
        bucketOf.put(key, nxt);
        if (cur != head) drop(cur, key);
    }

    void dec(String key) {
        Bucket cur = bucketOf.get(key);
        if (cur == null) return;
        if (cur.count == 1) {
            bucketOf.remove(key);
        } else {
            Bucket prv = cur.prev;
            if (prv == head || prv.count != cur.count - 1) prv = insertAfter(prv, cur.count - 1);
            prv.keys.add(key);
            bucketOf.put(key, prv);
        }
        drop(cur, key);
    }

    String maxKey() { return tail.prev == head ? null : tail.prev.keys.iterator().next(); }

    String minKey() { return head.next == tail ? null : head.next.keys.iterator().next(); }

    private Bucket insertAfter(Bucket prev, int count) {
        Bucket b = new Bucket(count);
        b.prev = prev;
        b.next = prev.next;
        prev.next.prev = b;
        prev.next = b;
        return b;
    }

    private void drop(Bucket b, String key) {
        b.keys.remove(key);
        if (b.keys.isEmpty()) {  // never keep an empty bucket: min/max must stay O(1)
            b.prev.next = b.next;
            b.next.prev = b.prev;
        }
    }
}$java$),
      jsonb_build_object('language', 'python', 'label', 'Python3', 'code', $py$class _Bucket:
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
        return None if self.head.next is self.tail else next(iter(self.head.next.keys))$py$)
    )),
    jsonb_build_object('id', 'pitfalls', 'heading', 'Pitfalls', 'body', $md$- **Order of operations.** Insert the destination bucket *relative to `cur`*
  before removing the key from `cur`. Removing first can unlink `cur`, and
  then there's nothing to insert next to.
- **The count-0 state.** A key is never stored at count 0. `inc` of a new
  key treats `head` as its "bucket"; `dec` at count 1 deletes the key.
- **Ties.** Any key in the extreme bucket is a valid answer, so tests must
  check the *count* of the returned key, not a specific key.$md$),
    jsonb_build_object('id', 'follow-ups', 'heading', 'Follow-ups', 'body', $md$- **All keys tied for the max**: return `tail.prev.keys`, O(size of the tie).
- **Top k keys**: walk buckets from the tail, O(k) total.
- **LFU cache**: these buckets keyed by access count, plus an LRU order
  *within* each bucket (an ordered dict / linked hash set). Evict the
  least-recently-used key from `head.next`. Every operation stays O(1).$md$)
  ),
  'estimates', jsonb_build_array(
    jsonb_build_object('label', $t$inc / dec$t$, 'value', $t$O(1)$t$, 'note', $t$average, due to hashing$t$),
    jsonb_build_object('label', $t$max_key / min_key$t$, 'value', $t$O(1)$t$, 'note', $t$the list's tail / head$t$),
    jsonb_build_object('label', $t$Space$t$, 'value', $t$O(n)$t$, 'note', $t$n = distinct keys; at most n buckets$t$)
  ),
  'references', jsonb_build_array(
    jsonb_build_object('label', $t$LeetCode 432: All O`one Data Structure$t$, 'url', 'https://leetcode.com/problems/all-oone-data-structure/'),
    jsonb_build_object('label', $t$LeetCode 460: LFU Cache$t$, 'url', 'https://leetcode.com/problems/lfu-cache/')
  )
) where slug = 'constant-time-frequency-tracker';
