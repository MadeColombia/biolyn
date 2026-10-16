import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { appleTestKeys, googleTestKeys } from "../helpers/wallet-keys";

const getPublicProfile = vi.fn();
vi.mock("@/lib/profiles", () => ({ getPublicProfile }));

const { GET } = await import("@/app/api/wallet/google/[username]/route");
const { passContentFor, walletsOn } = await import("@/lib/pass-content");

const ANA = {
  username: "ana",
  display_name: " Ana ",
  avatar_url: null,
  theme: "midnight",
};

const get = (username: string, query = "") =>
  GET(
    new NextRequest(
      `https://biolyn.link/api/wallet/google/${username}${query}`,
    ),
    {
      params: Promise.resolve({ username }),
    },
  );

describe("passContentFor", () => {
  beforeEach(() => {
    getPublicProfile.mockReset().mockResolvedValue(ANA);
  });

  it("is null for a missing page", async () => {
    getPublicProfile.mockResolvedValue(null);
    expect(await passContentFor("nobody", new URLSearchParams())).toBeNull();
  });

  it("uses the page, its name and the chosen style", async () => {
    const pass = await passContentFor(
      "ANA",
      new URLSearchParams("style=night"),
    );
    expect(getPublicProfile).toHaveBeenCalledWith("ana");
    expect(pass!.content).toMatchObject({
      name: "Ana",
      qrUrl: "https://biolyn.link/ana",
      style: "night",
      code: null,
    });
    expect(pass!.id).toMatch(/^ana_page_night_[0-9a-z]+$/);
  });

  it("points the QR code at a tracking link", async () => {
    getPublicProfile.mockResolvedValue({ ...ANA, display_name: null });
    const pass = await passContentFor("ana", new URLSearchParams("s=Flyer"));
    expect(pass!.content).toMatchObject({
      name: "ana",
      qrUrl: "https://biolyn.link/ana?s=flyer",
      style: "brand",
      code: "flyer",
    });
  });
});

describe("walletsOn", () => {
  it("shows only wallets whose keys work", () => {
    expect(walletsOn()).toEqual({ apple: false, google: false });
    for (const [k, v] of Object.entries({
      ...appleTestKeys().env,
      ...googleTestKeys().env,
    })) {
      vi.stubEnv(k, v);
    }
    expect(walletsOn()).toEqual({ apple: true, google: true });
  });
});

describe("GET /api/wallet/google/[username]", () => {
  beforeEach(() => {
    getPublicProfile.mockReset().mockResolvedValue(ANA);
  });

  it("is 404 until the Google keys are set", async () => {
    expect((await get("ana")).status).toBe(404);
  });

  it("is 404 for a missing page", async () => {
    for (const [k, v] of Object.entries(googleTestKeys().env)) vi.stubEnv(k, v);
    getPublicProfile.mockResolvedValue(null);
    expect((await get("nobody")).status).toBe(404);
  });

  it("sends the visitor to Google with the pass", async () => {
    for (const [k, v] of Object.entries(googleTestKeys().env)) vi.stubEnv(k, v);
    const res = await get("ana", "?style=page&s=flyer");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(
      /^https:\/\/pay\.google\.com\/gp\/v\/save\/[\w-]+\.[\w-]+\.[\w-]+$/,
    );
  });
});
