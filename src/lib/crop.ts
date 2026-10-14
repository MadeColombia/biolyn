// Math for the picture cropper. The picture is drawn centered in the
// frame, then moved by `offset`, turned by `angle` degrees and scaled by
// `scale` (frame pixels per picture pixel). Every function keeps the frame
// fully covered, so the saved picture never has empty corners.

import type { PhotoStyle } from "@/lib/themes";

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

// What the cropper saves for each picture style. Cover is a tall 4:5
// photo, sharp on big phones; round stays small.
export const CROP_SIZES: Record<PhotoStyle, Size> = {
  round: { width: 512, height: 512 },
  cover: { width: 1080, height: 1350 },
};

export const MAX_ZOOM = 4;

const rad = (deg: number) => (deg * Math.PI) / 180;

// The frame's bounding box as seen from the turned picture.
function frameExtent(frame: Size, angle: number): Size {
  const c = Math.abs(Math.cos(rad(angle)));
  const s = Math.abs(Math.sin(rad(angle)));
  return {
    width: frame.width * c + frame.height * s,
    height: frame.width * s + frame.height * c,
  };
}

/** Smallest scale at which the turned picture still fills the frame. */
export function coverScale(image: Size, frame: Size, angle: number): number {
  const extent = frameExtent(frame, angle);
  return Math.max(extent.width / image.width, extent.height / image.height);
}

/**
 * Pulls `offset` back so the picture still covers the frame. Works in the
 * picture's own (turned) directions, then turns the result back.
 */
export function clampOffset(
  offset: Point,
  image: Size,
  frame: Size,
  angle: number,
  scale: number,
): Point {
  const a = rad(angle);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Offset in the picture's directions (turned by -angle).
  const u = offset.x * cos + offset.y * sin;
  const v = -offset.x * sin + offset.y * cos;
  const extent = frameExtent(frame, angle);
  const maxU = Math.max(0, (image.width * scale - extent.width) / 2);
  const maxV = Math.max(0, (image.height * scale - extent.height) / 2);
  const cu = Math.min(maxU, Math.max(-maxU, u));
  const cv = Math.min(maxV, Math.max(-maxV, v));
  // Turn back by +angle. Adding 0 turns -0 into 0.
  return { x: cu * cos - cv * sin + 0, y: cu * sin + cv * cos + 0 };
}
