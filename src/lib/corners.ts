// How rounded the blocks on the public page are: link buttons, big link
// cards, players and photo galleries. Round is the default.
export const CORNERS = {
  square: { label: "Square" },
  soft: { label: "Soft" },
  round: { label: "Round" },
  pill: { label: "Pill" },
} as const;

export type CornerStyle = keyof typeof CORNERS;

export function isCornerStyle(value: unknown): value is CornerStyle {
  return typeof value === "string" && Object.hasOwn(CORNERS, value);
}

// Stored next to the other look settings: profiles.theme = {"corners": ...}.
export function cornerStyleFrom(theme: unknown): CornerStyle {
  const corners = (theme as { corners?: unknown } | null)?.corners;
  return isCornerStyle(corners) ? corners : "round";
}

// Class names are written out in full so Tailwind can find them.
// block: the outside of a block. inner: a picture inside a big link card,
// a little tighter so it sits evenly inside the card's padding.
export const CORNER_CLASSES: Record<
  CornerStyle,
  { block: string; inner: string }
> = {
  square: { block: "rounded-none", inner: "rounded-none" },
  soft: { block: "rounded-lg", inner: "rounded-md" },
  round: { block: "rounded-2xl", inner: "rounded-2xl" },
  pill: { block: "rounded-[2rem]", inner: "rounded-[1.5rem]" },
};
