// Class recipes for the design system. Each returns a Tailwind class string,
// so the same look works on <button>, <Link>, <a> or anything else.
// Class names are written out in full so Tailwind can find them when it
// scans the source. See docs/design-system.md.

/** Joins class names, skipping empty ones. */
export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export const BUTTON_VARIANTS = {
  // The one main action on a screen.
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  // Everything else: Log in, Cancel, Download.
  secondary: "bg-raised text-ink hover:bg-edge",
  // Quiet actions inside cards and lists.
  ghost: "text-ink-soft hover:bg-raised hover:text-ink",
  // Delete, remove: anything that can't be undone.
  danger:
    "border border-danger/40 text-danger hover:bg-danger hover:text-on-brand",
} as const;

export const BUTTON_SIZES = {
  sm: "min-h-11 rounded-xl px-4 text-sm",
  md: "min-h-12 rounded-xl px-5 text-base",
  lg: "min-h-14 rounded-2xl px-8 text-lg",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export function button({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
} = {}) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-bold transition disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth && "w-full",
  );
}

export const CARD_TONES = {
  // Default panel on the canvas.
  plain: "border border-edge bg-surface",
  // One highlighted card per screen at most.
  brand: "bg-brand text-on-brand",
  // Hover state for a card that is itself a link.
  interactive: "border border-edge bg-surface transition hover:border-brand",
} as const;

export type CardTone = keyof typeof CARD_TONES;

export function card({
  tone = "plain",
  padding = "lg",
}: { tone?: CardTone; padding?: "none" | "md" | "lg" } = {}) {
  return cx(
    "rounded-3xl",
    CARD_TONES[tone],
    padding === "lg" && "p-8",
    padding === "md" && "p-6",
  );
}

export const HEADING_SIZES = {
  // Hero headline, once per page.
  display: "text-5xl leading-[1.05] font-extrabold sm:text-7xl",
  // Page title or a big section title.
  title: "text-4xl font-extrabold",
  // Card and small section titles.
  section: "text-2xl font-bold",
  // Small labels in display font (step numbers, stats).
  label: "text-lg font-bold",
} as const;

export type HeadingSize = keyof typeof HEADING_SIZES;

export function heading(size: HeadingSize = "section") {
  return cx("font-display tracking-tight", HEADING_SIZES[size]);
}

export function input({ invalid = false }: { invalid?: boolean } = {}) {
  return cx(
    "min-h-12 w-full rounded-xl border bg-surface px-4 text-base text-ink placeholder:text-ink-muted transition focus:outline-none focus:ring-2",
    invalid
      ? "border-danger focus:ring-danger/30"
      : "border-edge focus:border-brand focus:ring-brand/30",
  );
}

export const BADGE_TONES = {
  brand: "bg-brand text-on-brand",
  neutral: "bg-raised text-ink-soft",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function badge(tone: BadgeTone = "brand") {
  return cx(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
    BADGE_TONES[tone],
  );
}

/** Centered page column. "wide" for marketing pages, "narrow" for forms. */
export function container(width: "wide" | "medium" | "narrow" = "wide") {
  return cx(
    "mx-auto w-full px-6",
    width === "wide" && "max-w-6xl",
    width === "medium" && "max-w-3xl",
    width === "narrow" && "max-w-md",
  );
}
