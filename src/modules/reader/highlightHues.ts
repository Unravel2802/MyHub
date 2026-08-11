import type { HueName } from "@/src/components/moduleHues";

// The colours offered for a highlight.
//
// A deliberate subset of the ten-hue kit, not all of them: a highlighter with
// ten colours is a decision every time you use it, and the point of colour
// here is to let you separate two or three kinds of attention (e.g. "key
// claim" vs "follow up" vs "disagree"), not to match a palette.
//
// These four read clearly as translucent overlays on white paper in both
// themes. Amber first — it is the conventional highlighter colour and the
// default in ReaderRepository.createAnnotation.
export const HIGHLIGHT_HUES: readonly HueName[] = [
  "amber",
  "emerald",
  "blue",
  "rose",
];
