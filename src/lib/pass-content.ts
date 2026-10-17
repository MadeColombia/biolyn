import "server-only";
import { appleConfig } from "@/lib/apple-pass";
import { googleConfig } from "@/lib/google-pass";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locale";
import { getPublicProfile } from "@/lib/profiles";
import { cardDesign, cardStyleFrom, cardVersion } from "@/lib/qr-card";
import { cleanSource, sourceUrl } from "@/lib/sources";
import { passId, type PassContent } from "@/lib/wallet";

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://biolyn.link";

/**
 * What a wallet pass for /api/wallet/.../<username>?style=&s= shows, plus
 * an id that changes when the pass would look different. Null when the
 * page does not exist (or is hidden).
 */
export async function passContentFor(
  username: string,
  params: URLSearchParams,
): Promise<{ content: PassContent; id: string } | null> {
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return null;
  const code = cleanSource(params.get("s"));
  const lang = params.get("lang");
  const pageUrl = `${siteUrl()}/${profile.username}`;
  const content: PassContent = {
    username: profile.username,
    name: profile.display_name?.trim() || profile.username,
    qrUrl: code ? sourceUrl(siteUrl(), profile.username, code) : pageUrl,
    pageUrl,
    avatarUrl: profile.avatar_url,
    style: cardStyleFrom(params.get("style")),
    theme: profile.theme,
    code,
    locale: isLocale(lang) ? lang : DEFAULT_LOCALE,
  };
  const version = cardVersion([
    content.name,
    content.avatarUrl,
    profile.theme,
    cardDesign(),
  ]);
  return { content, id: passId(content, version) };
}

/** Which wallet buttons to show: only the ones whose keys work. */
export function walletsOn() {
  return { apple: appleConfig() !== null, google: googleConfig() !== null };
}
