import Link from "next/link";
import { cx } from "./recipes";

/** The biolyn.link wordmark, linking home. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cx(
        "font-display text-xl font-extrabold tracking-tight",
        className,
      )}
    >
      biolyn<span className="text-brand">.</span>link
    </Link>
  );
}
