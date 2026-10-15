/**
 * Colors for the downloadable share card (src/lib/qr-card.ts), drawn as
 * a picture, so plain CSS colors instead of class names. Every theme must
 * have one: TypeScript stops the build if a new theme leaves it out.
 */
export type CardColors = {
  /** CSS background of the whole card (a color or a gradient). */
  background: string;
  text: string;
  muted: string;
  /** Avatar ring and the page address. */
  accent: string;
  /** The tile behind the QR code. Keep it light so phones can scan it. */
  tile: string;
  tileBorder: string;
  /** The QR dots. Keep them dark. */
  dots: string;
  /** The three big QR corner squares and the ring in the middle. */
  corners: string;
};

type ThemeLook = {
  label: string;
  page: string;
  muted: string;
  button: string;
  card: string;
  avatar: string;
  embed: string;
  backdrop: string;
  shareCard: CardColors;
};

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
    // Behind embedded players, so their own rounded corners blend in.
    embed: "bg-white",
    // Tint around the cover-photo card on wide screens.
    backdrop: "md:bg-black/10",
    shareCard: {
      background: "#ffffff",
      text: "#171717",
      muted: "#737373",
      accent: "#171717",
      tile: "#ffffff",
      tileBorder: "#d4d4d4",
      dots: "#171717",
      corners: "#171717",
    },
  },
  midnight: {
    label: "Midnight",
    page: "bg-slate-950 text-white",
    muted: "text-slate-400",
    button: "bg-slate-800 text-white hover:bg-slate-700",
    card: "bg-slate-800 text-white hover:bg-slate-700",
    avatar: "bg-slate-800 text-slate-300",
    embed: "bg-slate-800",
    backdrop: "md:bg-white/10",
    shareCard: {
      background: "#020617",
      text: "#ffffff",
      muted: "#94a3b8",
      accent: "#ffffff",
      tile: "#ffffff",
      tileBorder: "#1e293b",
      dots: "#020617",
      corners: "#020617",
    },
  },
  sunset: {
    label: "Sunset",
    page: "bg-linear-to-b from-orange-400 via-pink-500 to-purple-600 text-white",
    muted: "text-white/80",
    button: "bg-white/90 text-neutral-900 hover:bg-white",
    card: "bg-white/90 text-neutral-900 hover:bg-white",
    avatar: "bg-white/30 text-white",
    embed: "bg-white/90",
    backdrop: "md:bg-black/25",
    shareCard: {
      background: "linear-gradient(180deg, #fb923c, #ec4899, #9333ea)",
      text: "#ffffff",
      muted: "rgba(255,255,255,0.85)",
      accent: "#ffffff",
      tile: "#ffffff",
      tileBorder: "rgba(255,255,255,0.6)",
      dots: "#171717",
      corners: "#db2777",
    },
  },
} as const satisfies Record<string, ThemeLook>;

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
