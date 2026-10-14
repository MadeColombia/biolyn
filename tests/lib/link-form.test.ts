import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isIconPreview,
  isLinkSize,
  isOwnLinkImage,
  linkImagePath,
  parseLinkForm,
} from "@/lib/link-form";

const IMAGES = "https://x.supabase.co/storage/v1/object/public/link-images/";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("isLinkSize", () => {
  it.each(["small", "big"])("accepts %s", (v) => {
    expect(isLinkSize(v)).toBe(true);
  });
  it.each([undefined, null, "", "huge", 1])("rejects %s", (v) => {
    expect(isLinkSize(v)).toBe(false);
  });
});

describe("isIconPreview", () => {
  it("spots previews marked as site icons", () => {
    expect(isIconPreview("https://a.com/i.svg#biolyn-icon")).toBe(true);
    expect(isIconPreview("https://a.com/og.jpg")).toBe(false);
    expect(isIconPreview(null)).toBe(false);
  });
});

describe("linkImagePath", () => {
  it("returns the storage path of our own pictures", () => {
    expect(linkImagePath(`${IMAGES}u1/a.jpg`)).toBe("u1/a.jpg");
  });
  it.each([null, "", "https://elsewhere.com/a.jpg"])("ignores %s", (v) => {
    expect(linkImagePath(v)).toBeNull();
  });
});

describe("isOwnLinkImage", () => {
  it("only accepts pictures in the user's folder", () => {
    expect(isOwnLinkImage(`${IMAGES}u1/a.jpg`, "u1")).toBe(true);
    expect(isOwnLinkImage(`${IMAGES}u2/a.jpg`, "u1")).toBe(false);
    expect(isOwnLinkImage(`${IMAGES}u10/a.jpg`, "u1")).toBe(false);
    expect(isOwnLinkImage("https://elsewhere.com/u1/a.jpg", "u1")).toBe(false);
  });
});

describe("parseLinkForm", () => {
  it("needs a title and a URL", () => {
    expect(parseLinkForm(form({ title: " ", url: "x" }))).toEqual({
      error: "Add a title and a URL.",
    });
  });

  it("caps the title length", () => {
    expect(
      parseLinkForm(form({ title: "a".repeat(81), url: "https://a.com" })),
    ).toEqual({ error: "Keep the title under 80 characters." });
  });

  it("refuses an end time before the start time", () => {
    expect(
      parseLinkForm(
        form({
          title: "x",
          url: "a.com",
          starts_at: "2026-10-14T10:00:00Z",
          ends_at: "2026-10-14T10:00:00Z",
        }),
      ),
    ).toEqual({ error: "The end time must be after the start time." });
  });

  it("fills in defaults", () => {
    expect(parseLinkForm(form({ title: " Shop ", url: "a.com" }))).toEqual({
      values: {
        title: "Shop",
        url: "https://a.com",
        embed: false,
        size: "small",
        image_url: null,
        starts_at: null,
        ends_at: null,
      },
    });
  });

  it("reads size, picture, player and schedule", () => {
    expect(
      parseLinkForm(
        form({
          title: "Video",
          url: "https://youtu.be/dQw4w9WgXcQ",
          embed: "on",
          size: "big",
          image_url: `${IMAGES}u1/a.jpg`,
          ends_at: "2026-10-14T10:00:00Z",
        }),
      ),
    ).toEqual({
      values: {
        title: "Video",
        url: "https://youtu.be/dQw4w9WgXcQ",
        embed: true,
        size: "big",
        image_url: `${IMAGES}u1/a.jpg`,
        starts_at: null,
        ends_at: "2026-10-14T10:00:00.000Z",
      },
    });
  });

  it("treats an unknown size as small", () => {
    const parsed = parseLinkForm(
      form({ title: "x", url: "a.com", size: "huge" }),
    );
    expect(parsed).toMatchObject({ values: { size: "small" } });
  });
});
