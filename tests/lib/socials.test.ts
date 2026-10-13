import { describe, expect, it } from "vitest";
import {
  displaySocial,
  normalizeSocial,
  SOCIAL_PLATFORMS,
  socialsFrom,
} from "@/lib/socials";

describe("normalizeSocial", () => {
  it("treats empty input as remove", () => {
    expect(normalizeSocial("instagram", "   ")).toEqual({ url: null });
  });

  it.each(SOCIAL_PLATFORMS.filter((p) => p.id !== "email"))(
    "turns a handle into a $label link",
    ({ id, base }) => {
      expect(normalizeSocial(id, "@made_colombia")).toEqual({
        url: `${base}made_colombia`,
      });
    },
  );

  it("keeps a full https URL as typed", () => {
    expect(normalizeSocial("x", " https://x.com/someone ")).toEqual({
      url: "https://x.com/someone",
    });
  });

  it("rejects a broken URL", () => {
    expect(normalizeSocial("x", "https://")).toEqual({
      error: "X: that URL doesn't look right.",
    });
  });

  it.each(["javascript:alert(1)", "bad handle", "<script>", "a".repeat(51)])(
    "rejects unsafe or invalid handle %s",
    (value) => {
      expect(normalizeSocial("github", value)).toEqual({
        error: "GitHub: use a handle like @name or a full URL.",
      });
    },
  );

  it("accepts an email with or without mailto:", () => {
    expect(normalizeSocial("email", "me@biolyn.link")).toEqual({
      url: "mailto:me@biolyn.link",
    });
    expect(normalizeSocial("email", "MAILTO:me@biolyn.link")).toEqual({
      url: "mailto:me@biolyn.link",
    });
  });

  it("rejects a bad email", () => {
    expect(normalizeSocial("email", "not-an-email")).toEqual({
      error: "Email: that email doesn't look right.",
    });
  });
});

describe("socialsFrom", () => {
  it.each([null, undefined, "x", 5])("returns {} for %j", (value) => {
    expect(socialsFrom(value)).toEqual({});
  });

  it("keeps only known platforms with safe URLs", () => {
    expect(
      socialsFrom({
        instagram: "https://instagram.com/a",
        email: "mailto:a@b.co",
        x: "javascript:alert(1)",
        github: 42,
        myspace: "https://myspace.com/a",
      }),
    ).toEqual({
      instagram: "https://instagram.com/a",
      email: "mailto:a@b.co",
    });
  });
});

describe("displaySocial", () => {
  it("returns empty for no URL", () => {
    expect(displaySocial("x", undefined)).toBe("");
  });

  it("shows a handle for a platform URL", () => {
    expect(displaySocial("tiktok", "https://tiktok.com/@ethan")).toBe("@ethan");
  });

  it("shows the bare address for email", () => {
    expect(displaySocial("email", "mailto:a@b.co")).toBe("a@b.co");
  });

  it("shows a custom URL as is", () => {
    expect(displaySocial("x", "https://twitter.com/ethan")).toBe(
      "https://twitter.com/ethan",
    );
  });
});
