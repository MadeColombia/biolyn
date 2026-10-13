import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeClient, type FakeClient } from "../helpers/supabase";

let admin: FakeClient | null;
let pub: FakeClient;
const allow = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => pub }));
vi.mock("@/lib/rate-limit", () => ({ allow, visitorId: () => "visitor" }));

const { POST } = await import("@/app/api/view/route");

const ID = "0b8f5c1e-2d3a-4e5f-8a9b-0c1d2e3f4a5b";
const post = (body: unknown) =>
  POST(
    new NextRequest("https://www.biolyn.link/api/view", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/view", () => {
  beforeEach(() => {
    admin = fakeClient();
    pub = fakeClient();
    allow.mockReset().mockResolvedValue(true);
  });

  it.each([
    ["bad JSON", "{"],
    ["no profile id", {}],
    ["a number", { profileId: 5 }],
    ["SQL in the id", { profileId: "1; drop table views" }],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(admin!.rpc).not.toHaveBeenCalled();
  });

  it("logs the view with only the referrer's host", async () => {
    const res = await post({
      profileId: ID,
      referrer: "https://www.l.instagram.com/some/path?secret=1",
    });
    expect(res.status).toBe(204);
    expect(allow).toHaveBeenCalledWith("view:visitor", 60, 60);
    expect(admin!.rpc).toHaveBeenCalledWith("log_view", {
      p_profile_id: ID,
      p_referrer: "l.instagram.com",
    });
  });

  it.each([
    ["Biolyn itself", "https://biolyn.link/ethan"],
    ["a broken URL", "not a url"],
    ["a non-string", 42],
    ["nothing", undefined],
  ])("stores no referrer for %s", async (_label, referrer) => {
    await post({ profileId: ID, referrer });
    expect(admin!.rpc).toHaveBeenCalledWith("log_view", {
      p_profile_id: ID,
      p_referrer: null,
    });
  });

  it("stops counting past the rate limit", async () => {
    allow.mockResolvedValueOnce(false);
    const res = await post({ profileId: ID });
    expect(res.status).toBe(204);
    expect(admin!.rpc).not.toHaveBeenCalled();
  });

  it("falls back to the public client without a service key", async () => {
    admin = null;
    await post({ profileId: ID });
    expect(pub.rpc).toHaveBeenCalledWith("log_view", expect.any(Object));
  });
});
