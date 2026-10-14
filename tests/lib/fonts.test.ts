import { describe, expect, it } from "vitest";
import { FONTS, fontFrom, isFontId } from "@/lib/fonts";

describe("fonts", () => {
  it("offers five fonts", () => {
    expect(Object.keys(FONTS)).toHaveLength(5);
    for (const id of Object.keys(FONTS)) expect(isFontId(id)).toBe(true);
  });

  it.each([undefined, null, 3, "", "comic", "toString", "__proto__"])(
    "rejects %s",
    (value) => {
      expect(isFontId(value)).toBe(false);
    },
  );

  it("reads the font stored with the theme", () => {
    expect(fontFrom({ preset: "sunset", font: "elegant" })).toBe("elegant");
  });

  it.each([null, undefined, {}, { preset: "sunset" }, { font: "toString" }, { font: 1 }])(
    "falls back to clean for %j",
    (value) => {
      expect(fontFrom(value)).toBe("clean");
    },
  );
});
