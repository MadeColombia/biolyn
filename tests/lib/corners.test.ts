import { describe, expect, it } from "vitest";
import {
  CORNERS,
  CORNER_CLASSES,
  cornerStyleFrom,
  isCornerStyle,
} from "@/lib/corners";

describe("corners", () => {
  it("offers four shapes, each with classes", () => {
    expect(Object.keys(CORNERS)).toEqual(["square", "soft", "round", "pill"]);
    for (const id of Object.keys(CORNERS)) {
      expect(isCornerStyle(id)).toBe(true);
      expect(CORNER_CLASSES[id as keyof typeof CORNERS].block).toMatch(
        /rounded/,
      );
      expect(CORNER_CLASSES[id as keyof typeof CORNERS].inner).toMatch(
        /rounded/,
      );
    }
  });

  it.each([undefined, null, 3, "", "sharp", "toString", "__proto__"])(
    "rejects %s",
    (value) => {
      expect(isCornerStyle(value)).toBe(false);
    },
  );

  it("reads the corners stored with the theme", () => {
    expect(cornerStyleFrom({ preset: "sunset", corners: "pill" })).toBe("pill");
  });

  it.each([
    null,
    undefined,
    {},
    { preset: "sunset" },
    { corners: "toString" },
    { corners: 1 },
  ])("falls back to round for %j", (value) => {
    expect(cornerStyleFrom(value)).toBe("round");
  });

  it("keeps the round look for existing pages", () => {
    expect(CORNER_CLASSES.round).toEqual({
      block: "rounded-2xl",
      inner: "rounded-2xl",
    });
  });
});
