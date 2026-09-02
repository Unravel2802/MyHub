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
`rehype-raw`). Use markdown, and use fenced code blocks with a language tag for
syntax highlighting.

To generate chapters, see `docs/curriculum-authoring-prompt.md`.
