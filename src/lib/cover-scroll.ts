// How the cover photo looks as the visitor scrolls past it: it fades
// into the page and drifts up a little slower than the page, so the
// name and links slide over it.

// Share of the photo's height scrolled before it is fully gone.
export const COVER_FADE_DISTANCE = 0.8;
// How much the photo lags behind the page (0 = moves with the page).
export const COVER_DRIFT = 0.4;

export type CoverScroll = { opacity: number; shift: number };

// top: the photo's top edge relative to the screen (negative once
// scrolled past). height: the photo's height on screen.
export function coverScroll(
  top: number,
  height: number,
  reduceMotion = false,
): CoverScroll {
  if (height <= 0) return { opacity: 1, shift: 0 };
  const scrolled = Math.min(Math.max(-top, 0), height);
  const progress = Math.min(scrolled / (height * COVER_FADE_DISTANCE), 1);
  return {
    opacity: Math.round((1 - progress) * 1000) / 1000,
    // Pushing the photo down by part of the scroll makes it move up
    // slower than the page. Skipped when the visitor asks for less motion.
    shift: reduceMotion ? 0 : Math.round(scrolled * COVER_DRIFT),
  };
}
