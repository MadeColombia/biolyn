import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPreviewImage, previewFromHtml } from "@/lib/link-preview";

const PAGE = new URL("https://shop.example.com/item/1");

function htmlResponse(html: string, init: ResponseInit = {}) {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("previewFromHtml", () => {
  it("reads og:image in either attribute order", () => {
    expect(
      previewFromHtml(
        `<meta content="https://cdn.x.com/a.jpg" property="og:image">`,
        PAGE,
      ),
    ).toBe("https://cdn.x.com/a.jpg");
    expect(
      previewFromHtml(`<META PROPERTY='og:image' CONTENT='/b.png' />`, PAGE),
    ).toBe("https://shop.example.com/b.png");
  });

  it("prefers og:image over twitter:image", () => {
    const html = `
      <meta name="twitter:image" content="https://t.co/t.jpg">
      <meta property="og:image" content="https://cdn.x.com/og.jpg">`;
    expect(previewFromHtml(html, PAGE)).toBe("https://cdn.x.com/og.jpg");
  });

  it("falls back to twitter:image and decodes entities", () => {
    expect(
      previewFromHtml(
        `<meta name="twitter:image" content="https://x.com/i.jpg?a=1&amp;b=2">`,
        PAGE,
      ),
    ).toBe("https://x.com/i.jpg?a=1&b=2");
  });

  it("upgrades http pictures to https", () => {
    expect(
      previewFromHtml(`<meta property="og:image" content="http://x.com/i.jpg">`, PAGE),
    ).toBe("https://x.com/i.jpg");
  });

  it.each([
    "",
    `<meta property="og:title" content="Hi">`,
    `<meta property="og:image" content="javascript:alert(1)">`,
    `<meta property="og:image" content="https://x.com/${"a".repeat(2000)}">`,
    `<meta property="og:image" content="http://[bad">`,
  ])("returns null for %#", (html) => {
    expect(previewFromHtml(html, PAGE)).toBeNull();
  });
});

describe("fetchPreviewImage", () => {
  it("uses YouTube's thumbnail without fetching the page", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the picture from the page", async () => {
    const fetch = vi.fn(async () =>
      htmlResponse(`<head><meta property="og:image" content="/og.jpg"></head>`),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("https://a.com/p")).toBe(
      "https://a.com/og.jpg",
    );
  });

  it("follows redirects and resolves against the final page", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: "https://b.com/x" } }),
      )
      .mockResolvedValueOnce(
        htmlResponse(`<meta property="og:image" content="img.jpg">`),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("https://a.com")).toBe("https://b.com/img.jpg");
  });

  it("never follows a redirect to a private address", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("https://a.com")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after too many redirects", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://a.com/again" } }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("https://a.com")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["an error page", () => htmlResponse("nope", { status: 404 })],
    [
      "something that isn't HTML",
      () =>
        new Response("{}", { headers: { "content-type": "application/json" } }),
    ],
  ])("returns null for %s", async (_name, make) => {
    vi.stubGlobal("fetch", vi.fn(async () => make()));
    expect(await fetchPreviewImage("https://a.com")).toBeNull();
  });

  it("returns null when the site can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    expect(await fetchPreviewImage("https://a.com")).toBeNull();
  });

  it("skips local addresses and bad URLs without fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await fetchPreviewImage("http://localhost:3000")).toBeNull();
    expect(await fetchPreviewImage("not a url")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("only reads the start of a huge page", async () => {
    const head = `<meta property="og:image" content="https://a.com/i.jpg">`;
    const big = head + "x".repeat(2 * 1024 * 1024);
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse(big)));
    expect(await fetchPreviewImage("https://a.com")).toBe("https://a.com/i.jpg");
  });
});
