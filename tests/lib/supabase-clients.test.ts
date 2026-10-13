import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn<(...args: unknown[]) => object>(() => ({ kind: "js" }));
const createServerClient = vi.fn<(...args: unknown[]) => object>(() => ({ kind: "ssr" }));
const createBrowserClient = vi.fn<(...args: unknown[]) => object>(() => ({ kind: "browser" }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@supabase/ssr", () => ({ createServerClient, createBrowserClient }));

const cookieStore = {
  getAll: vi.fn(() => [{ name: "sb", value: "1" }]),
  set: vi.fn(),
};
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const { supabaseEnv } = await import("@/lib/supabase/env");
const { createAdminClient } = await import("@/lib/supabase/admin");
const { createPublicClient } = await import("@/lib/supabase/public");
const browser = await import("@/lib/supabase/browser");
const server = await import("@/lib/supabase/server");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  createClient.mockClear();
});

describe("supabaseEnv", () => {
  it("reads the public settings", () => {
    expect(supabaseEnv()).toEqual({
      url: "https://x.supabase.co",
      anonKey: "anon",
    });
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])(
    "explains what's missing when %s is unset",
    (name) => {
      vi.stubEnv(name, "");
      expect(() => supabaseEnv()).toThrow(/Copy .env.example/);
    },
  );
});

describe("createAdminClient", () => {
  it("returns null without the service role key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createAdminClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses the service key and never stores a session", () => {
    createAdminClient();
    expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "service", {
      auth: { persistSession: false },
    });
  });
});

describe("createPublicClient", () => {
  it("uses only the public anon key", () => {
    createPublicClient();
    expect(createClient).toHaveBeenCalledWith("https://x.supabase.co", "anon", {
      auth: { persistSession: false },
    });
  });
});

describe("browser createClient", () => {
  it("uses the anon key", () => {
    browser.createClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "anon",
    );
  });
});

describe("server createClient", () => {
  it("reads and writes the request cookies", async () => {
    await server.createClient();
    const [, key, opts] = createServerClient.mock.calls[0] as [
      string,
      string,
      { cookies: { getAll(): unknown; setAll(c: unknown[]): void } },
    ];
    expect(key).toBe("anon");
    expect(opts.cookies.getAll()).toEqual([{ name: "sb", value: "1" }]);
    opts.cookies.setAll([{ name: "a", value: "b", options: { path: "/" } }]);
    expect(cookieStore.set).toHaveBeenCalledWith("a", "b", { path: "/" });
  });

  it("ignores cookie writes from Server Components", async () => {
    await server.createClient();
    const opts = createServerClient.mock.lastCall![2] as {
      cookies: { setAll(c: unknown[]): void };
    };
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("read-only");
    });
    expect(() =>
      opts.cookies.setAll([{ name: "a", value: "b", options: {} }]),
    ).not.toThrow();
  });
});
