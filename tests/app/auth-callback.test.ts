import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeClient, type FakeClient } from "../helpers/supabase";

let db: FakeClient;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));

const { GET } = await import("@/app/auth/callback/route");
const visit = (query: string, headers: Record<string, string> = {}) =>
  GET(new NextRequest(`https://biolyn.link/auth/callback${query}`, { headers }));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    db = fakeClient();
  });

  it("signs in with a valid code and opens the dashboard", async () => {
    const res = await visit("?code=abc");
    expect(db.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("https://biolyn.link/dashboard");
  });

  it("sends a bad or used code back to login", async () => {
    db.auth.exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "expired" },
    } as never);
    const res = await visit("?code=old");
    expect(res.headers.get("location")).toBe(
      "https://biolyn.link/login?error=link",
    );
  });

  it("sends a visit without a code back to login", async () => {
    const res = await visit("");
    expect(db.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "https://biolyn.link/login?error=link",
    );
  });

  it("ignores a ?next= parameter (no open redirect)", async () => {
    const res = await visit("?code=abc&next=https://evil.example");
    expect(res.headers.get("location")).toBe("https://biolyn.link/dashboard");
  });

  describe("saves the site language on the account for sign-in emails", () => {
    const signIn = (locale?: string) =>
      db.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: { user: { user_metadata: locale ? { locale } : {} } },
        error: null,
      } as never);

    it("from the language cookie", async () => {
      signIn();
      await visit("?code=abc", { cookie: "NEXT_LOCALE=es" });
      expect(db.auth.updateUser).toHaveBeenCalledWith({ data: { locale: "es" } });
    });

    it("from the browser language when there is no cookie", async () => {
      signIn("es");
      await visit("?code=abc", { "accept-language": "en-GB,en;q=0.9" });
      expect(db.auth.updateUser).toHaveBeenCalledWith({ data: { locale: "en" } });
    });

    it("leaves the account alone when it already matches", async () => {
      signIn("es");
      await visit("?code=abc", { cookie: "NEXT_LOCALE=es" });
      expect(db.auth.updateUser).not.toHaveBeenCalled();
    });

    it("still signs in when saving fails", async () => {
      signIn();
      db.auth.updateUser.mockRejectedValueOnce(new Error("offline"));
      const res = await visit("?code=abc");
      expect(res.headers.get("location")).toBe("https://biolyn.link/dashboard");
    });
  });
});
