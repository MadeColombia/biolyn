import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type FakeClient } from "../helpers/supabase";

let admin: FakeClient | null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => admin,
}));

const { allow, visitorId } = await import("@/lib/rate-limit");

describe("visitorId", () => {
  beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret"));

  it("never contains the raw IP", () => {
    const id = visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(id).not.toContain("203");
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("uses the first address in x-forwarded-for", () => {
    const a = visitorId(
      new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }),
    );
    const b = visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(a).toBe(b);
  });

  it("falls back to x-real-ip, then to a shared id", () => {
    const real = visitorId(new Headers({ "x-real-ip": "203.0.113.7" }));
    expect(real).toBe(
      visitorId(new Headers({ "x-forwarded-for": "203.0.113.7" })),
    );
    expect(visitorId(new Headers())).toBe(visitorId(new Headers()));
    expect(visitorId(new Headers())).not.toBe(real);
  });

  it("gives different ids for different visitors", () => {
    expect(visitorId(new Headers({ "x-real-ip": "1.1.1.1" }))).not.toBe(
      visitorId(new Headers({ "x-real-ip": "1.1.1.2" })),
    );
  });

  it("depends on the secret, so ids can't be guessed from an IP", () => {
    const h = new Headers({ "x-real-ip": "1.1.1.1" });
    const withSecret = visitorId(h);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "other");
    expect(visitorId(h)).not.toBe(withSecret);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined as unknown as string);
    expect(visitorId(h)).toHaveLength(22);
  });
});

describe("allow", () => {
  beforeEach(() => {
    admin = fakeClient();
  });

  it("lets everything through when there is no admin client", async () => {
    admin = null;
    expect(await allow("k", 1, 60)).toBe(true);
  });

  it("calls the rate_limit_hit function with the limits", async () => {
    admin!.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await allow("view:abc", 60, 30)).toBe(true);
    expect(admin!.rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_key: "view:abc",
      p_limit: 60,
      p_window_seconds: 30,
    });
  });

  it("blocks once the database says the limit is reached", async () => {
    admin!.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await allow("k", 1, 60)).toBe(false);
  });

  it("fails open when the database errors", async () => {
    admin!.rpc.mockResolvedValueOnce({
      data: false,
      error: { message: "down" },
    } as never);
    expect(await allow("k", 1, 60)).toBe(true);
  });
});
