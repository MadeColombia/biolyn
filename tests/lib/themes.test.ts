import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isPhotoStyle,
  MOTION_SHAPES,
  MOTIONS,
  motionOf,
  type ThemeId,
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

describe("theme list", () => {
  it("has at least 10 themes, 4 of them moving", () => {
    const ids = Object.keys(THEMES) as ThemeId[];
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids.filter((id) => motionOf(id)).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the first three themes for older pages", () => {
    expect(Object.keys(THEMES).slice(0, 3)).toEqual([
      "classic",
      "midnight",
      "sunset",
    ]);
  });

  it.each(["en", "es"])("names every theme in %s", (locale) => {
    const messages = JSON.parse(
      readFileSync(`src/messages/${locale}.json`, "utf8"),
    );
    expect(Object.keys(messages.looks.themes).sort()).toEqual(
      Object.keys(THEMES).sort(),
    );
  });
});

describe("moving themes", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  it("returns null for still themes", () => {
    expect(motionOf("classic")).toBeNull();
    expect(motionOf("aurora")).toBe("aurora");
    expect(motionOf("gold")).toBe("shimmer");
  });

  it("uses every kind of movement", () => {
    const used = new Set(
      (Object.keys(THEMES) as ThemeId[]).map(motionOf).filter(Boolean),
    );
    expect([...used].sort()).toEqual([...MOTIONS].sort());
  });

  it.each(MOTIONS)("draws %s with shapes styled in globals.css", (motion) => {
    expect(MOTION_SHAPES[motion].length).toBeGreaterThan(0);
    for (const shape of MOTION_SHAPES[motion]) {
      expect(css).toContain(`.${shape}`);
    }
  });

  it("stops every movement for reduced motion", () => {
    const reduced = css.slice(css.lastIndexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".tm-layer *");
    expect(reduced).toContain("animation: none");
  });
});
