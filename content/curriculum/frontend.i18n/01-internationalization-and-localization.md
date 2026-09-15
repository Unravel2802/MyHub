---
title: Internationalization and localization
minutes: 16
summary: Text that changes length under you, and the layout that has to survive it.
---

Internationalization (i18n) is the engineering work that makes localization
(l10n — actually translating and adapting for a locale) possible later
without a rewrite. Most i18n bugs aren't translation mistakes — they're
layout and logic that quietly assumed English's specific rules were
universal.

## Pluralization is not just "add an s"

```text
  `${count} item${count !== 1 ? 's' : ''}`   ✗ works for English,
                                                 hardcodes English's
                                                 specific 2-form
                                                 plural rule

  → many languages have MORE than two plural forms — Russian
    has effectively four (based on the last digit and whether
    it's 11-14), Arabic has six, Japanese has effectively NONE
    (no grammatical plural marking on nouns at all). a
    hardcoded ternary simply cannot express these.
```

```text
  → an i18n library (react-intl, i18next with its plural
    rules) delegates pluralization to CLDR (Unicode's Common
    Locale Data Repository) rules per language — the
    application code asks "give me the plural form for count=3
    in this locale" and the library picks the grammatically
    correct form, rather than the application re-implementing
    each language's specific rule.
```

## Dates and numbers are not universal formats

```text
  03/04/2026     — March 4th (US) or April 3rd (most of the
                    rest of the world) — the SAME string, two
                    different, both entirely reasonable
                    readings

  1,234.56       — US/UK
  1.234,56        — much of continental Europe
  1 234,56        — France
```

```text
  → NEVER hand-format a date or number for display — use the
    platform's Intl API (Intl.DateTimeFormat, Intl.NumberFormat)
    or a library built on it, which formats according to the
    VIEWER's actual locale rather than a hardcoded assumption
    about which format is "normal."
```

## Text expansion: the layout problem

```text
  English:  "Save"          (4 chars)
  German:   "Speichern"      (9 chars — more than double)

  → a button sized exactly to fit English text BREAKS the
    moment the same button's label is translated to German,
    Finnish, or many other languages that routinely run 30-50%
    longer for the same meaning — this is the HTML and CSS
    chapter's "design for realistic content" principle,
    specifically triggered by translation rather than by
    varying user data.
```

```text
  → design buttons, labels, and nav items with FLEXIBLE width
    (min-width rather than a fixed width, allowing WRAP where
    appropriate) from the start — retrofitting flexible layout
    onto a UI built assuming English's specific text lengths is
    far more work than designing for variable length upfront.
```

## RTL (right-to-left) layout

```text
  Arabic, Hebrew, and several other scripts read RIGHT TO LEFT
  — a UI supporting them needs more than translated text; the
  LAYOUT ITSELF mirrors:

    LTR:  [icon] [label]  →  aligned left, icon before label
    RTL:  [label] [icon]  ←  aligned right, icon AFTER label
          (reading direction reversed, not just text)
```

```text
  → use LOGICAL CSS properties (margin-inline-start rather than
    margin-left, padding-inline-end rather than padding-right)
    — these automatically FLIP direction based on the
    document's text direction (dir="rtl"), where a
    physical-direction property (margin-left) stays pinned to
    the left regardless of reading direction and has to be
    manually overridden per-direction otherwise.
```

## Locale-aware sorting and comparison

```text
  ['é', 'e', 'f'].sort()          // ✗ sorts by raw UNICODE
                                     CODE POINT — 'é' may sort
                                     in a position that looks
                                     wrong to a French reader,
                                     who expects it to sort near
                                     'e'

  ['é', 'e', 'f'].sort((a, b) =>
    a.localeCompare(b, 'fr'))     // ✓ sorts according to
                                     FRENCH collation rules
```

```text
  → a plain string comparison sorts by numeric code point,
    which does not match how a human reader of a given language
    actually expects accented characters, case, or
    language-specific ordering rules (some languages sort
    differently than their alphabet's "obvious" order suggests)
    to be ordered — localeCompare with the correct locale
    argument is the fix, not a manual accent-stripping hack.
```

## What to take away

1. Pluralization rules vary far beyond English's two forms — delegate to a
   library backed by CLDR's per-language rules rather than hardcoding a
   ternary that only handles English correctly.
2. Never hand-format a date or number — the same numeric string means
   different things in different locales, and the platform's Intl API
   formats according to the actual viewer's locale.
3. Translated text routinely runs 30-50% longer than English for the same
   meaning — design buttons and labels with flexible width from the start
   rather than retrofitting it later.
4. RTL support needs logical CSS properties (margin-inline-start, not
   margin-left) that flip automatically with reading direction, not manual
   per-direction overrides of physical properties.
5. A plain string sort orders by numeric code point, which doesn't match how
   a human reader of a given language expects accented characters or
   language-specific ordering — `localeCompare` with the right locale is the
   fix.
