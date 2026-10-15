import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { socialsFrom, type Socials } from "@/lib/socials";
import {
  photoStyleFrom,
  themeFrom,
  type PhotoStyle,
  type ThemeId,
} from "@/lib/themes";
import { fontFrom, type FontId } from "@/lib/fonts";
import { cornerStyleFrom, type CornerStyle } from "@/lib/corners";
import { embedFor, type Embed } from "@/lib/embeds";
import { isLive, secondsUntilNextChange } from "@/lib/schedule";
import { isLinkSize, type LinkSize } from "@/lib/link-form";
import {
  galleryLayoutFrom,
  photoPrefix,
  type GalleryLayout,
} from "@/lib/gallery";

export type PublicLink = {
  kind: "link";
  id: string;
  title: string;
  url: string;
  embed: Embed | null;
  size: LinkSize;
  // The uploaded picture, else the page's own share picture.
  image_url: string | null;
};
export type PublicPhoto = { id: string; url: string; alt: string };
export type PublicGallery = {
  kind: "gallery";
  id: string;
  title: string;
  layout: GalleryLayout;
  photos: PublicPhoto[];
};
// Links and photo galleries share one list, in the owner's order.
export type PublicItem = PublicLink | PublicGallery;
export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: ThemeId;
  photo_style: PhotoStyle;
  font: FontId;
  corners: CornerStyle;
  socials: Socials;
  items: PublicItem[];
};

export const profileTag = (username: string) => `profile:${username}`;

// Cached on the server per username. The dashboard calls updateTag()
// after every edit so the public page refreshes right away. "hours" means
// changes made outside the app (like suspending a page in Supabase) show
// up within about an hour. When a scheduled link is about to appear or
// disappear, the cache refreshes around that moment instead.
export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  "use cache";
  cacheTag(profileTag(username));

  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, theme, socials, is_suspended",
    )
    .eq("username", username)
    .maybeSingle();

  // Suspended pages look like they don't exist.
  if (!profile || profile.is_suspended) {
    cacheLife("hours");
    return null;
  }

  const [{ data: rows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("links")
      .select(
        "id, kind, title, url, layout, embed, size, image_url, preview_url, starts_at, ends_at",
      )
      .eq("profile_id", profile.id)
      .eq("is_visible", true)
      .order("position"),
    supabase
      .from("photos")
      .select("id, link_id, url, alt")
      .eq("profile_id", profile.id)
      .order("position"),
  ]);

  const now = Date.now();
  const all = rows ?? [];
  const nextChange = secondsUntilNextChange(all, now);
  cacheLife({
    stale: 60,
    revalidate: Math.min(3600, Math.max(60, nextChange ?? 3600)),
    expire: 86400,
  });

  // Only files from our own photos bucket, even if a row was written
  // outside the app.
  const photos = (photoRows ?? []).filter((p) =>
    p.url.startsWith(photoPrefix()),
  );

  const items: PublicItem[] = all
    .filter((l) => isLive(l, now))
    .flatMap((l): PublicItem[] => {
      if (l.kind === "gallery") {
        const own = photos
          .filter((p) => p.link_id === l.id)
          .map((p) => ({ id: p.id, url: p.url, alt: p.alt ?? "" }));
        // An empty gallery shows nothing.
        if (own.length === 0) return [];
        return [
          {
            kind: "gallery",
            id: l.id,
            title: l.title,
            layout: galleryLayoutFrom(l.layout),
            photos: own,
          },
        ];
      }
      if (!l.url) return [];
      return [
        {
          kind: "link",
          id: l.id,
          title: l.title,
          url: l.url,
          embed: l.embed ? embedFor(l.url) : null,
          size: isLinkSize(l.size) ? l.size : "small",
          image_url: l.image_url ?? l.preview_url ?? null,
        },
      ];
    });

  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    theme: themeFrom(profile.theme),
    photo_style: photoStyleFrom(profile.theme),
    font: fontFrom(profile.theme),
    corners: cornerStyleFrom(profile.theme),
    socials: socialsFrom(profile.socials),
    items,
  };
}
