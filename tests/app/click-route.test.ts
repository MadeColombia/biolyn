import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeClient, type FakeClient } from "../helpers/supabase";

let admin: FakeClient | null;
let pub: FakeClient;
const allow = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => pub }));
vi.mock("@/lib/rate-limit", () => ({ allow, visitorId: () => "visitor" }));

const { GET } = await import("@/app/api/click/[linkId]/route");

const click = (linkId = "l1") =>
  GET(
    new NextRequest(`https://biolyn.link/api/click/${linkId}`, {
      headers: { referer: "https://biolyn.link/ethan" },
    }),
    { params: Promise.resolve({ linkId }) } as never,
  );

const live = { url: "https://example.com/x", starts_at: null, ends_at: null };

describe("GET /api/click/[linkId]", () => {
  beforeEach(() => {
    admin = fakeClient();
    allow.mockReset().mockResolvedValue(true);
  });

  it("logs the click and redirects to the link", async () => {
    pub = fakeClient({ links: [{ data: live }] });
    const res = await click();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/x");
    expect(admin!.rpc).toHaveBeenCalledWith("log_click", {
      p_link_id: "l1",
      p_referrer: "https://biolyn.link/ethan",
    });
  });

  it("only follows visible links on pages that aren't suspended", async () => {
    pub = fakeClient({ links: [{ data: live }] });
    await click();
    const calls = pub.queries.links[0].calls;
    expect(calls).toContainEqual({ method: "eq", args: ["id", "l1"] });
    expect(calls).toContainEqual({ method: "eq", args: ["is_visible", true] });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["profiles.is_suspended", false],
    });
  });

  it("sends unknown, hidden or suspended links home", async () => {
    pub = fakeClient({ links: [{ data: null }] });
    const res = await click("nope");
    expect(res.headers.get("location")).toBe("https://biolyn.link/");
    expect(admin!.rpc).not.toHaveBeenCalled();
  });

  it("sends photo galleries (no address) home without counting", async () => {
    pub = fakeClient({ links: [{ data: { ...live, url: null } }] });
    const res = await click("g1");
    expect(res.headers.get("location")).toBe("https://biolyn.link/");
    expect(admin!.rpc).not.toHaveBeenCalled();
  });

  it("sends ended scheduled links home", async () => {
    pub = fakeClient({
      links: [{ data: { ...live, ends_at: "2000-01-01T00:00:00Z" } }],
    });
    const res = await click();
    expect(res.headers.get("location")).toBe("https://biolyn.link/");
  });

  it("still redirects but stops counting past the rate limit", async () => {
    pub = fakeClient({ links: [{ data: live }] });
    allow.mockResolvedValueOnce(false);
    const res = await click();
    expect(res.headers.get("location")).toBe("https://example.com/x");
    expect(admin!.rpc).not.toHaveBeenCalled();
  });

  it("falls back to the public client without a service key", async () => {
    admin = null;
    pub = fakeClient({ links: [{ data: live }] });
    await click();
    expect(pub.rpc).toHaveBeenCalledWith("log_click", expect.any(Object));
  });
});
