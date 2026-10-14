import Link from "next/link";
import { cx } from "./recipes";

/**
 * The Biolyn mark: a b whose bowl is a chain link, on a terracotta tile.
 * Colors come from tokens, so it switches to the dark palette by itself.
 * Same drawing as public/brand/biolyn-mark.svg and src/app/icon.svg.
 */
export function LogoMark({
  size = 32,
  title,
  className,
}: {
  size?: number;
  /** Accessible name. Leave empty when text next to it already says Biolyn. */
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cx("shrink-0", className)}
    >
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="16" className="fill-brand" />
      <rect x="12.5" y="10" width="9" height="40" rx="4.5" className="fill-on-brand" />
      <rect
        x="17"
        y="27"
        width="30"
        height="23"
        rx="11.5"
        fill="none"
        strokeWidth="9"
        className="stroke-on-brand"
      />
    </svg>
  );
}

/** The mark plus the biolyn.link wordmark, linking home. */
export function Logo({
  showMark = true,
  className,
}: {
  showMark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cx(
        "inline-flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight",
        className,
      )}
    >
      {showMark && <LogoMark size={32} />}
      <span>
        biolyn<span className="text-brand">.</span>link
      </span>
    </Link>
  );
}
