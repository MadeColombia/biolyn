import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { THEMES } from "@/lib/themes";
import {
  CARD_STYLES,
  cardChoices,
  cardDesign,
  cardPalette,
  cardStyleFrom,
  cardUrl,
  cardVersion,
  displayUrl,
  initial,
  nameFontSize,
  qrSvg,
  svgDataUrl,
} from "@/lib/qr-card";

describe("cardStyleFrom", () => {
  it("keeps known styles", () => {
    for (const id of Object.keys(CARD_STYLES)) {
      expect(cardStyleFrom(id)).toBe(id);
    }
  });

  it("falls back to the light biolyn style", () => {
    expect(cardStyleFrom(null)).toBe("brand");
    expect(cardStyleFrom("toString")).toBe("brand");
    expect(cardStyleFrom(3)).toBe("brand");
  });
});

describe("cardPalette", () => {
  it("uses biolyn colors for brand and night", () => {
    expect(cardPalette("brand", "midnight").background).toBe("#f5efe6");
    expect(cardPalette("night", "sunset").background).toBe("#15110f");
  });

  it("follows the page theme for page", () => {
    expect(cardPalette("page", "midnight").background).toBe("#020617");
    expect(cardPalette("page", "sunset").background).toContain("gradient");
    expect(cardPalette("page", "nope").background).toBe("#ffffff");
  });

  it("gives every page theme its own card, new themes included", () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      expect(cardPalette("page", id)).toBe(theme.shareCard);
    }
  });

  it("keeps the QR on a light tile with dark dots, so it scans", () => {
    for (const style of ["brand", "night", "page"] as const) {
      for (const theme of Object.keys(THEMES)) {
        const p = cardPalette(style, theme);
        expect(luminance(p.tile)).toBeGreaterThan(0.8);
        expect(luminance(p.dots)).toBeLessThan(0.2);
        expect(p.dots).not.toBe(p.tile);
        expect(p.corners).not.toBe(p.tile);
      }
    }
  });
});

// Relative brightness of a #rrggbb color, 0 (black) to 1 (white).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

describe("cardDesign", () => {
  it("changes with every deploy", () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_a");
    const a = cardDesign();
    expect(cardDesign()).toBe(a);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_b");
    expect(cardDesign()).not.toBe(a);
  });
});

describe("text helpers", () => {
  it("drops the protocol from the address", () => {
    expect(displayUrl("https://biolyn.link/ana")).toBe("biolyn.link/ana");
    expect(displayUrl("http://localhost:3000/ana/")).toBe("localhost:3000/ana");
  });

  it("shrinks long names", () => {
    expect(nameFontSize("Ana")).toBe(76);
    expect(nameFontSize("Ana María Restrepo")).toBe(60);
    expect(nameFontSize("Estudio de Cerámica Gijón")).toBe(48);
    expect(nameFontSize("Estudio de Cerámica Borondo Gijón")).toBe(40);
  });

  it("takes the first letter, uppercased", () => {
    expect(initial("  ana")).toBe("A");
    expect(initial("ñandú")).toBe("Ñ");
    expect(initial("")).toBe("?");
  });
});

describe("qrSvg", () => {
  const colors = { dots: "#111111", corners: "#b9532d", tile: "#ffffff" };

  it("draws every dark module outside the corners and the middle", () => {
    const text = "https://biolyn.link/ana";
    const svg = qrSvg(text, colors);
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "H" });
    const n = modules.size;
    expect(svg).toContain(`viewBox="0 0 ${n} ${n}"`);

    const dots = svg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="0.5"\/>/g);
    const dark = [...modules.data].filter((v) => v === 1).length;
    // Fewer dots than dark modules (corners and middle are drawn
    // separately), but most of the code is still there.
    expect(dots!.length).toBeLessThan(dark);
    expect(dots!.length).toBeGreaterThan(dark * 0.6);
  });

  it("colors the corner squares and the ring", () => {
    const svg = qrSvg("https://biolyn.link/ana", colors);
    expect(svg.match(/stroke="#b9532d"/g)).toHaveLength(4);
    expect(svg).toContain('<g fill="#111111">');
  });

  it("works for longer tracking links too", () => {
    const svg = qrSvg("https://biolyn.link/a-very-long-name?s=tiktok", colors);
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("wraps an SVG as a data URL", () => {
    const url = svgDataUrl("<svg/>");
    expect(url).toBe(
      `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
    );
  });
});

describe("cardUrl and cardChoices", () => {
  it("builds the card address", () => {
    expect(cardUrl("ana", { style: "night" })).toBe(
      "/api/qr-card/ana?style=night",
    );
    expect(
      cardUrl("ana", { style: "page", code: "flyer", v: "x1", download: true }),
    ).toBe("/api/qr-card/ana?style=page&s=flyer&v=x1&download=1");
  });

  it("lists every style with preview and download", () => {
    const choices = cardChoices("ana", { code: "flyer", v: "x1" });
    expect(choices.map((c) => c.id)).toEqual(["brand", "night", "page"]);
    expect(choices[0]).toEqual({
      id: "brand",
      label: "Light",
      src: "/api/qr-card/ana?style=brand&s=flyer&v=x1",
      download: "/api/qr-card/ana?style=brand&s=flyer&v=x1&download=1",
    });
    expect(cardChoices("ana")[1].src).toBe("/api/qr-card/ana?style=night");
  });

  it("adds wallet links only for wallets that are set up", () => {
    const [light] = cardChoices("ana", {
      code: "flyer",
      v: "x1",
      wallets: { apple: true, google: false },
    });
    expect(light.apple).toBe("/api/wallet/apple/ana?style=brand&s=flyer&v=x1");
    expect(light).not.toHaveProperty("google");
    expect(cardChoices("ana")[0]).not.toHaveProperty("apple");
  });

  it("changes the version when the card content changes", () => {
    const a = cardVersion(["pic.jpg", "Ana", "sunset"]);
    expect(a).toBe(cardVersion(["pic.jpg", "Ana", "sunset"]));
    expect(a).not.toBe(cardVersion(["pic.jpg", "Ana", "midnight"]));
    expect(a).toMatch(/^[0-9a-z]+$/);
  });
});
