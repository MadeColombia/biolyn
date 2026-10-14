import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanAlt,
  galleryLayoutFrom,
  isGalleryLayout,
  MAX_ALT_LENGTH,
  ownPhotoPath,
  photoPrefix,
} from "@/lib/gallery";

const PHOTOS = "https://x.supabase.co/storage/v1/object/public/photos/";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("gallery layouts", () => {
  it.each(["carousel", "grid"])("accepts %s", (id) => {
    expect(isGalleryLayout(id)).toBe(true);
    expect(galleryLayoutFrom(id)).toBe(id);
  });

  it.each([null, undefined, "", "list", "toString", 3])(
    "falls back to carousel for %s",
    (value) => {
      expect(isGalleryLayout(value)).toBe(false);
      expect(galleryLayoutFrom(value)).toBe("carousel");
    },
  );
});

describe("ownPhotoPath", () => {
  it("builds the bucket prefix from the Supabase URL", () => {
    expect(photoPrefix()).toBe(PHOTOS);
  });

  it.each(["a.jpg", "b-1.jpeg", "c_2.png", "D.WEBP"])(
    "returns the path for %s in the user's folder",
    (file) => {
      expect(ownPhotoPath(`${PHOTOS}u1/${file}`, "u1")).toBe(`u1/${file}`);
    },
  );

  it.each([
    ["another user's folder", `${PHOTOS}u2/a.jpg`],
    ["a folder that only starts like the user id", `${PHOTOS}u10/a.jpg`],
    ["the avatars bucket", `${PHOTOS.replace("photos", "avatars")}u1/a.jpg`],
    ["an outside site", "https://evil.example/u1/a.jpg"],
    ["a nested folder", `${PHOTOS}u1/x/a.jpg`],
    ["a parent folder jump", `${PHOTOS}u1/../u2/a.jpg`],
    ["a query string", `${PHOTOS}u1/a.jpg?x=1`],
    ["a non-image file", `${PHOTOS}u1/a.svg`],
  ])("refuses %s", (_label, url) => {
    expect(ownPhotoPath(url, "u1")).toBeNull();
  });
});

describe("cleanAlt", () => {
  it("trims, squashes spaces and caps the length", () => {
    expect(cleanAlt("  my   dog\n at the beach ")).toBe("my dog at the beach");
    expect(cleanAlt("a".repeat(500))).toHaveLength(MAX_ALT_LENGTH);
    expect(cleanAlt(null)).toBe("");
  });
});
