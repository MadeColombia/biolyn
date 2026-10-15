// The share card: a picture with the page's QR code, name and address,
// sized for phones (4:5, like an Instagram post). It is drawn on the
// server by src/app/api/qr-card/[username]/route.tsx.
import QRCode from "qrcode";
import { isThemeId, THEMES, type CardColors } from "@/lib/themes";

export const CARD_SIZE = { width: 1080, height: 1350 } as const;

// "brand" and "night" use the biolyn colors; "page" follows the owner's
// public page theme.
export const CARD_STYLES = {
  brand: { label: "Light" },
  night: { label: "Dark" },
  page: { label: "My page" },
} as const;

export type CardStyle = keyof typeof CARD_STYLES;

export function cardStyleFrom(value: unknown): CardStyle {
  return typeof value === "string" && Object.hasOwn(CARD_STYLES, value)
    ? (value as CardStyle)
    : "brand";
}

export type CardPalette = CardColors;

const BRAND: CardPalette = {
  background: "#f5efe6",
  text: "#2a1e18",
  muted: "#74604f",
  accent: "#b9532d",
  tile: "#fffbf5",
  tileBorder: "#e3d5c5",
  dots: "#2a1e18",
  corners: "#b9532d",
};

const NIGHT: CardPalette = {
  background: "#15110f",
  text: "#f6eee8",
  muted: "#a39185",
  accent: "#d2693f",
  tile: "#fffbf5",
  tileBorder: "#3a2e28",
  dots: "#2a1e18",
  corners: "#b9532d",
};

export function cardPalette(style: CardStyle, theme: unknown): CardPalette {
  if (style === "night") return NIGHT;
  // Each theme keeps its card colors next to its page colors, so a new
  // theme gets a matching card without touching this file.
  if (style === "page")
    return THEMES[isThemeId(theme) ? theme : "classic"].shareCard;
  return BRAND;
}

/** "https://biolyn.link/ana" shown as "biolyn.link/ana". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Name font size that keeps the name on one or two lines of the card.
 * Long names get smaller instead of running off the edge.
 */
export function nameFontSize(name: string): number {
  const n = [...name].length;
  if (n <= 12) return 76;
  if (n <= 18) return 60;
  if (n <= 26) return 48;
  return 40;
}

/** First letter for the round placeholder when there is no picture. */
export function initial(name: string): string {
  return ([...name.trim()][0] ?? "?").toUpperCase();
}

/**
 * The QR code as an SVG with round dots and rounded corner squares, plus
 * a ring in the middle. Uses the highest error correction (H), so phones
 * still read it with the middle covered.
 */
export function qrSvg(
  text: string,
  {
    dots,
    corners: accent,
    tile,
  }: Pick<CardPalette, "dots" | "corners" | "tile">,
): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = modules.size;
  const at = (x: number, y: number) => modules.data[y * n + x] === 1;

  // The three big corner squares (7x7) are drawn as shapes, not dots.
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  // A clear square in the middle for the ring, about a fifth of the code.
  let hole = Math.round(n * 0.22);
  if (hole % 2 !== n % 2) hole += 1;
  const h0 = (n - hole) / 2;
  const inHole = (x: number, y: number) =>
    x >= h0 && x < h0 + hole && y >= h0 && y < h0 + hole;

  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!at(x, y) || finder(x, y) || inHole(x, y)) continue;
      parts.push(`<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.5"/>`);
    }
  }

  const corner = (x: number, y: number) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="${accent}" stroke-width="1"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${accent}"/>`;

  const c = n / 2;
  const ring =
    `<circle cx="${c}" cy="${c}" r="${hole / 2}" fill="${tile}"/>` +
    `<circle cx="${c}" cy="${c}" r="${hole * 0.3}" fill="none" stroke="${accent}" stroke-width="${hole * 0.16}"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}">` +
    `<g fill="${dots}">${parts.join("")}</g>` +
    corner(0, 0) +
    corner(n - 7, 0) +
    corner(0, n - 7) +
    ring +
    `</svg>`
  );
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Where the card picture is served. `v` changes whenever something on
 * the card changes (picture, name, theme), so browsers and the CDN fetch
 * a fresh card instead of showing an old one.
 */
export function cardUrl(
  username: string,
  {
    style,
    code,
    v,
    download,
  }: { style: CardStyle; code?: string; v?: string; download?: boolean },
): string {
  const params = new URLSearchParams({ style });
  if (code) params.set("s", code);
  if (v) params.set("v", v);
  if (download) params.set("download", "1");
  return `/api/qr-card/${encodeURIComponent(username)}?${params}`;
}

/** A short fingerprint of what the card shows, for cardUrl's `v`. */
export function cardVersion(parts: unknown[]): string {
  const text = JSON.stringify(parts);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** Every style with its preview and download address, for the dashboard. */
export function cardChoices(
  username: string,
  {
    code,
    v,
    wallets = {},
  }: {
    code?: string;
    v?: string;
    /** Which wallets have their keys set up. */
    wallets?: { apple?: boolean; google?: boolean };
  } = {},
) {
  return (Object.keys(CARD_STYLES) as CardStyle[]).map((style) => {
    const query = cardUrl(username, { style, code, v }).split("?")[1];
    const pass = (wallet: string) =>
      `/api/wallet/${wallet}/${encodeURIComponent(username)}?${query}`;
    return {
      id: style,
      label: CARD_STYLES[style].label,
      src: cardUrl(username, { style, code, v }),
      download: cardUrl(username, { style, code, v, download: true }),
      ...(wallets.apple ? { apple: pass("apple") } : {}),
      ...(wallets.google ? { google: pass("google") } : {}),
    };
  });
}

/**
 * Changes whenever a card could look different after an update: any card
 * colors (a new or edited theme included) or a new deploy (layout
 * changes). Part of `v`, so nobody gets an old design from the cache.
 */
export function cardDesign(): string {
  return cardVersion([
    BRAND,
    NIGHT,
    Object.values(THEMES).map((t) => t.shareCard),
    CARD_SIZE,
    process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA,
  ]);
}
