import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPreviewImage,
  fetchScreenshot,
  previewFromHtml,
} from "@/lib/link-preview";

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

describe("previewFromHtml: site icons", () => {
  const ICON = "#biolyn-icon";

  it("uses the SVG icon when there's no share picture", () => {
    expect(
      previewFromHtml(
        `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`,
        PAGE,
      ),
    ).toBe(`https://shop.example.com/favicon.svg${ICON}`);
  });

  it("prefers apple-touch-icon, then the biggest sized icon", () => {
    const html = `
      <link rel="icon" sizes="192x192" href="/i192.png">
      <link rel="apple-touch-icon" href="/apple.png">
      <link rel="icon" href="/i.svg">`;
    expect(previewFromHtml(html, PAGE)).toBe(
      `https://shop.example.com/apple.png${ICON}`,
    );
    expect(
      previewFromHtml(
        `<link rel="icon" sizes="32x32" href="/s.png"><link rel="icon" sizes="192x192" href="/b.png">`,
        PAGE,
      ),
    ).toBe(`https://shop.example.com/b.png${ICON}`);
  });

  it("still prefers a share picture over any icon", () => {
    const html = `<link rel="apple-touch-icon" href="/a.png"><meta property="og:image" content="/og.jpg">`;
    expect(previewFromHtml(html, PAGE)).toBe("https://shop.example.com/og.jpg");
  });

  it.each([
    `<link rel="icon" href="/favicon.ico">`,
    `<link rel="icon" sizes="32x32" href="/small.png">`,
    `<link rel="icon" href="/unsized.png">`,
    `<link rel="stylesheet" href="/a.svg">`,
    `<link rel="icon">`,
  ])("ignores icons too small or unknown: %s", (html) => {
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

describe("fetchScreenshot", () => {
  const ok = (url = "https://iad.microlink.io/abc.jpeg") =>
    Response.json({ status: "success", data: { screenshot: { url } } });
  const image = (type = "image/jpeg", bytes = 10) =>
    new Response(new Uint8Array(bytes), { headers: { "content-type": type } });

  it("asks Microlink for a 16:9 screenshot and downloads it", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetch);
    const shot = await fetchScreenshot("https://ethanmont.dev");
    expect(shot?.type).toBe("image/jpeg");
    expect(shot?.data.byteLength).toBe(10);
    const api = fetch.mock.calls[0][0] as URL;
    expect(api.origin).toBe("https://api.microlink.io");
    expect(api.searchParams.get("url")).toBe("https://ethanmont.dev/");
    expect(api.searchParams.get("screenshot")).toBe("true");
    expect(api.searchParams.get("viewport.width")).toBe("1280");
    expect(api.searchParams.get("viewport.height")).toBe("720");
  });

  it("uses the pro endpoint with a key when one is set", async () => {
    vi.stubEnv("MICROLINK_API_KEY", "k");
    const fetch = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetch);
    await fetchScreenshot("https://a.com");
    const [api, init] = fetch.mock.calls[0];
    expect((api as URL).origin).toBe("https://pro.microlink.io");
    expect(init.headers).toEqual({ "x-api-key": "k" });
  });

  it("skips local addresses and bad URLs", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await fetchScreenshot("http://localhost")).toBeNull();
    expect(await fetchScreenshot("nope")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["the API fails", () => [new Response("", { status: 429 })]],
    ["there is no screenshot", () => [Response.json({ status: "fail" })]],
    ["the image is not on Microlink", () => [ok("https://evil.com/a.jpeg")]],
    ["the image is not https", () => [ok("http://iad.microlink.io/a.jpeg")]],
    ["the file is not an image", () => [ok(), image("text/html")]],
    ["the image is empty", () => [ok(), image("image/png", 0)]],
    ["the image is too big", () => [ok(), image("image/png", 3 * 1024 * 1024)]],
  ])("returns null when %s", async (_name, responses) => {
    const fetch = vi.fn();
    for (const r of responses()) fetch.mockResolvedValueOnce(r);
    vi.stubGlobal("fetch", fetch);
    expect(await fetchScreenshot("https://a.com")).toBeNull();
  });

  it("returns null when Microlink can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(await fetchScreenshot("https://a.com")).toBeNull();
  });
});
