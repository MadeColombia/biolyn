import { describe, expect, it } from "vitest";
import { isThemeId, themeFrom, THEMES } from "@/lib/themes";

describe("isThemeId", () => {
  it("accepts every preset", () => {
    for (const id of Object.keys(THEMES)) expect(isThemeId(id)).toBe(true);
  });

  it.each([undefined, null, 1, "", "neon"])("rejects %s", (value) => {
    expect(isThemeId(value)).toBe(false);
  });

  // Every object has these keys through its prototype, so a plain `in`
  // check would accept them and break the public page.
  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])(
    "rejects inherited key %s",
    (value) => {
      expect(isThemeId(value)).toBe(false);
    },
  );
});

describe("themeFrom", () => {
  it("reads the stored preset", () => {
    expect(themeFrom({ preset: "midnight" })).toBe("midnight");
  });

  it.each([
    null,
    undefined,
    "midnight",
    {},
    { preset: "neon" },
    { preset: 3 },
    { preset: "toString" },
  ])(
    "falls back to classic for %j",
    (value) => {
      expect(themeFrom(value)).toBe("classic");
    },
  );
});
