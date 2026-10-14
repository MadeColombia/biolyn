import { supabaseEnv } from "@/lib/supabase/env";

// Photo gallery rules shared by the dashboard and the public page.
export const MAX_PHOTOS = 12;
export const MAX_ALT_LENGTH = 120;

export const GALLERY_LAYOUTS = ["carousel", "grid"] as const;
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];

export function isGalleryLayout(value: unknown): value is GalleryLayout {
  return (
    typeof value === "string" &&
    (GALLERY_LAYOUTS as readonly string[]).includes(value)
  );
}

// profiles.gallery_layout; anything unexpected falls back to carousel.
export function galleryLayoutFrom(value: unknown): GalleryLayout {
  return isGalleryLayout(value) ? value : "carousel";
}

// Public URLs look like <supabase>/storage/v1/object/public/photos/<path>.
export function photoPrefix() {
  return `${supabaseEnv().url}/storage/v1/object/public/photos/`;
}

// Returns the file path inside the bucket ("<user_id>/<file>") when `url`
// is a photo in this user's own folder, otherwise null. Used before saving
// a URL and before deleting a file, so nobody can point at other files.
export function ownPhotoPath(url: string, userId: string): string | null {
  const prefix = photoPrefix();
  if (!url.startsWith(`${prefix}${userId}/`)) return null;
  const path = url.slice(prefix.length);
  // One folder level and a plain file name: no "..", no query string.
  if (!/^[^/]+\/[\w-]+\.(jpe?g|png|webp)$/i.test(path)) return null;
  return path;
}

export function cleanAlt(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ALT_LENGTH);
}
