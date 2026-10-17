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

/**
 * Themes that move have a background layer drawn by ThemeMotion
 * (src/components/theme-motion.tsx). The movement is plain CSS in
 * globals.css and stops for visitors who turn on reduced motion; the
 * layer then stays still and the page still looks finished.
 */
export const MOTIONS = ["aurora", "bubbles", "shimmer", "grid"] as const;

export type MotionId = (typeof MOTIONS)[number];

// The soft shapes each moving background draws, as class names from
// globals.css ("Public page themes that move").
export const MOTION_SHAPES: Record<MotionId, readonly string[]> = {
  aurora: ["tm-aurora-1", "tm-aurora-2", "tm-aurora-3"],
  bubbles: [
    "tm-bubble-1",
    "tm-bubble-2",
    "tm-bubble-3",
    "tm-bubble-4",
    "tm-bubble-5",
  ],
  shimmer: ["tm-gold-glow", "tm-shimmer"],
  grid: ["tm-sun", "tm-floor"],
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
  motion?: MotionId;
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
  aurora: {
    label: "Aurora",
    page: "bg-indigo-950 text-white",
    muted: "text-indigo-200",
    button:
      "border border-white/20 bg-indigo-950/60 text-white hover:bg-indigo-900/80",
    card: "border border-white/20 bg-indigo-950/60 text-white hover:bg-indigo-900/80",
    avatar: "bg-white/10 text-indigo-100",
    embed: "bg-indigo-900",
    backdrop: "md:bg-black/30",
    motion: "aurora",
    shareCard: {
      background: "linear-gradient(160deg, #1e1b4b, #134e4a 55%, #312e81)",
      text: "#ffffff",
      muted: "#c7d2fe",
      accent: "#5eead4",
      tile: "#ffffff",
      tileBorder: "rgba(255,255,255,0.3)",
      dots: "#1e1b4b",
      corners: "#0f766e",
    },
  },
  bubbles: {
    label: "Bubbles",
    page: "bg-rose-50 text-rose-950",
    muted: "text-rose-900",
    button: "bg-white text-rose-950 shadow-sm shadow-rose-200 hover:bg-rose-100",
    card: "bg-white text-rose-950 shadow-sm shadow-rose-200 hover:bg-rose-100",
    avatar: "bg-rose-200 text-rose-800",
    embed: "bg-white",
    backdrop: "md:bg-rose-900/10",
    motion: "bubbles",
    shareCard: {
      background: "linear-gradient(180deg, #fff1f2, #fce7f3 50%, #ede9fe)",
      text: "#4c0519",
      muted: "#9f1239",
      accent: "#e11d48",
      tile: "#ffffff",
      tileBorder: "#fecdd3",
      dots: "#4c0519",
      corners: "#e11d48",
    },
  },
  gold: {
    label: "Gold",
    page: "bg-stone-950 text-amber-50",
    muted: "text-amber-100/70",
    button:
      "border border-amber-400/60 bg-stone-900/80 text-amber-100 hover:bg-stone-800",
    card: "border border-amber-400/60 bg-stone-900/80 text-amber-100 hover:bg-stone-800",
    avatar: "bg-amber-400/15 text-amber-200",
    embed: "bg-stone-900",
    backdrop: "md:bg-white/10",
    motion: "shimmer",
    shareCard: {
      background: "linear-gradient(160deg, #1c1917, #0c0a09 60%, #292524)",
      text: "#fffbeb",
      muted: "#d6c7a1",
      accent: "#fbbf24",
      tile: "#fffbeb",
      tileBorder: "#a16207",
      dots: "#1c1917",
      corners: "#b45309",
    },
  },
  retro: {
    label: "Retro",
    page: "bg-purple-950 text-pink-50",
    muted: "text-fuchsia-200",
    button:
      "border-2 border-pink-400 bg-purple-950/85 text-pink-50 shadow-[0_0_16px_rgb(244_114_182/0.45)] hover:bg-fuchsia-900",
    card: "border-2 border-pink-400 bg-purple-950/85 text-pink-50 shadow-[0_0_16px_rgb(244_114_182/0.45)] hover:bg-fuchsia-900",
    avatar: "bg-pink-400/20 text-pink-100",
    embed: "bg-purple-900",
    backdrop: "md:bg-black/40",
    motion: "grid",
    shareCard: {
      background: "linear-gradient(180deg, #3b0764, #581c87 55%, #be185d)",
      text: "#fdf2f8",
      muted: "#f5d0fe",
      accent: "#22d3ee",
      tile: "#ffffff",
      tileBorder: "#f472b6",
      dots: "#3b0764",
      corners: "#db2777",
    },
  },
  forest: {
    label: "Forest",
    page: "bg-linear-to-b from-emerald-900 to-emerald-950 text-emerald-50",
    muted: "text-emerald-200",
    button: "bg-emerald-100 text-emerald-950 hover:bg-white",
    card: "bg-emerald-100 text-emerald-950 hover:bg-white",
    avatar: "bg-emerald-800 text-emerald-100",
    embed: "bg-emerald-900",
    backdrop: "md:bg-black/25",
    shareCard: {
      background: "linear-gradient(180deg, #064e3b, #022c22)",
      text: "#ecfdf5",
      muted: "#a7f3d0",
      accent: "#6ee7b7",
      tile: "#ecfdf5",
      tileBorder: "#047857",
      dots: "#022c22",
      corners: "#047857",
    },
  },
  poster: {
    label: "Poster",
    page: "bg-amber-50 text-neutral-950",
    muted: "text-neutral-700",
    // A hard drawn shadow that the button presses into on hover.
    button:
      "border-2 border-neutral-950 bg-white text-neutral-950 shadow-[4px_4px_0_0_#0a0a0a] hover:bg-yellow-200 motion-safe:hover:translate-x-0.5 motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-[2px_2px_0_0_#0a0a0a]",
    card: "border-2 border-neutral-950 bg-white text-neutral-950 shadow-[4px_4px_0_0_#0a0a0a] hover:bg-yellow-200 motion-safe:hover:translate-x-0.5 motion-safe:hover:translate-y-0.5 motion-safe:hover:shadow-[2px_2px_0_0_#0a0a0a]",
    avatar: "border-2 border-neutral-950 bg-yellow-300 text-neutral-950",
    embed: "bg-neutral-950",
    backdrop: "md:bg-neutral-950/10",
    shareCard: {
      background: "#fffbeb",
      text: "#0a0a0a",
      muted: "#404040",
      accent: "#0a0a0a",
      tile: "#ffffff",
      tileBorder: "#0a0a0a",
      dots: "#0a0a0a",
      corners: "#0a0a0a",
    },
  },
  lemon: {
    label: "Lemon",
    page: "bg-yellow-300 text-neutral-950",
    muted: "text-neutral-800",
    button: "bg-neutral-950 text-yellow-300 hover:bg-neutral-800",
    card: "bg-neutral-950 text-yellow-300 hover:bg-neutral-800",
    avatar: "bg-neutral-950 text-yellow-300",
    embed: "bg-neutral-950",
    backdrop: "md:bg-black/15",
    shareCard: {
      background: "#fde047",
      text: "#0a0a0a",
      muted: "#262626",
      accent: "#0a0a0a",
      tile: "#ffffff",
      tileBorder: "#0a0a0a",
      dots: "#0a0a0a",
      corners: "#0a0a0a",
    },
  },
} as const satisfies Record<string, ThemeLook>;

export type ThemeId = keyof typeof THEMES;

/** The theme's moving background, or null for a still theme. */
export function motionOf(id: ThemeId): MotionId | null {
  const look: ThemeLook = THEMES[id];
  return look.motion ?? null;
}

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
