import { describe, expect, it, vi } from "vitest";
import {
  prefersNativeShare,
  profileShareUrl,
  SHARE_APPS,
  shareLink,
} from "@/lib/share";

const url = "https://biolyn.link/lucia";
const title = "Lucia Rivera | biolyn";

describe("profileShareUrl", () => {
  it("is the page's own address on the current domain", () => {
    expect(profileShareUrl("https://biolyn.link", "lucia")).toBe(url);
    expect(profileShareUrl("https://biolyn.link/", "lucia")).toBe(url);
    expect(profileShareUrl("http://localhost:3000", "a_b")).toBe(
      "http://localhost:3000/a_b",
    );
  });

  it("keeps odd usernames inside the path", () => {
    expect(profileShareUrl("https://biolyn.link", "a/b?c")).toBe(
      "https://biolyn.link/a%2Fb%3Fc",
    );
  });
});

describe("shareLink", () => {
  it("fills in the page for every app", () => {
    expect(shareLink("whatsapp", url, title)).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    );
    expect(shareLink("x", url, title)).toBe(
      `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    );
    expect(shareLink("facebook", url, title)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    );
    expect(shareLink("email", url, title)).toBe(
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    );
  });

  it("escapes names with symbols", () => {
    const link = shareLink("x", url, "Tom & Jerry #1 | biolyn");
    expect(link).toContain("text=Tom%20%26%20Jerry%20%231");
    expect(new URL(link).searchParams.get("url")).toBe(url);
  });

  it("offers WhatsApp, X, Facebook and Email in that order", () => {
    expect(SHARE_APPS).toEqual(["whatsapp", "x", "facebook", "email"]);
  });
});

describe("prefersNativeShare", () => {
  const data = { title, url };
  const share = () => Promise.resolve();

  it("uses the phone's own menu on touch screens", () => {
    expect(prefersNativeShare({ share }, true, data)).toBe(true);
  });

  it("asks the browser whether it can share this", () => {
    const canShare = vi.fn(() => false);
    expect(prefersNativeShare({ share, canShare }, true, data)).toBe(false);
    expect(canShare).toHaveBeenCalledWith(data);
    expect(prefersNativeShare({ share, canShare: () => true }, true, data)).toBe(
      true,
    );
  });

  it("shows the popup on computers, even with a share menu", () => {
    expect(prefersNativeShare({ share }, false, data)).toBe(false);
  });

  it("shows the popup when the browser has no share menu", () => {
    expect(prefersNativeShare({}, true, data)).toBe(false);
  });
});
