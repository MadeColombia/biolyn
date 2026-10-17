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
const go = (path: string, headers: Record<string, string> = {}) =>
  proxy(
    new NextRequest(`https://biolyn.link${path}`, {
      headers: { cookie: "sb=old", ...headers },
    }),
  );
// Where a rewrite sends the request inside the app (app/[locale]/...).
const rewrittenTo = (res: Response) => {
  const to = res.headers.get("x-middleware-rewrite");
  return to && new URL(to).pathname + new URL(to).search;
};

describe("proxy", () => {
  beforeEach(() => {
    user = null;
    onCreate = undefined;
  });

  it("runs on pages but not on API routes, sign-in or files", () => {
    const [pattern] = config.matcher;
    const runs = (path: string) => new RegExp(`^${pattern}$`).test(path);
    for (const path of ["/", "/es", "/dashboard", "/ana", "/ana.lopez", "/report/ana"]) {
      expect(runs(path), path).toBe(true);
    }
    for (const path of [
      "/api/view",
      "/auth/callback",
      "/_next/static/a.js",
      "/favicon.ico",
      "/icon.svg",
      "/brand/biolyn-mark.svg",
      "/robots.txt",
    ]) {
      expect(runs(path), path).toBe(false);
    }
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

describe("proxy languages", () => {
  beforeEach(() => {
    user = null;
    onCreate = undefined;
  });

  it("serves pages in English by default, at the same address", async () => {
    const res = await go("/ana?s=tiktok");
    expect(res.headers.get("location")).toBeNull();
    expect(rewrittenTo(res)).toBe("/en/ana?s=tiktok");
  });

  it("follows the browser's language", async () => {
    const res = await go("/ana", { "accept-language": "es-CO,es;q=0.9" });
    expect(rewrittenTo(res)).toBe("/es/ana");
  });

  it("prefers the saved choice over the browser", async () => {
    const res = await go("/report/ana", {
      cookie: "NEXT_LOCALE=en",
      "accept-language": "es",
    });
    expect(rewrittenTo(res)).toBe("/en/report/ana");
  });

  it("tells server actions the language through a header", async () => {
    const res = await go("/ana", { cookie: "NEXT_LOCALE=es" });
    expect(res.headers.get("x-middleware-request-x-biolyn-locale")).toBe("es");
  });

  it("serves the English homepage at / and sends Spanish speakers to /es", async () => {
    expect(rewrittenTo(await go("/"))).toBe("/en");
    const res = await go("/?ref=ig", { "accept-language": "es-ES" });
    expect(res.headers.get("location")).toBe("https://biolyn.link/es?ref=ig");
  });

  it("serves the Spanish homepage at /es and remembers the choice", async () => {
    const res = await go("/es");
    expect(rewrittenTo(res)).toBe("/es");
    expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("es");
    expect(rewrittenTo(await go("/es/"))).toBe("/es/");
  });

  it("does not set the cookie again when it is already saved", async () => {
    const res = await go("/es", { cookie: "NEXT_LOCALE=es" });
    expect(res.cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("drops a language prefix from other pages and remembers it", async () => {
    const res = await go("/es/dashboard?tab=1");
    expect(res.headers.get("location")).toBe(
      "https://biolyn.link/dashboard?tab=1",
    );
    expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("es");
  });

  it("sends /en to the English homepage", async () => {
    const res = await go("/en", { cookie: "NEXT_LOCALE=es" });
    expect(res.headers.get("location")).toBe("https://biolyn.link/");
    expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });

  it("keeps the language when the session cookie is refreshed", async () => {
    user = { id: "u1" };
    onCreate = (opts) =>
      opts.cookies.setAll([{ name: "sb", value: "new", options: {} }]);
    const res = await go("/dashboard", { cookie: "sb=old; NEXT_LOCALE=es" });
    expect(rewrittenTo(res)).toBe("/es/dashboard");
    expect(res.cookies.get("sb")?.value).toBe("new");
  });
});
