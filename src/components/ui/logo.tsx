import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { homePath } from "@/i18n/locale";
import { cx } from "./recipes";

/**
 * The Biolyn mark: a bold ring (the one link in your bio) on a terracotta
 * tile. Colors come from tokens, so it switches to the dark palette by
 * itself. Same drawing as public/brand/biolyn-mark.svg and src/app/icon.svg.
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
      <circle
        cx="32"
        cy="32"
        r="15"
        fill="none"
        strokeWidth="9"
        className="stroke-on-brand"
      />
    </svg>
  );
}

// The o of Unbounded ExtraBold, measured at 160px: 119 wide, 97 tall,
// sides 37 thick, top and bottom 26 thick, round counter. Drawing the ring
// with the same numbers makes it sit in the word like a real letter.
const RING_O =
  "M0 48.5a59.5 48.5 0 1 0 119 0a59.5 48.5 0 1 0-119 0Z" +
  "M37 48.5a22.5 22.5 0 1 0 45 0a22.5 22.5 0 1 0-45 0Z";

// Same box and spacing the real o takes up, dipping just below the
// baseline like the font's round letters do.
const ringBox =
  "ml-[0.028em] inline-block h-[0.606em] w-[0.744em] align-[-0.019em]";

/** The ring that replaces the o in the wordmark. Sized to the text. */
function RingO() {
  return (
    <svg viewBox="0 0 119 97" aria-hidden className={ringBox}>
      <path d={RING_O} fillRule="evenodd" className="fill-brand" />
    </svg>
  );
}

/**
 * The ring o dashing in: it slides in from the left with two sideways
 * blurred copies trailing it, which fade out as it lands. The keyframes
 * live in globals.css (biolyn-dash-*) and turn off for people who ask
 * their system for reduced motion.
 */
function DashingRingO() {
  return (
    <span className={cx("relative", ringBox)}>
      <svg
        viewBox="-119 0 238 97"
        aria-hidden
        className="biolyn-dash-in absolute top-0 right-0 -z-10 h-full w-[200%] overflow-visible"
      >
        <defs>
          <filter id="biolyn-o-near" x="-50%" y="-20%" width="200%" height="140%">
            <feGaussianBlur stdDeviation="10 0" />
          </filter>
          <filter id="biolyn-o-far" x="-50%" y="-20%" width="200%" height="140%">
            <feGaussianBlur stdDeviation="16 0" />
          </filter>
        </defs>
        <g fillRule="evenodd" className="fill-brand">
          <g className="biolyn-dash-trail">
            <path d={RING_O} transform="translate(-74 0)" opacity="0.22" filter="url(#biolyn-o-far)" />
            <path d={RING_O} transform="translate(-37 0)" opacity="0.45" filter="url(#biolyn-o-near)" />
          </g>
          <path d={RING_O} />
        </g>
      </svg>
    </span>
  );
}

/** The biolyn.link wordmark, with the ring as its o, linking home. */
export function Logo({
  showMark = false,
  animated = false,
  className,
}: {
  /** Also show the tile mark before the wordmark. */
  showMark?: boolean;
  /** Play the dash-in animation on the o once, when the page loads. */
  animated?: boolean;
  className?: string;
}) {
  const t = useTranslations("shell");
  const locale = useLocale();
  return (
    <Link
      href={homePath(locale)}
      aria-label={t("homeLabel")}
      className={cx(
        "isolate inline-flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight",
        className,
      )}
    >
      {showMark && <LogoMark size={32} />}
      <span>
        bi
        {animated ? <DashingRingO /> : <RingO />}
        lyn<span className="text-brand">.</span>link
      </span>
    </Link>
  );
}

/**
 * The ring in motion ("Dash"): two blurred copies trail to the left.
 * For large sizes only (64px tall or more); below that the blur turns
 * into a smudge, so use LogoMark or Logo instead. Same drawing as
 * public/brand/biolyn-motion.svg.
 */
export function LogoMotion({
  height = 96,
  title,
  className,
}: {
  height?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 64"
      height={height}
      width={(height * 96) / 64}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cx("shrink-0 overflow-visible", className)}
    >
      {title && <title>{title}</title>}
      <defs>
        {/* Blur only sideways ("5 0"), which reads as horizontal speed. */}
        <filter id="biolyn-dash-near" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="5 0" />
        </filter>
        <filter id="biolyn-dash-far" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="8 0" />
        </filter>
      </defs>
      <g fill="none" strokeWidth="12" className="stroke-brand">
        <circle cx="42" cy="32" r="20" opacity="0.22" filter="url(#biolyn-dash-far)" />
        <circle cx="52" cy="32" r="20" opacity="0.45" filter="url(#biolyn-dash-near)" />
        <circle cx="62" cy="32" r="20" />
      </g>
    </svg>
  );
}
