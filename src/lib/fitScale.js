// Below this width a screen scrolls sideways instead of shrinking the content.
export const MIN_FIT_VIEWPORT_WIDTH = 1200;

// How much to shrink content so all of it shows in the space available, never
// above 1 (no enlarging). Narrow screens and unmeasurable sizes keep 1, so the
// content scrolls instead.
export function fitScale({ contentWidth, contentHeight, availableWidth, availableHeight, viewportWidth }) {
  if (viewportWidth < MIN_FIT_VIEWPORT_WIDTH) return 1;
  if (![contentWidth, contentHeight, availableWidth, availableHeight].every((size) => size > 0)) return 1;
  const scale = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
  // Round down a little, so a rounding error never adds a scrollbar.
  return Math.floor(scale * 1000) / 1000;
}
