import { embedFor } from "@/lib/embeds";
import { supabaseEnv } from "@/lib/supabase/env";

export const LINK_SIZES = ["small", "big"] as const;
export type LinkSize = (typeof LINK_SIZES)[number];

export const LINK_IMAGES_BUCKET = "link-images";

// Marks a preview that is the site's icon rather than a share picture,
// so pages show it small and centered instead of cropped to fill the card.
export const ICON_MARK = "#biolyn-icon";

export function isIconPreview(url: string | null | undefined) {
  return Boolean(url?.endsWith(ICON_MARK));
}

export function isLinkSize(value: unknown): value is LinkSize {
  return value === "small" || value === "big";
}

// Public URLs look like <supabase>/storage/v1/object/public/link-images/<path>.
export function linkImagePrefix() {
  return `${supabaseEnv().url}/storage/v1/object/public/${LINK_IMAGES_BUCKET}/`;
}

/** The storage path of a picture we host, or null for anything else. */
export function linkImagePath(url: string | null): string | null {
  if (!url) return null;
  const prefix = linkImagePrefix();
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export type LinkValues = {
  title: string;
  url: string;
  embed: boolean;
  size: LinkSize;
  image_url: string | null;
  preview_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

function isoOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** True when `url` is a picture inside the user's own storage folder. */
export function isOwnLinkImage(url: string, userId: string) {
  return linkImagePath(url)?.startsWith(`${userId}/`) ?? false;
}

/**
 * A preview is either a picture on another site (https) or a screenshot
 * in the user's own storage folder.
 */
export function isAllowedPreview(url: string, userId: string) {
  if (linkImagePath(url)) return isOwnLinkImage(url, userId);
  return /^https:\/\/[^\s]+$/i.test(url) && url.length <= 2000;
}

/**
 * Reads the add and edit link forms. The URL still needs the safety
 * check, and the pictures the ownership checks, after this. Errors are
 * keys of "errors" messages.
 */
export function parseLinkForm(
  formData: FormData,
):
  | { error: "linkMissing" | "titleTooLong" | "endBeforeStart" }
  | { values: LinkValues } {
  const title = String(formData.get("title") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (!title || !url) return { error: "linkMissing" };
  if (title.length > 80) return { error: "titleTooLong" };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  // The form converts the optional schedule to ISO time in the browser,
  // so it matches the creator's own time zone.
  const starts_at = isoOrNull(formData.get("starts_at"));
  const ends_at = isoOrNull(formData.get("ends_at"));
  if (starts_at && ends_at && ends_at <= starts_at) {
    return { error: "endBeforeStart" };
  }

  const rawSize = formData.get("size");
  const size = isLinkSize(rawSize) ? rawSize : "small";

  return {
    values: {
      title,
      url,
      embed: formData.get("embed") === "on" && embedFor(url) !== null,
      size,
      image_url: String(formData.get("image_url") ?? "") || null,
      preview_url: String(formData.get("preview_url") ?? "") || null,
      starts_at,
      ends_at,
    },
  };
}
