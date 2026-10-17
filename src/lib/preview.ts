/**
 * The dashboard shows the owner's real public page in a frame. These
 * helpers decide when that frame reloads and tell the page it is a preview.
 */

/** Marks the public page as the dashboard's preview (?preview=...). */
export const PREVIEW_PARAM = "preview";

/**
 * A short code that changes whenever anything on the page changes, so the
 * preview reloads after a save and stays put otherwise (switching tabs).
 */
export function previewVersion(value: unknown): string {
  // FNV-1a over the JSON. Not for security, only to notice changes.
  const text = JSON.stringify(value) ?? "";
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** The address the preview frame loads. */
export function previewSrc(username: string, version: string) {
  return `/${username}?${PREVIEW_PARAM}=${encodeURIComponent(version)}`;
}

/** Whether a page address (its ?query part) is the dashboard's preview. */
export function isPreview(search: string | URLSearchParams) {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.has(PREVIEW_PARAM);
}
