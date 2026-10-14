import "server-only";
import { embedFor } from "@/lib/embeds";
import { ICON_MARK } from "@/lib/link-form";
import { isPublicHost } from "@/lib/link-safety";

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 4000;

// Meta tags that name a page's share picture, best first.
const IMAGE_KEYS = [
  "og:image:secure_url",
  "og:image",
  "og:image:url",
  "twitter:image",
  "twitter:image:src",
];

/**
 * The picture a page shows when it's shared (its og:image), as an https
 * URL, or null when there is none or the page can't be read. Never
 * throws: a missing preview must not stop a link from saving.
 */
export async function fetchPreviewImage(pageUrl: string): Promise<string | null> {
  // YouTube often answers servers in Europe with a cookie consent page,
  // so ask its thumbnail service directly.
  const embed = embedFor(pageUrl);
  if (embed?.kind === "youtube") {
    const id = embed.src.split("/").pop();
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  try {
    const page = await fetchHtml(pageUrl);
    if (!page) return null;
    return previewFromHtml(page.html, page.url);
  } catch {
    return null;
  }
}

// Follows redirects by hand so every hop gets the public address check.
async function fetchHtml(start: string) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:$/.test(url.protocol) || !isPublicHost(url.hostname)) {
      return null;
    }
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        accept: "text/html",
        "user-agent": "biolyn-preview/1.0 (+https://biolyn.link)",
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok || !res.body) return null;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
    return { html: await readStart(res.body), url };
  }
  return null;
}

// The first MAX_BYTES of the page are plenty: meta tags live in <head>.
async function readStart(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

function attr(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// An absolute https URL for `raw`, or null.
function httpsUrl(raw: string, pageUrl: URL): string | null {
  try {
    const url = new URL(decodeEntities(raw.trim()), pageUrl);
    // Browsers block http pictures on an https page.
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:" || url.href.length > 2000) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

// The biggest icon a page declares: apple-touch-icon first (180px),
// then a sized or SVG icon. Tiny .ico favicons look blurry when large,
// so they're skipped.
function iconFromHtml(html: string, pageUrl: URL): string | null {
  let best: { href: string; score: number } | null = null;
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    const href = attr(tag, "href");
    if (!href || !/(^|\s)(icon|apple-touch-icon(-precomposed)?)(\s|$)/.test(rel)) {
      continue;
    }
    if (/\.ico(\?|$)/i.test(href)) continue;
    const size = Number(attr(tag, "sizes")?.match(/^(\d+)/)?.[1] ?? 0);
    const svg =
      /svg/i.test(attr(tag, "type") ?? "") || /\.svg(\?|$)/i.test(href);
    const score = rel.includes("apple-touch-icon")
      ? 1000 + size
      : svg
        ? 900
        : size;
    if (score >= 64 && (!best || score > best.score)) best = { href, score };
  }
  const url = best && httpsUrl(best.href, pageUrl);
  return url ? url + ICON_MARK : null;
}

/**
 * Finds the share picture in a page's HTML, or else its biggest icon
 * (marked with ICON_MARK). Exported for tests.
 */
export function previewFromHtml(html: string, pageUrl: URL): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !found.has(key)) found.set(key, content);
  }
  for (const key of IMAGE_KEYS) {
    const raw = found.get(key);
    const url = raw && httpsUrl(raw, pageUrl);
    if (url) return url;
  }
  return iconFromHtml(html, pageUrl);
}

const SCREENSHOT_TIMEOUT_MS = 15000;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export type Screenshot = { data: ArrayBuffer; type: string };

/**
 * A 16:9 screenshot of the page, taken by Microlink (microlink.io), for
 * sites without a share picture. MICROLINK_API_KEY is optional: without
 * it the free plan is used, which has a small daily limit. Returns null
 * on any problem so saving never fails because of it.
 */
export async function fetchScreenshot(pageUrl: string): Promise<Screenshot | null> {
  try {
    const target = new URL(pageUrl);
    if (!isPublicHost(target.hostname)) return null;

    const key = process.env.MICROLINK_API_KEY;
    const api = new URL(
      key ? "https://pro.microlink.io/" : "https://api.microlink.io/",
    );
    api.search = new URLSearchParams({
      url: target.href,
      screenshot: "true",
      meta: "false",
      "viewport.width": "1280",
      "viewport.height": "720",
      type: "jpeg",
    }).toString();

    const signal = AbortSignal.timeout(SCREENSHOT_TIMEOUT_MS);
    const res = await fetch(api, {
      signal,
      headers: key ? { "x-api-key": key } : {},
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      status?: string;
      data?: { screenshot?: { url?: string } };
    };
    const shot = body.data?.screenshot?.url;
    if (body.status !== "success" || !shot) return null;

    // Only download from Microlink's own servers.
    const shotUrl = new URL(shot);
    if (shotUrl.protocol !== "https:" || !/(^|\.)microlink\.io$/.test(shotUrl.hostname)) {
      return null;
    }
    const image = await fetch(shotUrl, { signal });
    const type = image.headers.get("content-type") ?? "";
    if (!image.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const data = await image.arrayBuffer();
    if (data.byteLength === 0 || data.byteLength > MAX_SCREENSHOT_BYTES) {
      return null;
    }
    return { data, type };
  } catch {
    return null;
  }
}
