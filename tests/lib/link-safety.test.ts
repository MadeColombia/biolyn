import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLinkUrl } from "@/lib/link-safety";

const LOCAL = "Use a public website address, not a local or IP address.";

describe("checkLinkUrl: basic checks", () => {
  it.each([
    "https://biolyn.link",
    "http://example.com/path?q=1",
    "https://sub.domain.co.uk",
  ])("accepts %s", async (url) => {
    expect(await checkLinkUrl(url)).toBeNull();
  });

  it("rejects text that isn't a URL", async () => {
    expect(await checkLinkUrl("not a url")).toBe(
      "That URL doesn't look right.",
    );
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com",
    "mailto:a@b.co",
  ])("rejects the unsafe scheme in %s", async (url) => {
    expect(await checkLinkUrl(url)).toBe(
      "Links must start with http:// or https://.",
    );
  });

  it.each([
    "http://localhost:3000",
    "http://LOCALHOST",
    "http://127.0.0.1",
    "http://192.168.1.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://intranet/",
    // The URL parser turns these short and hex forms into 127.0.0.1.
    "http://127.1",
    "http://0x7f000001",
    "http://2130706433",
  ])("rejects the local or IP address %s", async (url) => {
    expect(await checkLinkUrl(url)).toBe(LOCAL);
  });
});

describe("checkLinkUrl: Google Safe Browsing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("skips Google when no key is set", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await checkLinkUrl("https://example.com")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks a link Google flags", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "k");
    const fetch = vi.fn(async () =>
      Response.json({ matches: [{ threatType: "MALWARE" }] }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await checkLinkUrl("https://bad.example")).toMatch(
      /Google Safe Browsing flags this link/,
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("key=k");
    expect(JSON.parse(String(init.body)).threatInfo.threatEntries).toEqual([
      { url: "https://bad.example/" },
    ]);
  });

  it("allows a link Google doesn't flag", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    expect(await checkLinkUrl("https://ok.example")).toBeNull();
  });

  it("allows the link when Google answers with an error", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    expect(await checkLinkUrl("https://ok.example")).toBeNull();
  });

  it("allows the link when Google can't be reached", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    expect(await checkLinkUrl("https://ok.example")).toBeNull();
  });
});
