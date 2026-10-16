# Curriculum content

One directory per topic id from `src/modules/curriculum/curriculumCatalog.ts`,
one markdown file per chapter:

```
content/curriculum/<topicId>/<NN>-<slug>.md
```

- `<topicId>` must match a topic id exactly — `backend.caching`, not `caching`.
  A directory that matches no topic is simply never rendered.
- `NN` is a zero-padded number and sets the reading order. Zero-pad it: `10-`
  sorts before `9-` in plain string order, and the numeric prefix is parsed, but
  the padding keeps the directory listing readable too.
- Anything that doesn't match `NN-slug.md` is ignored, so a README or a stray
  `.DS_Store` beside the chapters is harmless.

Every file starts with frontmatter:

```markdown
---
title: Why caching exists
minutes: 18
summary: One line shown under the chapter title in the list.
---

# Why caching exists

Body markdown — GFM, fenced code, tables.
```

`title` falls back to the filename slug if omitted, `minutes` and `summary` are
optional. The parser is a small flat `key: value` reader
(`src/modules/curriculum/frontmatter.ts`), not YAML — no nesting, no lists.

Raw HTML in these files is **not rendered** (`Markdown.tsx` has no
`rehype-raw`). Curriculum blocks are plain text/data: `text` fences become
numbered figures; `chart` fences become bar charts; `mermaid` fences become
flowcharts, sequence diagrams or state diagrams; and `widget` fences name a
registered interactive component (currently `estimation-calculator`). Other
language-tagged fences retain syntax highlighting and Copy controls.

Blockquotes beginning with `[!KEY]`, `[!PITFALL]` or `[!INTERVIEW]` become labelled
callouts. `[!CHECK]` uses the first paragraph as its question and the following
paragraphs as the hidden answer; separate them with a blank `>` line. Unmarked,
entirely bold blockquotes become Key rule boxes. Mermaid alone inserts SVG
produced by its strict sanitizer with HTML labels disabled; raw HTML/SVG from
the chapter still never renders. See `docs/handoff/curriculum-reader-redesign.md`
for the block grammars and examples.

To generate chapters, see `docs/curriculum-authoring-prompt.md`.
