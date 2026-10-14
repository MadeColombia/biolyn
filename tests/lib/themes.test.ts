import { describe, expect, it } from "vitest";
import {
  isPhotoStyle,
  isThemeId,
  photoStyleFrom,
  themeFrom,
  themeSettings,
  THEMES,
} from "@/lib/themes";

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

describe("photo styles", () => {
  it("accepts round and cover", () => {
    expect(isPhotoStyle("round")).toBe(true);
    expect(isPhotoStyle("cover")).toBe(true);
  });

  it.each([undefined, null, 2, "", "square", "toString"])(
    "rejects %s",
    (value) => {
      expect(isPhotoStyle(value)).toBe(false);
    },
  );

  it("reads the stored style", () => {
    expect(photoStyleFrom({ preset: "sunset", photo: "cover" })).toBe("cover");
  });

  it.each([null, undefined, {}, { preset: "midnight" }, { photo: "big" }])(
    "falls back to round for %j",
    (value) => {
      expect(photoStyleFrom(value)).toBe("round");
    },
  );
});

describe("themeSettings", () => {
  it("copies the stored object", () => {
    const stored = { preset: "midnight", photo: "cover" };
    const copy = themeSettings(stored);
    expect(copy).toEqual(stored);
    expect(copy).not.toBe(stored);
  });

  it.each([null, undefined, "midnight", 3, ["midnight"]])(
    "starts empty for %j",
    (value) => {
      expect(themeSettings(value)).toEqual({});
    },
  );
});
