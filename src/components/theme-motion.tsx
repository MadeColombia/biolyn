import { MOTION_SHAPES, type MotionId } from "@/lib/themes";

/**
 * The moving background of a theme, drawn behind the page content. Put
 * it first inside a box with `relative isolate`. On the public page it
 * sticks to the screen while the visitor scrolls, so only one screen's
 * worth of shapes is ever drawn; in the dashboard preview it fills its
 * small tile instead. Pure CSS, so it costs no JavaScript.
 */
export function ThemeMotion({
  motion,
  preview = false,
}: {
  motion: MotionId | null;
  preview?: boolean;
}) {
  if (!motion) return null;
  return (
    <div
      aria-hidden
      className={`tm-layer pointer-events-none -z-10 overflow-hidden ${
        preview
          ? "tm-preview absolute inset-0"
          : "sticky top-0 -mb-[100svh] h-svh w-full shrink-0"
      }`}
    >
      {MOTION_SHAPES[motion].map((shape) => (
        <span key={shape} className={`tm-shape ${shape}`}>
          {shape === "tm-floor" && <span className="tm-grid" />}
        </span>
      ))}
    </div>
  );
}
