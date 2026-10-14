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
  },
  midnight: {
    label: "Midnight",
    page: "bg-slate-950 text-white",
    muted: "text-slate-400",
    button: "bg-slate-800 text-white hover:bg-slate-700",
    card: "bg-slate-800 text-white hover:bg-slate-700",
    avatar: "bg-slate-800 text-slate-300",
  },
  sunset: {
    label: "Sunset",
    page: "bg-linear-to-b from-orange-400 via-pink-500 to-purple-600 text-white",
    muted: "text-white/80",
    button: "rounded-full bg-white/90 text-neutral-900 hover:bg-white",
    // Big buttons are cards, so they keep square-ish corners here.
    card: "bg-white/90 text-neutral-900 hover:bg-white",
    avatar: "bg-white/30 text-white",
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
