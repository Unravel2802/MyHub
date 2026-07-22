# Handoff — Design Drills: real code pad + equal panels (Claude → Codex)

Two things about the drill workspace still don't match LeetCode: the **right
panel is narrower than the left**, and the right panel **isn't a code pad** (no
language selector, no line numbers, no syntax highlighting).

Claude's only part of this was approving the dependency (below). **Codex owns
the component, the selector, the CSS, the preference module, and the tests.**

Decided with the Lead Architect — do not re-litigate:

- **Editor:** textarea-with-live-highlighting overlay using `highlight.js`.
- **Languages:** default **Markdown**; plaintext/python/typescript/javascript/
  go/java/sql selectable; choice persisted in localStorage (no DB migration).
- **Split:** equal **50/50**.

## Already landed by Claude

`highlight.js@^11.11.1` is now a **direct** dependency (it was already on disk
transitively via `rehype-highlight → lowlight → highlight.js`, so this added no
download) and is listed in the Approved Dependencies of both `CLAUDE.md` and
`AGENTS.md`. Nothing else changed — no component, CSS, store, or schema work.

## What to build

### 1. `CodePad` component — `src/modules/designDrills/components/CodePad.tsx`

The "highlighted overlay" technique. Three layers in a relative container, all
sharing **identical** font-family, font-size, line-height, padding and
letter-spacing (any mismatch visibly misaligns the caret from the text):

1. line-number gutter (`value.split("\n").length`),
2. `aria-hidden` `<pre><code class="hljs language-X">` holding the highlighted
   HTML,
3. the real `<textarea>` on top — `color: transparent`,
   `caret-color: var(--foreground)`, transparent background.

Details that will bite you:

- **Scroll sync:** the textarea's `onScroll` must push `scrollTop`/`scrollLeft`
  onto both the `<pre>` and the gutter.
- **Trailing newline:** append a trailing newline (or space) to the string you
  hand the highlighter, or the last empty line collapses and the caret drifts.
- **Bundle:** import `highlight.js/lib/core` and `registerLanguage` only the
  grammars offered. A bare `import hljs from "highlight.js"` pulls all 384.
- `spellCheck={false}`, autocorrect/autocapitalize off.
- **`dangerouslySetInnerHTML` is expected here and is fine** — `hljs.highlight()`
  HTML-escapes its input, and the input is the user's own scratchpad, not DB
  content. This is **not** a licence to relax the markdown rule: `Markdown.tsx`
  must still never render raw HTML from the DB and must never gain `rehype-raw`.

### 2. Language selector

- Options: **markdown (default)**, plaintext, python, typescript, javascript,
  go, java, sql.
- **Must not use `role="tab"` / `role="tabpanel"`.** `DrillBrief`'s Prompt/
  Solution tablist is on the same screen and `design-drills.spec.ts` queries
  `getByRole("tabpanel")` expecting a **single** match — a second tablist breaks
  it with a strict-mode violation. Use a native `<select>` (`role="combobox"`)
  or the existing `src/components/ui/select.tsx`.
- Its accessible label **must not contain** the string
  `"Your design (scratchpad)"` — `getByLabel` matches by substring and would
  become ambiguous.
- Persist it with a new module copying
  `src/modules/finance/components/financeLedgerView.ts` **exactly** — that's the
  established enum-preference pattern: storage-key const, `isX()` type guard,
  `getX()`, `getServerX()` (constant default for the SSR/hydration snapshot),
  `subscribeX()` with a cross-tab `storage` listener, `setX()`. Read it with
  `useSyncExternalStore`. **No DB migration** — `design_drill_attempts` has no
  spare column and a view preference doesn't warrant one.

### 3. Panel split + shared highlight theme

- `DrillWorkspace.tsx` (~line 141):
  `xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]` → equal halves
  (`xl:grid-cols-2`).
- `app/globals.css`: the hljs token theme (~lines 349–418) is scoped **entirely**
  to `.md-content`, so a code pad rendered outside that wrapper gets **zero**
  token colors. Widen the selectors to cover both scopes — e.g.
  `:is(.md-content, .code-pad) .hljs-…` — rather than duplicating the block. The
  hue variables it uses are already global, and it's variable-driven, so it
  must keep working in light _and_ dark.
- Optional polish: move the existing Saving…/Saved indicator into a bottom
  status bar (LeetCode puts it bottom-left). `Ln N, Col M` only if cheap.

### 4. Tests

**Preserve verbatim** (these currently pass — don't break them):
`getByLabel("Your design (scratchpad)")` + `.fill()`, exactly one `role="timer"`,
exactly one `role="tabpanel"`, `"Submit & self-grade"`, `"Finish attempt"`,
`"Self-grade against the rubric"`, and the rubric checkbox/radio accessible
names.

**Add:** switching language changes the highlighting (assert the `language-*` /
`hljs-*` class or a token element), the choice survives a reload, and line
numbers render for a multi-line value.

## Hard constraints

- **The scratchpad must stay a real `<textarea>`.** The spec does
  `.fill()` on it, which needs a real form control — this is exactly why
  CodeMirror/Monaco were rejected (they render `contentEditable`).
- Keep the visually-hidden `<label htmlFor>` carrying that exact string. Don't
  turn the visible header span into a second `<label>` and don't add a matching
  `aria-label`, or `getByLabel` becomes ambiguous.
- Repository/store/schema untouched — `notes` still round-trips verbatim (the
  spec asserts the saved string exactly).
- Gate on `npm run lint` + `npm run typecheck` + `npm run test:ui`.
