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
            link({ id: "e", size: "big", image_url: "https://img/a.jpg" }),
            link({ id: "f", size: "huge" }),
            link({ id: "g", size: "big", preview_url: "https://og/x.jpg" }),
          ],
        },
      ],
    });
    const page = await getPublicProfile("ethan");
    expect(page?.links.map((l) => l.id)).toEqual(["a", "d", "e", "f", "g"]);
    expect(page?.links[0]).toMatchObject({ size: "small", image_url: null });
    expect(page?.links[2]).toMatchObject({
      size: "big",
      image_url: "https://img/a.jpg",
    });
    // Unknown sizes fall back to the small button.
    expect(page?.links[3].size).toBe("small");
    // Without an uploaded picture, the page's preview is used.
    expect(page?.links[4].image_url).toBe("https://og/x.jpg");
    expect(page?.links[0].embed).toBeNull();
    expect(page?.links[1].embed?.kind).toBe("youtube");
    expect(page?.theme).toBe("midnight");
    expect(page?.photo_style).toBe("round");
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
    const page = await getPublicProfile("ethan");
    expect(page?.links).toEqual([]);
    expect(page?.gallery).toEqual({ layout: "carousel", photos: [] });
  });

  it("returns the gallery with only photos from the photos bucket", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const bucket = "https://x.supabase.co/storage/v1/object/public/photos/";
    db = fakeClient({
      profiles: [{ data: { ...profile, gallery_layout: "grid" } }],
      links: [{ data: [] }],
      photos: [
        {
          data: [
            { id: "a", url: `${bucket}u1/a.jpg`, alt: "Dog" },
            { id: "b", url: "https://tracker.example/pixel.gif", alt: "" },
            { id: "c", url: `${bucket}u1/c.jpg`, alt: null },
          ],
        },
      ],
    });
    const page = await getPublicProfile("ethan");
    expect(page?.gallery).toEqual({
      layout: "grid",
      photos: [
        { id: "a", url: `${bucket}u1/a.jpg`, alt: "Dog" },
        { id: "c", url: `${bucket}u1/c.jpg`, alt: "" },
      ],
    });
    expect(db.queries.photos[0].calls).toContainEqual({
      method: "order",
      args: ["position"],
    });
  });
});
