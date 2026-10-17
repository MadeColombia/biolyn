// Text and divider blocks. Each is a row in public.links (kind "text" or
// "divider") that sits at the top level of the page, never in a section.
// Their options live in the row's settings column.
import { cleanBio, parseBio, sanitizeBio } from "@/lib/rich-bio";

export const MAX_TEXT_TITLE = 80;
export const TEXT_MAX_CHARS = 500; // What visitors see, tags not counted.
const TEXT_MAX_STORED = 2000; // Tags included; settings stay under 4 KB.

// line: a thin line across the page. space: just room between parts.
export const DIVIDER_STYLES = ["line", "space"] as const;
export type DividerStyle = (typeof DIVIDER_STYLES)[number];

export function isDividerStyle(value: unknown): value is DividerStyle {
  return (
    typeof value === "string" &&
    (DIVIDER_STYLES as readonly string[]).includes(value)
  );
}

const settingsOf = (settings: unknown): Record<string, unknown> =>
  typeof settings === "object" && settings !== null && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};

/** A divider's style from its row's settings. */
export function dividerStyleFrom(settings: unknown): DividerStyle {
  const style = settingsOf(settings).style;
  return isDividerStyle(style) ? style : "line";
}

/** A text block's paragraph as stored (formatted like the bio). */
export function textBodyText(settings: unknown): string {
  const body = settingsOf(settings).body;
  return typeof body === "string" ? body : "";
}

/** A text block's paragraph, cleaned for showing. */
export function textBodyFrom(settings: unknown) {
  return cleanBio(parseBio(textBodyText(settings)));
}

/**
 * Reads the add and edit text forms: an optional title and a paragraph
 * with the bio's formatting. One of them must be filled in. Errors are
 * keys of "errors" messages; textTooLong takes {max}.
 */
export function parseTextForm(formData: FormData):
  | { error: "textEmpty" | "titleTooLong" | "textTooLong" | "textTooFormatted" }
  | {
      values: { title: string | null; settings: { body: string } };
      links: string[];
    } {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length > MAX_TEXT_TITLE) return { error: "titleTooLong" };
  const body = sanitizeBio(String(formData.get("body") ?? ""), {
    maxChars: TEXT_MAX_CHARS,
    maxStored: TEXT_MAX_STORED,
  });
  if ("error" in body) {
    return {
      error: body.error === "bioTooLong" ? "textTooLong" : "textTooFormatted",
    };
  }
  if (!title && !body.bio) return { error: "textEmpty" };
  return {
    values: { title: title || null, settings: { body: body.bio } },
    links: body.links,
  };
}
