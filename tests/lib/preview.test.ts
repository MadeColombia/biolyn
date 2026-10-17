import { describe, expect, it } from "vitest";
import { isPreview, previewSrc, previewVersion } from "@/lib/preview";

describe("previewVersion", () => {
  it("stays the same for the same page", () => {
    const page = { name: "Lucía", links: [{ id: "a", title: "Shop" }] };
    expect(previewVersion(page)).toBe(previewVersion(structuredClone(page)));
  });

  it("changes when anything on the page changes", () => {
    const a = previewVersion({ links: [{ id: "a", title: "Shop" }] });
    const b = previewVersion({ links: [{ id: "a", title: "Shop!" }] });
    const c = previewVersion({ links: [{ id: "a", title: "Shop" }], x: 1 });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("gives a short code, even for nothing", () => {
    expect(previewVersion(undefined)).toMatch(/^[0-9a-z]{1,7}$/);
    expect(previewVersion({ big: "x".repeat(10_000) })).toMatch(
      /^[0-9a-z]{1,7}$/,
    );
  });
});

describe("previewSrc", () => {
  it("points at the public page, marked as a preview", () => {
    expect(previewSrc("lucia", "abc")).toBe("/lucia?preview=abc");
    expect(
      isPreview(new URL(previewSrc("lucia", "1"), "https://x").search),
    ).toBe(true);
  });
});

describe("isPreview", () => {
  it("reads the address", () => {
    expect(isPreview("?preview=1")).toBe(true);
    expect(isPreview(new URLSearchParams("s=tiktok&preview="))).toBe(true);
    expect(isPreview("?s=tiktok")).toBe(false);
    expect(isPreview("")).toBe(false);
  });
});
