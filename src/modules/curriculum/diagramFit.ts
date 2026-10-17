// Preserve SVG text at >= 75% of its natural size. Below that threshold the
// viewport scrolls instead of shrinking the diagram further.
export function diagramFit(naturalWidth: number, frameWidth: number) {
  if (naturalWidth <= 0 || !Number.isFinite(naturalWidth)) {
    return { scale: 1, width: 0, overflows: false };
  }
  if (frameWidth <= 0 || !Number.isFinite(frameWidth)) {
    return { scale: 1, width: naturalWidth, overflows: false };
  }
  const scale = Math.min(1, Math.max(0.75, frameWidth / naturalWidth));
  const width = naturalWidth * scale;
  return { scale, width, overflows: width > frameWidth };
}
