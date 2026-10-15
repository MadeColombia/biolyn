import { describe, expect, it } from "vitest";
import {
  COVER_DRIFT,
  COVER_FADE_DISTANCE,
  coverScroll,
} from "@/lib/cover-scroll";

describe("coverScroll", () => {
  it("leaves the photo alone before the page scrolls", () => {
    expect(coverScroll(0, 500)).toEqual({ opacity: 1, shift: 0 });
    // Desktop card: the photo starts below the top of the screen.
    expect(coverScroll(40, 500)).toEqual({ opacity: 1, shift: 0 });
  });

  it("fades and drifts as the photo scrolls away", () => {
    const { opacity, shift } = coverScroll(-200, 500);
    expect(opacity).toBeCloseTo(1 - 200 / (500 * COVER_FADE_DISTANCE));
    expect(shift).toBe(Math.round(200 * COVER_DRIFT));
  });

  it("is fully gone before the photo leaves the screen", () => {
    expect(coverScroll(-500 * COVER_FADE_DISTANCE, 500).opacity).toBe(0);
    expect(coverScroll(-5000, 500)).toEqual({
      opacity: 0,
      shift: Math.round(500 * COVER_DRIFT),
    });
  });

  it("keeps the photo still for visitors who ask for less motion", () => {
    const { opacity, shift } = coverScroll(-200, 500, true);
    expect(opacity).toBeLessThan(1);
    expect(shift).toBe(0);
  });

  it("does nothing before the photo has a size", () => {
    expect(coverScroll(-100, 0)).toEqual({ opacity: 1, shift: 0 });
  });
});
