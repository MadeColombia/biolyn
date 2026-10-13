import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type FakeClient } from "../helpers/supabase";

const cacheTag = vi.fn();
const cacheLife = vi.fn();
vi.mock("next/cache", () => ({ cacheTag, cacheLife }));

let db: FakeClient;
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => db }));

const { getPublicProfile, profileTag } = await import("@/lib/profiles");

const NOW = Date.parse("2026-10-13T12:00:00Z");
const profile = {
  id: "p1",
  username: "ethan",
  display_name: "Ethan",
  bio: "hi",
  avatar_url: null,
  theme: { preset: "midnight" },
  socials: { x: "https://x.com/e", github: "javascript:alert(1)" },
  is_suspended: false,
};
const link = (over: object) => ({
  id: "l",
  title: "T",
  url: "https://example.com",
  embed: false,
  starts_at: null,
  ends_at: null,
  ...over,
});

describe("getPublicProfile", () => {
  beforeEach(() => {
    cacheTag.mockReset();
    cacheLife.mockReset();
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });

  it("tags the cache by username", () => {
    expect(profileTag("ethan")).toBe("profile:ethan");
  });

  it("returns null for a missing page", async () => {
    db = fakeClient({ profiles: [{ data: null }] });
    expect(await getPublicProfile("nobody")).toBeNull();
    expect(cacheTag).toHaveBeenCalledWith("profile:nobody");
    expect(cacheLife).toHaveBeenCalledWith("hours");
    expect(db.from).not.toHaveBeenCalledWith("links");
  });

  it("hides suspended pages as if they don't exist", async () => {
    db = fakeClient({
      profiles: [{ data: { ...profile, is_suspended: true } }],
    });
    expect(await getPublicProfile("ethan")).toBeNull();
    expect(db.from).not.toHaveBeenCalledWith("links");
  });

  it("returns live, visible links with safe socials", async () => {
    db = fakeClient({
      profiles: [{ data: profile }],
      links: [
        {
          data: [
            link({ id: "a" }),
            link({ id: "b", starts_at: "2026-10-13T13:00:00Z" }),
            link({ id: "c", ends_at: "2026-10-13T11:00:00Z" }),
            link({
              id: "d",
              embed: true,
              url: "https://youtu.be/dQw4w9WgXcQ",
            }),
          ],
        },
      ],
    });
    const page = await getPublicProfile("ethan");
    expect(page?.links.map((l) => l.id)).toEqual(["a", "d"]);
    expect(page?.links[0].embed).toBeNull();
    expect(page?.links[1].embed?.kind).toBe("youtube");
    expect(page?.theme).toBe("midnight");
    expect(page?.socials).toEqual({ x: "https://x.com/e" });
    expect(page).not.toHaveProperty("is_suspended");

    expect(db.queries.links[0].calls).toContainEqual({
      method: "eq",
      args: ["is_visible", true],
    });
    // Refreshes when link "b" appears in an hour.
    expect(cacheLife).toHaveBeenCalledWith({
      stale: 60,
      revalidate: 3600,
      expire: 86400,
    });
  });

  it("refreshes the cache sooner when a link is about to change", async () => {
    db = fakeClient({
      profiles: [{ data: profile }],
      links: [{ data: [link({ ends_at: "2026-10-13T12:05:00Z" })] }],
    });
    await getPublicProfile("ethan");
    expect(cacheLife).toHaveBeenCalledWith(
      expect.objectContaining({ revalidate: 300 }),
    );
  });

  it("never refreshes more often than once a minute", async () => {
    db = fakeClient({
      profiles: [{ data: profile }],
      links: [{ data: [link({ ends_at: "2026-10-13T12:00:05Z" })] }],
    });
    await getPublicProfile("ethan");
    expect(cacheLife).toHaveBeenCalledWith(
      expect.objectContaining({ revalidate: 60 }),
    );
  });

  it("handles a page with no links", async () => {
    db = fakeClient({ profiles: [{ data: profile }], links: [{ data: null }] });
    expect((await getPublicProfile("ethan"))?.links).toEqual([]);
  });
});
