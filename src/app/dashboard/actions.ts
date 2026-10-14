"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/usernames";
import { profileTag } from "@/lib/profiles";
import { supabaseEnv } from "@/lib/supabase/env";
import { normalizeSocial, SOCIAL_PLATFORMS, type Socials } from "@/lib/socials";
import { isThemeId } from "@/lib/themes";
import { checkLinkUrl } from "@/lib/link-safety";
import { allow } from "@/lib/rate-limit";
import {
  isIconPreview,
  isOwnLinkImage,
  LINK_IMAGES_BUCKET,
  linkImagePath,
  parseLinkForm,
  type LinkValues,
} from "@/lib/link-form";
import { fetchPreviewImage, fetchScreenshot } from "@/lib/link-preview";

const MAX_LINKS = 100;

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
  const parsed = parseLinkForm(formData);
  if ("error" in parsed) return parsed;
  const { values } = parsed;
  const unsafe = await checkLinkUrl(values.url);
  if (unsafe) return { error: unsafe };

  const { supabase, profile, user } = await requireOwnProfile();
  if (values.image_url && !isOwnLinkImage(values.image_url, user.id)) {
    return { error: PICTURE_ERROR };
  }
  if (!(await allow(`addlink:${profile.id}`, 30, 600))) {
    return { error: "You're adding links very fast. Wait a few minutes." };
  }
  const { count } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  if ((count ?? 0) >= MAX_LINKS) {
    return { error: `You can have up to ${MAX_LINKS} links.` };
  }

  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    position: count ?? 0,
    ...values,
    preview_url: await previewFor(supabase, user.id, values),
  });
  if (error) return { error: "Could not save the link." };

  refresh(profile.username);
  return {};
}

const PICTURE_ERROR = "Could not use that picture. Upload it again.";

// Changes one link in place: title, URL, size, picture, schedule and
// player setting. Its position, visibility and clicks stay as they are.
export async function updateLink(
  linkId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseLinkForm(formData);
  if ("error" in parsed) return parsed;
  const { values } = parsed;
  const unsafe = await checkLinkUrl(values.url);
  if (unsafe) return { error: unsafe };

  const { supabase, profile, user } = await requireOwnProfile();
  if (values.image_url && !isOwnLinkImage(values.image_url, user.id)) {
    return { error: PICTURE_ERROR };
  }
  const { data: current } = await supabase
    .from("links")
    .select("url, image_url, preview_url")
    .eq("id", linkId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!current) return { error: "That link no longer exists." };

  const preview_url = await previewFor(supabase, user.id, values, current);
  const { error } = await supabase
    .from("links")
    .update({ ...values, preview_url })
    .eq("id", linkId)
    .eq("profile_id", profile.id);
  if (error) return { error: "Could not save the link." };

  if (current.image_url !== values.image_url) {
    await removeLinkImage(supabase, current.image_url);
  }
  if (current.preview_url !== preview_url) {
    await removeLinkImage(supabase, current.preview_url);
  }
  refresh(profile.username);
  return { saved: true };
}

// A big button with no picture of its own shows the page's share picture,
// else a screenshot of the page (saved in the user's storage folder),
// else the site's icon. It's looked up once when the link is saved, and
// again when its URL changes, so visitors never wait for it.
async function previewFor(
  supabase: Supabase,
  userId: string,
  values: LinkValues,
  current?: { url: string; preview_url: string | null },
): Promise<string | null> {
  const known = current?.url === values.url ? current.preview_url : null;
  if (values.size !== "big" || values.image_url || known) return known;

  const found = await fetchPreviewImage(values.url);
  if (found && !isIconPreview(found)) return found;

  const shot = await fetchScreenshot(values.url);
  if (shot) {
    const ext = shot.type.split("/")[1];
    const path = `${userId}/preview-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(LINK_IMAGES_BUCKET)
      .upload(path, shot.data, { contentType: shot.type });
    if (!error) {
      return supabase.storage.from(LINK_IMAGES_BUCKET).getPublicUrl(path).data
        .publicUrl;
    }
  }
  return found;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Deletes a picture we host. Anything else (or nothing) is ignored.
async function removeLinkImage(
  supabase: Supabase,
  url: string | null,
) {
  const path = linkImagePath(url);
  if (path) await supabase.storage.from(LINK_IMAGES_BUCKET).remove([path]);
}

export async function toggleEmbed(linkId: string, embed: boolean) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase.from("links").update({ embed: !embed }).eq("id", linkId);
  refresh(profile.username);
}

export async function deleteLink(linkId: string) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: link } = await supabase
    .from("links")
    .select("image_url, preview_url")
    .eq("id", linkId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  await supabase.from("links").delete().eq("id", linkId);
  if (link) {
    await removeLinkImage(supabase, link.image_url);
    await removeLinkImage(supabase, link.preview_url);
  }
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
    if (result.url?.startsWith("http")) {
      const unsafe = await checkLinkUrl(result.url);
      if (unsafe) return { error: unsafe };
    }
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
