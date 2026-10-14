import { cx } from "./recipes";

/**
 * Placeholder block shown while a screen loads. Give it a size and shape
 * with classes (h-10 w-56 rounded-xl ...). It pulses unless the visitor
 * asked for reduced motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("bg-raised motion-safe:animate-pulse", className)}
    />
  );
}
