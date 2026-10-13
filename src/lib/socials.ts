// Social platforms shown as an icon row on the public page.
// Users can type a handle (@ethan) or paste a full URL.
export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", base: "https://instagram.com/" },
  { id: "tiktok", label: "TikTok", base: "https://tiktok.com/@" },
  { id: "x", label: "X", base: "https://x.com/" },
  { id: "youtube", label: "YouTube", base: "https://youtube.com/@" },
  { id: "github", label: "GitHub", base: "https://github.com/" },
  { id: "email", label: "Email", base: "mailto:" },
] as const;

export type SocialId = (typeof SOCIAL_PLATFORMS)[number]["id"];
export type Socials = Partial<Record<SocialId, string>>;

const HANDLE = /^[A-Za-z0-9_.-]{1,50}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Turns what the user typed into a link, or returns an error message.
// Empty input returns { url: null }, which means "remove this platform".
export function normalizeSocial(
  id: SocialId,
  raw: string,
): { url: string | null } | { error: string } {
  const value = raw.trim();
  if (!value) return { url: null };
  const platform = SOCIAL_PLATFORMS.find((p) => p.id === id)!;

  if (id === "email") {
    const email = value.replace(/^mailto:/i, "");
    return EMAIL.test(email)
      ? { url: `mailto:${email}` }
      : { error: `${platform.label}: that email doesn't look right.` };
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      new URL(value);
      return { url: value };
    } catch {
      return { error: `${platform.label}: that URL doesn't look right.` };
    }
  }

  const handle = value.replace(/^@/, "");
  return HANDLE.test(handle)
    ? { url: platform.base + handle }
    : { error: `${platform.label}: use a handle like @name or a full URL.` };
}

// Reads the jsonb column safely, keeping only known platforms with safe URLs.
export function socialsFrom(value: unknown): Socials {
  const out: Socials = {};
  if (!value || typeof value !== "object") return out;
  for (const { id } of SOCIAL_PLATFORMS) {
    const url = (value as Record<string, unknown>)[id];
    if (typeof url === "string" && /^(https?:\/\/|mailto:)/i.test(url)) {
      out[id] = url;
    }
  }
  return out;
}

// Shows a stored URL back as the short form the user typed.
export function displaySocial(id: SocialId, url: string | undefined) {
  if (!url) return "";
  const platform = SOCIAL_PLATFORMS.find((p) => p.id === id)!;
  return url.startsWith(platform.base)
    ? (id === "email" ? "" : "@") + url.slice(platform.base.length)
    : url;
}
