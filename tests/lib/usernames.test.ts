import { describe, expect, it } from "vitest";
import { RESERVED_USERNAMES, validateUsername } from "@/lib/usernames";

describe("validateUsername", () => {
  it.each(["ethan", "made_colombia", "a.b.c", "abc", "x".repeat(30)])(
    "accepts %s",
    (name) => {
      expect(validateUsername(name)).toBeNull();
    },
  );

  it("trims and lowercases before checking", () => {
    expect(validateUsername("  Ethan  ")).toBeNull();
  });

  it.each([
    ["too short", "ab"],
    ["too long", "x".repeat(31)],
    ["spaces", "my name"],
    ["slash (path injection)", "../admin"],
    ["dash", "made-colombia"],
    ["emoji", "ethan🙂"],
    ["empty", ""],
  ])("rejects %s", (_label, name) => {
    expect(validateUsername(name)).toMatch(/3 to 30 characters/);
  });

  it("rejects every reserved name, in any case", () => {
    for (const name of RESERVED_USERNAMES) {
      if (!/^[a-z0-9_.]{3,30}$/.test(name)) continue;
      expect(validateUsername(name.toUpperCase())).toBe(
        "That username is reserved.",
      );
    }
  });

  it("reserves the app's own routes", () => {
    for (const route of ["dashboard", "login", "api", "auth"]) {
      expect(RESERVED_USERNAMES.has(route)).toBe(true);
    }
  });
});
