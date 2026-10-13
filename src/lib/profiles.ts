import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { socialsFrom, type Socials } from "@/lib/socials";
import { themeFrom, type ThemeId } from "@/lib/themes";

export type PublicLink = { id: string; title: string; url: string };
export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: ThemeId;
  socials: Socials;
  links: PublicLink[];
};

export const profileTag = (username: string) => `profile:${username}`;

// Cached on the server per username. The dashboard calls updateTag()
// after every edit so the public page refreshes right away. "hours" means
// changes made outside the app (like suspending a page in Supabase) show
// up within about an hour.
export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  "use cache";
  cacheTag(profileTag(username));
  cacheLife("hours");

  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, theme, socials, is_suspended",
    )
    .eq("username", username)
    .maybeSingle();

  // Suspended pages look like they don't exist.
  if (!profile || profile.is_suspended) return null;

  const { data: links } = await supabase
    .from("links")
    .select("id, title, url")
    .eq("profile_id", profile.id)
    .eq("is_visible", true)
    .order("position");

  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    theme: themeFrom(profile.theme),
    socials: socialsFrom(profile.socials),
    links: links ?? [],
  };
}
