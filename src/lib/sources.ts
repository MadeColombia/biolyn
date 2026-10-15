// Tracking sources: where a visitor came from.
//
// A source link is the normal page address with a tag on the end, like
// biolyn.link/ethan?s=tiktok. Owners create and name them in the dashboard.
// Visitors without a tag still get a source from UTM tags (?utm_source=...)
// or, failing that, from the site that sent them (the referrer).

/** Most source links one page can have. */
export const MAX_SOURCES = 20;

/** The query parameter that carries a source code. */
export const SOURCE_PARAM = "s";

const CODE = /^[a-z0-9-]{1,30}$/;

/**
 * Turns anything ("TikTok Bio", "utm_value") into a safe source code
 * ("tiktok-bio"): lowercase letters, numbers and dashes, 30 characters max.
 * Returns null when nothing usable is left.
 */
export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  return code ? code : null;
}

/** The source tag in a page address: ?s=... first, then ?utm_source=... */
export function sourceFromSearch(search: string | URLSearchParams): string | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return (
    cleanSource(params.get(SOURCE_PARAM)) ??
    cleanSource(params.get("utm_source"))
  );
}

/**
 * Keeps only the site name ("l.instagram.com"), never the full URL, and
 * drops visits that came from the page's own site.
 */
export function referrerHost(raw: unknown, ownHost: string): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return host && host !== ownHost.replace(/^www\./, "") ? host : null;
  } catch {
    return null;
  }
}

/** A site name as sent by the browser, checked and shortened. */
export function cleanHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const host = raw.trim().toLowerCase().replace(/^www\./, "");
  return /^[a-z0-9.-]{1,200}$/.test(host) && host.includes(".") ? host : null;
}

// Apps open links through their own redirect sites (l.instagram.com,
// t.co ...). Group those under the name people know.
const KNOWN_SITES: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, "Facebook"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, "Pinterest"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
];

/** "l.instagram.com" becomes "Instagram"; unknown sites stay as they are. */
export function siteName(host: string): string {
  for (const [pattern, name] of KNOWN_SITES) {
    if (pattern.test(host)) return name;
  }
  return host;
}

export const DIRECT = "direct";
export const DIRECT_LABEL = "Direct or unknown";

/**
 * One key per place visitors come from. A source code wins over the
 * referrer, so "s:tiktok" and the site "TikTok" stay apart: the first is
 * a link the owner shared on purpose.
 *
 * Old clicks stored the full page address as referrer, which is our own
 * site, so anything with a "/" in it counts as unknown.
 */
export function channelKey(source: string | null, referrer: string | null) {
  if (source) return `s:${source}`;
  if (referrer && !referrer.includes("/")) return `r:${siteName(referrer)}`;
  return DIRECT;
}

/** What the dashboard shows for a channel key. */
export function channelLabel(key: string, names: Record<string, string>) {
  if (key.startsWith("s:")) {
    const code = key.slice(2);
    return names[code] ?? code;
  }
  if (key.startsWith("r:")) return key.slice(2);
  return DIRECT_LABEL;
}

export type SourceValues = { label: string; code: string };

/** Checks the "new source link" form. */
export function parseSourceForm(
  formData: FormData,
): { values: SourceValues } | { error: string } {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Give the link a name, like TikTok." };
  if (label.length > 40) return { error: "Keep the name under 40 characters." };
  const typed = String(formData.get("code") ?? "").trim();
  const code = cleanSource(typed || label);
  if (!code || !CODE.test(code)) {
    return { error: "Use letters or numbers in the code." };
  }
  return { values: { label, code } };
}

/** The address to share for a source, e.g. https://biolyn.link/ethan?s=tiktok */
export function sourceUrl(siteUrl: string, username: string, code: string) {
  return `${siteUrl}/${username}?${SOURCE_PARAM}=${encodeURIComponent(code)}`;
}
