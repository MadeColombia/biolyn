// Shared bits for the "Add to Apple Wallet" and "Add to Google Wallet"
// buttons on the share card. Each wallet stays off (buttons hidden, routes
// 404) until its keys are set in the environment. See
// docs/wallet-passes.md for how to get them.
import { cardPalette, displayUrl, type CardStyle } from "@/lib/qr-card";

/** What a wallet pass shows: the same things as the share card. */
export type PassContent = {
  username: string;
  name: string;
  /** Where the QR code points (the page, or a tracking link). */
  qrUrl: string;
  /** The page address shown under the name. */
  pageUrl: string;
  avatarUrl: string | null;
  style: CardStyle;
  theme: unknown;
  /** Tracking link code, if the pass is for one. */
  code: string | null;
};

/**
 * Reads a key or certificate stored in an environment variable. Accepts
 * the text as is (PEM, JSON) or base64 of it, which is easier to paste
 * into Vercel. Returns the raw bytes as a binary string.
 */
export function envBytes(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // JSON keeps its own "\n" escapes, so it is used as is.
  if (raw.startsWith("{")) return raw;
  if (raw.startsWith("-----BEGIN")) {
    // Vercel keeps real line breaks; some tools paste them as "\n".
    return raw.replace(/\\r\\n|\\n/g, "\n");
  }
  return Buffer.from(raw, "base64").toString("binary");
}

/** Wallets want one solid color; Sunset's gradient uses its middle. */
export function solidColor(background: string): string {
  const hexes = background.match(/#[0-9a-f]{6}/gi);
  if (!hexes) return "#ffffff";
  return hexes[Math.floor((hexes.length - 1) / 2)];
}

/** "#b9532d" as "rgb(185, 83, 45)", the way Apple Wallet wants it. */
export function rgb(color: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    const [r, g, b] = (m?.[1] ?? "0,0,0").split(",").map((n) => n.trim());
    return `rgb(${r}, ${g}, ${b})`;
  }
  const n = parseInt(hex, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Colors and text both wallets use, from the card's style. */
export function passLook(content: PassContent) {
  const p = cardPalette(content.style, content.theme);
  return {
    background: solidColor(p.background),
    text: p.text,
    muted: p.muted,
    accent: p.accent,
    address: displayUrl(content.pageUrl),
  };
}

/**
 * One id per pass look, so saving a changed card adds a new pass instead
 * of reusing the old one. Only letters, numbers, "_" and "-".
 */
export function passId(content: PassContent, version: string): string {
  return [content.username, content.code ?? "page", content.style, version]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
}
