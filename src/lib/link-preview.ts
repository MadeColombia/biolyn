import "server-only";
import { embedFor } from "@/lib/embeds";
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

/** Finds the share picture in a page's HTML. Exported for tests. */
export function previewFromHtml(html: string, pageUrl: URL): string | null {
  const found = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !found.has(key)) found.set(key, content);
  }
  for (const key of IMAGE_KEYS) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const url = new URL(decodeEntities(raw.trim()), pageUrl);
      // Browsers block http pictures on an https page.
      if (url.protocol === "http:") url.protocol = "https:";
      if (url.protocol === "https:" && url.href.length <= 2000) return url.href;
    } catch {
      // Not a URL; try the next key.
    }
  }
  return null;
}
