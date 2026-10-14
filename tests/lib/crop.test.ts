import { describe, expect, it } from "vitest";
import { clampOffset, coverScale, CROP_SIZES } from "@/lib/crop";

const SQUARE = { width: 100, height: 100 };

describe("coverScale", () => {
  it("fills the frame by the shorter side", () => {
    // A wide picture in a square frame is limited by its height.
    expect(coverScale({ width: 400, height: 200 }, SQUARE, 0)).toBe(0.5);
    expect(coverScale({ width: 200, height: 400 }, SQUARE, 0)).toBe(0.5);
  });

  it("swaps sides after a quarter turn", () => {
    const tall = CROP_SIZES.cover; // 1080 x 1350
    const wide = { width: 2000, height: 1000 };
    expect(coverScale(wide, tall, 0)).toBeCloseTo(1.35);
    expect(coverScale(wide, tall, 90)).toBeCloseTo(1.08);
  });

  it("zooms in when the picture is tilted", () => {
    // At 45 degrees a square frame needs sqrt(2) times more picture.
    expect(coverScale(SQUARE, SQUARE, 45)).toBeCloseTo(Math.SQRT2);
    expect(coverScale(SQUARE, SQUARE, -45)).toBeCloseTo(Math.SQRT2);
  });
});

describe("clampOffset", () => {
  const wide = { width: 200, height: 100 };

  it("keeps moves that stay inside the picture", () => {
    expect(clampOffset({ x: 30, y: 0 }, wide, SQUARE, 0, 1)).toEqual({
      x: 30,
      y: 0,
    });
  });

  it("stops at the picture's edge", () => {
    // 200px wide picture, 100px frame: 50px of room on each side.
    expect(clampOffset({ x: 80, y: 20 }, wide, SQUARE, 0, 1)).toEqual({
      x: 50,
      y: 0,
    });
    expect(clampOffset({ x: -80, y: -20 }, wide, SQUARE, 0, 1)).toEqual({
      x: -50,
      y: 0,
    });
  });

  it("gives more room when zoomed in", () => {
    expect(clampOffset({ x: 0, y: 80 }, wide, SQUARE, 0, 2)).toEqual({
      x: 0,
      y: 50,
    });
  });

  it("follows the picture's turned sides", () => {
    // Turned a quarter, the long side runs up and down.
    const turned = clampOffset({ x: 80, y: 80 }, wide, SQUARE, 90, 1);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(50);
  });

  it("allows no movement when the picture only just fits", () => {
    expect(clampOffset({ x: 10, y: -10 }, SQUARE, SQUARE, 0, 1)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
