import { describe, expect, it } from "vitest";
import {
  channelKey,
  channelLabel,
  cleanHost,
  cleanSource,
  parseSourceForm,
  referrerHost,
  siteName,
  sourceFromSearch,
  sourceUrl,
} from "@/lib/sources";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe("cleanSource", () => {
  it.each([
    ["TikTok", "tiktok"],
    ["TikTok Bio!", "tiktok-bio"],
    ["  spring_sale  ", "spring-sale"],
    ["Café Flyer", "cafe-flyer"],
    ["--a--", "a"],
    ["x".repeat(40), "x".repeat(30)],
    [`${"a".repeat(29)} b`, "a".repeat(29)],
  ])("%s becomes %s", (raw, code) => {
    expect(cleanSource(raw)).toBe(code);
  });

  it.each([[""], ["!!!"], [null], [42]])("gives up on %s", (raw) => {
    expect(cleanSource(raw)).toBeNull();
  });
});

describe("sourceFromSearch", () => {
  it("prefers ?s= over utm_source", () => {
    expect(sourceFromSearch("?s=tiktok&utm_source=mail")).toBe("tiktok");
  });
  it("falls back to utm_source", () => {
    expect(sourceFromSearch(new URLSearchParams("utm_source=News Letter"))).toBe(
      "news-letter",
    );
  });
  it("is null without either", () => {
    expect(sourceFromSearch("")).toBeNull();
  });
});

describe("referrerHost", () => {
  it("keeps only the host", () => {
    expect(referrerHost("https://www.L.Instagram.com/x?y=1", "biolyn.link")).toBe(
      "l.instagram.com",
    );
  });
  it.each([
    ["our own site", "https://www.biolyn.link/ethan"],
    ["junk", "nope"],
    ["empty", ""],
    ["a number", 3],
  ])("drops %s", (_l, raw) => {
    expect(referrerHost(raw, "www.biolyn.link")).toBeNull();
  });
});

describe("cleanHost", () => {
  it("accepts a site name", () => {
    expect(cleanHost(" WWW.t.co ")).toBe("t.co");
  });
  it.each([["<b>"], ["localhost"], [null], ["a/b.com"]])("rejects %s", (raw) => {
    expect(cleanHost(raw)).toBeNull();
  });
});

describe("siteName and channels", () => {
  it.each([
    ["l.instagram.com", "Instagram"],
    ["lm.facebook.com", "Facebook"],
    ["t.co", "X (Twitter)"],
    ["www.google.es", "Google"],
    ["youtu.be", "YouTube"],
    ["example.com", "example.com"],
  ])("%s is %s", (host, name) => {
    expect(siteName(host)).toBe(name);
  });

  it("puts the source code first, then the site, then direct", () => {
    expect(channelKey("tiktok", "t.co")).toBe("s:tiktok");
    expect(channelKey(null, "t.co")).toBe("r:X (Twitter)");
    expect(channelKey(null, "https://biolyn.link/ethan")).toBe("direct");
    expect(channelKey(null, null)).toBe("direct");
  });

  it("labels channels with the owner's names", () => {
    const names = { tiktok: "TikTok bio" };
    expect(channelLabel("s:tiktok", names)).toBe("TikTok bio");
    expect(channelLabel("s:mail", names)).toBe("mail");
    expect(channelLabel("r:Instagram", names)).toBe("Instagram");
    expect(channelLabel("direct", names)).toBe("Direct or unknown");
  });
});

describe("parseSourceForm", () => {
  it("makes the code from the name", () => {
    expect(parseSourceForm(form({ label: " TikTok bio ", code: "" }))).toEqual({
      values: { label: "TikTok bio", code: "tiktok-bio" },
    });
  });
  it("cleans a typed code", () => {
    expect(parseSourceForm(form({ label: "Flyer", code: "Spring 26" }))).toEqual({
      values: { label: "Flyer", code: "spring-26" },
    });
  });
  it("needs a name", () => {
    expect(parseSourceForm(form({}))).toEqual({
      error: "Give the link a name, like TikTok.",
    });
  });
  it("limits the name", () => {
    expect(parseSourceForm(form({ label: "x".repeat(41) }))).toEqual({
      error: "Keep the name under 40 characters.",
    });
  });
  it("needs letters or numbers somewhere", () => {
    expect(parseSourceForm(form({ label: "!!!" }))).toEqual({
      error: "Use letters or numbers in the code.",
    });
  });
});

describe("sourceUrl", () => {
  it("adds the tag", () => {
    expect(sourceUrl("https://biolyn.link", "ethan", "tiktok")).toBe(
      "https://biolyn.link/ethan?s=tiktok",
    );
  });
});
