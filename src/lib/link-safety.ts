import "server-only";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// False for localhost, IP addresses and single-word names, so the
// server never fetches anything on a private network.
export function isPublicHost(hostname: string) {
  const host = hostname.toLowerCase();
  return !(
    host === "localhost" ||
    host.startsWith("[") ||
    IPV4.test(host) ||
    !host.includes(".")
  );
}

export type LinkProblem = "badUrl" | "badProtocol" | "privateHost" | "unsafe";

// Basic checks every link must pass. Returns the key of an "errors"
// message, or null when the link is fine.
export async function checkLinkUrl(raw: string): Promise<LinkProblem | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "badUrl";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "badProtocol";
  }
  if (!isPublicHost(url.hostname)) {
    return "privateHost";
  }
  if (await isFlaggedByGoogle(url.href)) {
    return "unsafe";
  }
  return null;
}

// Optional: asks Google Safe Browsing about the URL when
// SAFE_BROWSING_API_KEY is set. Any error counts as "not flagged" so a
// Google outage never blocks saving.
async function isFlaggedByGoogle(url: string): Promise<boolean> {
  const key = process.env.SAFE_BROWSING_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          client: { clientId: "biolyn", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { matches?: unknown[] };
    return Boolean(data.matches?.length);
  } catch {
    return false;
  }
}
