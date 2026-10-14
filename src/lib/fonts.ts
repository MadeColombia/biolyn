// Fonts the owner can pick for their whole public page. The font files
// themselves load in src/components/profile-fonts.tsx.
export const FONTS = {
  clean: { label: "Clean" }, // IBM Plex Sans, the default
  elegant: { label: "Elegant" }, // Playfair Display
  rounded: { label: "Rounded" }, // Nunito
  typewriter: { label: "Typewriter" }, // Space Mono
  handwritten: { label: "Handwritten" }, // Caveat
} as const;

export type FontId = keyof typeof FONTS;

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && Object.hasOwn(FONTS, value);
}

// Stored next to the theme preset: profiles.theme = {"preset": ..., "font": ...}.
export function fontFrom(theme: unknown): FontId {
  const font = (theme as { font?: unknown } | null)?.font;
  return isFontId(font) ? font : "clean";
}
