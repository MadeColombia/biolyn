import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieOpts = {
  cookies: {
    getAll(): unknown;
    setAll(c: { name: string; value: string; options?: object }[]): void;
  };
};
let user: object | null = null;
let onCreate: ((opts: CookieOpts) => void) | undefined;
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...[, , opts]: [string, string, CookieOpts]) => {
    onCreate?.(opts);
    return { auth: { getUser: async () => ({ data: { user } }) } };
  },
}));

const { proxy, config } = await import("@/proxy");
const go = (path: string) =>
  proxy(
    new NextRequest(`https://biolyn.link${path}`, {
      headers: { cookie: "sb=old" },
    }),
  );

describe("proxy", () => {
  beforeEach(() => {
    user = null;
    onCreate = undefined;
  });

  it("only runs on the dashboard and login pages", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/login"]);
  });

  it("sends signed-out visitors from the dashboard to login", async () => {
    const res = await go("/dashboard");
    expect(res.headers.get("location")).toBe("https://biolyn.link/login");
  });

  it("lets signed-out visitors open login", async () => {
    const res = await go("/login");
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends signed-in users from login to the dashboard", async () => {
    user = { id: "u1" };
    const res = await go("/login");
    expect(res.headers.get("location")).toBe("https://biolyn.link/dashboard");
  });

  it("lets signed-in users open the dashboard", async () => {
    user = { id: "u1" };
    const res = await go("/dashboard/anything");
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes refreshed session cookies on to the browser", async () => {
    user = { id: "u1" };
    onCreate = (opts) => {
      expect(opts.cookies.getAll()).toEqual([{ name: "sb", value: "old" }]);
      opts.cookies.setAll([
        { name: "sb", value: "new", options: { httpOnly: true } },
      ]);
    };
    const res = await go("/dashboard");
    expect(res.cookies.get("sb")?.value).toBe("new");
    expect(res.cookies.get("sb")?.httpOnly).toBe(true);
  });
});
