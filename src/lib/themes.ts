// Preset looks for the public page. Class names are written out in full
// so Tailwind can find them when it scans the source.
export const THEMES = {
  classic: {
    label: "Classic",
    page: "bg-white text-neutral-900",
    muted: "text-neutral-500",
    button:
      "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
    card: "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
    avatar: "bg-neutral-200 text-neutral-600",
    // Tint around the cover-photo card on wide screens.
    backdrop: "md:bg-black/10",
  },
  midnight: {
    label: "Midnight",
    page: "bg-slate-950 text-white",
    muted: "text-slate-400",
    button: "bg-slate-800 text-white hover:bg-slate-700",
    card: "bg-slate-800 text-white hover:bg-slate-700",
    avatar: "bg-slate-800 text-slate-300",
    backdrop: "md:bg-white/10",
  },
  sunset: {
    label: "Sunset",
    page: "bg-linear-to-b from-orange-400 via-pink-500 to-purple-600 text-white",
    muted: "text-white/80",
    button: "rounded-full bg-white/90 text-neutral-900 hover:bg-white",
    // Big buttons are cards, so they keep square-ish corners here.
    card: "bg-white/90 text-neutral-900 hover:bg-white",
    avatar: "bg-white/30 text-white",
    backdrop: "md:bg-black/25",
  },
} as const;

export type ThemeId = keyof typeof THEMES;

export function isThemeId(value: unknown): value is ThemeId {
  // Object.hasOwn, not `in`: `"toString" in THEMES` is true too.
  return typeof value === "string" && Object.hasOwn(THEMES, value);
}

// profiles.theme is stored as {"preset": "<id>"}; anything else means classic.
export function themeFrom(theme: unknown): ThemeId {
  const preset = (theme as { preset?: unknown } | null)?.preset;
  return isThemeId(preset) ? preset : "classic";
}

// How the profile picture shows on the public page: a small round
// picture, or a big cover photo at the top that fades into the page.
export const PHOTO_STYLES = {
  round: { label: "Round" },
  cover: { label: "Cover" },
} as const;

export type PhotoStyle = keyof typeof PHOTO_STYLES;

export function isPhotoStyle(value: unknown): value is PhotoStyle {
  return typeof value === "string" && Object.hasOwn(PHOTO_STYLES, value);
}

// Stored next to the preset, as {"preset": ..., "photo": "cover"}.
// Anything else means round, so older pages keep their look.
export function photoStyleFrom(theme: unknown): PhotoStyle {
  const photo = (theme as { photo?: unknown } | null)?.photo;
  return isPhotoStyle(photo) ? photo : "round";
}

// The stored settings object, so one setting can change without
// dropping the others.
export function themeSettings(theme: unknown): Record<string, unknown> {
  return theme && typeof theme === "object" && !Array.isArray(theme)
    ? { ...(theme as Record<string, unknown>) }
    : {};
}

// The cover photo turns see-through toward the bottom, so it melts into
// any page background: plain colors and Sunset's gradient alike.
export const COVER_FADE =
  "linear-gradient(to bottom, black 45%, rgb(0 0 0 / 0.6) 70%, transparent 100%)";
