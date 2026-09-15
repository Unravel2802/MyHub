---
title: React and component models
minutes: 19
summary: Reconciliation and hooks — the mental model that makes re-renders predictable instead of mysterious.
---

React's entire API surface exists to answer one question: given that state
changed, what should the screen look like now? Understanding reconciliation
— how React decides what actually changed — is what turns "why did this
re-render" from a mystery into a predictable consequence of specific rules.

## The rendering model

```text
  React does NOT directly mutate the DOM when state changes.
  instead:

    state changes → component function RE-RUNS → returns a NEW
    tree of React elements (plain JS objects describing "what
    UI should look like") → React DIFFS the new tree against
    the previous one (RECONCILIATION) → applies only the
    MINIMAL set of real DOM changes needed
```

```text
  → "re-render" means the component FUNCTION ran again,
    producing a new element tree — it does NOT mean the DOM was
    necessarily touched. a component can re-render (function
    runs) and produce an IDENTICAL tree, in which case
    reconciliation finds no DOM changes needed at all.
```

## Reconciliation and keys

```text
  <ul>
    {items.map(item => <li key={item.id}>{item.name}</li>)}
  </ul>
```

```text
  → the KEY is how React matches an element in the new tree to
    the SAME element in the old tree, across a re-render —
    without a stable key, React falls back to matching by
    POSITION (index), which breaks the moment items are
    reordered, inserted, or removed:

    using array INDEX as key + reordering the list
      → React thinks "item at position 2 changed" even though
        the actual DATA at position 2 is now different data
        that used to be at position 3 — this can cause a
        FORM INPUT's value to appear attached to the wrong
        row after a reorder, since React reuses the DOM node
        it thinks is "the same" one.
```

```text
  → use a STABLE, UNIQUE identifier from the data itself (an
    id) as the key, never the array index, for any list that
    can reorder, filter, or have items inserted/removed.
```

## Hooks: state and effects tied to a component's lifetime

```text
  function Counter() {
    const [count, setCount] = useState(0);
    useEffect(() => {
      document.title = `Count: ${count}`;
    }, [count]);
    return <button onClick={() => setCount(count + 1)}>{count}</button>;
  }
```

```text
  useState    persists a value ACROSS re-renders — this is the
              closures chapter's mechanism directly: React
              keeps the state in a place tied to this component
              INSTANCE, and each render's function call closes
              over the value as of that render

  useEffect   runs AFTER the DOM has been updated to match this
              render — for anything that needs the real DOM, or
              needs to synchronize with something OUTSIDE
              React (a subscription, a timer, an API call)
```

```text
  the DEPENDENCY ARRAY controls WHEN an effect re-runs:

    useEffect(fn, [])          runs ONCE, after the first render
    useEffect(fn, [count])     re-runs whenever `count` changes
    useEffect(fn)               re-runs after EVERY render
                                 (rarely what's intended)
```

```text
  → an effect referencing a value NOT in its dependency array
    is the stale-closure bug from the JavaScript chapter,
    reappearing in React's specific idiom — the effect closed
    over the value as of whichever render scheduled it, and
    won't see a later render's value unless the dependency
    array tells React to re-create the effect when it changes.
```

## The Rules of Hooks, and why they exist

```text
  if (condition) {
    const [x, setX] = useState(0);   // ✗ NEVER call a hook
  }                                     conditionally
```

```text
  → React tracks hook state by CALL ORDER, not by name — the
    first useState call in a component is always "slot 0," the
    second is "slot 1," across every render. calling a hook
    conditionally means the ORDER can differ between renders,
    which desyncs which stored value belongs to which useState
    call — this is a real bug, not just a lint rule for its own
    sake.
```

## Composition over prop drilling

```text
  <App>
    <Layout theme={theme}>
      <Sidebar theme={theme}>
        <Nav theme={theme} />       ✗ threading `theme` through
      </Sidebar>                       three components that
    </Layout>                          don't use it themselves,
  </App>                                just to reach Nav
```

```text
  → CONTEXT (React's built-in dependency-injection mechanism)
    or restructuring via COMPOSITION (passing already-rendered
    children as props, so intermediate components don't need
    to know about `theme` at all) both avoid threading a prop
    through components that have no actual use for it.
```

## Server components: a genuinely different model

```text
  a React SERVER COMPONENT runs ONLY on the server, ships ZERO
  JavaScript for itself to the browser, and can access
  server-only resources (a database, a filesystem) directly —
  it is not a client component that happens to run early.

  → "use client" marks the BOUNDARY where client-side
    interactivity (state, effects, event handlers) begins — a
    server component tree can render client components as
    children, but a server component cannot be rendered INSIDE
    a client component's render output without crossing back
    through props.
```

```text
  → frontend.rendering covers the full spectrum this sits
    inside (CSR, SSR, SSG, streaming) — this chapter's point is
    narrower: server and client components are a fundamentally
    different execution model, not two flavors of the same
    component.
```

## What to take away

1. A re-render means the component function ran again and produced a new
   element tree — it does not necessarily mean the DOM changed, since
   reconciliation can find no real difference.
2. A key is how React matches elements across a re-render — using array
   index as key for a reorderable list causes React to misattribute state
   (like a form input's value) to the wrong row.
3. `useState` persists a value across renders via the same closure mechanism
   from the JavaScript chapter; a value read in `useEffect` but missing from
   its dependency array is that chapter's stale-closure bug in React's own
   idiom.
4. Hooks are tracked by call order across renders, not by name — calling one
   conditionally desyncs which stored value belongs to which call, which is
   why the rule exists.
5. A server component runs only on the server and ships no JavaScript for
   itself — it's a genuinely different execution model from a client
   component, not an early-running variant of the same thing.
