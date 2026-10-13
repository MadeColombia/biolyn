import "server-only";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// Basic checks every link must pass. Returns an error message, or null
// when the link is fine.
export async function checkLinkUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That URL doesn't look right.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Links must start with http:// or https://.";
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("[") ||
    IPV4.test(host) ||
    !host.includes(".")
  ) {
    return "Use a public website address, not a local or IP address.";
  }
  if (await isFlaggedByGoogle(url.href)) {
    return "Google Safe Browsing flags this link as unsafe, so it can't be added.";
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
