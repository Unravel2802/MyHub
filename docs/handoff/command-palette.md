# Handoff — Global Command Palette (Claude Code → Codex)

Contract published (`src/lib/commandPalette.ts`,
`src/modules/commandPalette/useCommandPaletteStore.ts`). No migration, no new
`HueName` — this is a global keyboard-triggered overlay, not a routed page.

## What's published

- `src/lib/commandPalette.ts` — the registry itself, a plain module-level
  singleton (same spirit as `src/lib/events.ts`, not Zustand state, since
  nothing needs to re-render when the registry's _shape_ changes):
  - `register(moduleId, entries)` — namespaces each entry's id as
    `${moduleId}.${id}` and throws if that namespaced id is already taken.
    Call once per module, in a mount effect.
  - `unregister(moduleId)` — removes every entry namespaced to that module.
    Call in the same effect's cleanup, so remounts don't trip the collision
    guard.
  - `searchCommands(query)` — pure ranking: exact label match, then
    label-substring, then keyword-substring; empty query returns everything
    in registration order.
- `src/modules/commandPalette/useCommandPaletteStore.ts` — `isOpen`, `query`,
  `open`/`close`/`toggle`/`setQuery`. This is deliberately separate from the
  registry above — don't add the registry's `Map` into this store.

## What's yours

1. **The Cmd+K modal** — mount once in `AppShell.tsx`. A global `keydown`
   listener (Cmd/Ctrl+K) calls `useCommandPaletteStore`'s `toggle()`; the modal
   renders `searchCommands(query)` results live as `setQuery` updates; arrow
   keys move a highlighted selection, Enter calls the highlighted entry's
   `action()` and then `close()`, Escape just `close()`s.
2. **Each existing module's own command registrations** — a `useEffect` in
   each page/component that calls `register(moduleId, [...])` on mount and
   `unregister(moduleId)` on unmount. This is the "small, precisely-specified
   app-knowledge constant" work (exact command labels/keywords per module) —
   yours to fill in, not a schema or domain-logic decision. Suggested starter
   set, one per existing module: Task Engine ("New task", "Focus search"),
   Dashboard ("Refresh"), Prep Tracker ("New prep entry"), Job CRM ("New
   application"), Outreach Log ("Log outreach"), Achievements/Roadmap/Weekly
   Review/Offer Evaluator (at minimum a "Go to <page>" navigation command
   each), and Knowledge Base ("New note") once its page exists.
3. **Unit/E2E coverage for the modal and keyboard nav** —
   `commandPalette.test.ts` already covers the registry/ranking logic in
   isolation; you'll want a Playwright test exercising the actual Cmd+K open →
   type → arrow-select → Enter flow end to end.
