"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/usernames";
import { profileTag } from "@/lib/profiles";
import { supabaseEnv } from "@/lib/supabase/env";
import {
  normalizeSocial,
  SOCIAL_PLATFORMS,
  type Socials,
} from "@/lib/socials";
import { isThemeId } from "@/lib/themes";

async function requireOwnProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  return { supabase, profile, user };
}

// Refresh both the dashboard and the cached public page.
function refresh(username: string) {
  updateTag(profileTag(username));
  revalidatePath("/dashboard");
}

export type FormState = { error?: string; saved?: boolean };

export async function claimUsername(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = String(formData.get("username") ?? "");
  const error = validateUsername(raw);
  if (error) return { error };
  const username = raw.trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error: dbError } = await supabase
    .from("profiles")
    .insert({ user_id: user.id, username, display_name: username });

  if (dbError) {
    // 23505 is Postgres "unique violation": someone already has it.
    return {
      error:
        dbError.code === "23505"
          ? "That username is taken."
          : "Could not save. Try again.",
    };
  }

  refresh(username);
  return {};
}

export async function updateProfile(formData: FormData) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name") ?? "").slice(0, 60),
      bio: String(formData.get("bio") ?? "").slice(0, 160),
    })
    .eq("id", profile.id);
  refresh(profile.username);
}

export async function addLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (!title || !url) return { error: "Add a title and a URL." };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
  } catch {
    return { error: "That URL doesn't look right." };
  }

  const { supabase, profile } = await requireOwnProfile();
  const { count } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);

  const { error } = await supabase
    .from("links")
    .insert({ profile_id: profile.id, title, url, position: count ?? 0 });
  if (error) return { error: "Could not save the link." };

  refresh(profile.username);
  return {};
}

export async function deleteLink(linkId: string) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase.from("links").delete().eq("id", linkId);
  refresh(profile.username);
}

export async function toggleLink(linkId: string, isVisible: boolean) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("links")
    .update({ is_visible: !isVisible })
    .eq("id", linkId);
  refresh(profile.username);
}

// Saves a new order after a drag. `orderedIds` must contain exactly
// the user's own link ids, otherwise nothing changes.
export async function reorderLinks(orderedIds: string[]) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: links } = await supabase
    .from("links")
    .select("id")
    .eq("profile_id", profile.id);
  if (!links) return;

  const own = new Set(links.map((l) => l.id));
  if (
    orderedIds.length !== own.size ||
    new Set(orderedIds).size !== own.size ||
    !orderedIds.every((id) => own.has(id))
  ) {
    return;
  }

  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("links").update({ position }).eq("id", id),
    ),
  );
  refresh(profile.username);
}

export async function setTheme(themeId: string) {
  if (!isThemeId(themeId)) return;
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("profiles")
    .update({ theme: { preset: themeId } })
    .eq("id", profile.id);
  refresh(profile.username);
}

export async function updateSocials(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const socials: Socials = {};
  for (const { id } of SOCIAL_PLATFORMS) {
    const result = normalizeSocial(id, String(formData.get(id) ?? ""));
    if ("error" in result) return { error: result.error };
    if (result.url) socials[id] = result.url;
  }

  const { supabase, profile } = await requireOwnProfile();
  const { error } = await supabase
    .from("profiles")
    .update({ socials })
    .eq("id", profile.id);
  if (error) return { error: "Could not save. Try again." };

  refresh(profile.username);
  return { saved: true };
}

// Public URLs look like <supabase>/storage/v1/object/public/avatars/<path>.
function avatarPrefix() {
  return `${supabaseEnv().url}/storage/v1/object/public/avatars/`;
}

// Called after the browser uploads a picture to Storage. Only accepts a
// file inside the user's own folder, then removes the previous picture.
export async function setAvatar(url: string | null) {
  const { supabase, profile, user } = await requireOwnProfile();
  const prefix = avatarPrefix();
  if (url !== null && !url.startsWith(`${prefix}${user.id}/`)) return;

  await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", profile.id);

  const old = profile.avatar_url;
  if (old && old !== url && old.startsWith(prefix)) {
    await supabase.storage.from("avatars").remove([old.slice(prefix.length)]);
  }
  refresh(profile.username);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
