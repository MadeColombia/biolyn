"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/usernames";
import { profileTag } from "@/lib/profiles";
import { supabaseEnv } from "@/lib/supabase/env";
import { normalizeSocial, SOCIAL_PLATFORMS, type Socials } from "@/lib/socials";
import { isPhotoStyle, isThemeId, themeSettings } from "@/lib/themes";
import { isFontId } from "@/lib/fonts";
import { isCornerStyle } from "@/lib/corners";
import { BIO_MAX_CHARS, sanitizeBio } from "@/lib/rich-bio";
import { checkLinkUrl } from "@/lib/link-safety";
import { allow } from "@/lib/rate-limit";
import {
  isAllowedPreview,
  isIconPreview,
  isOwnLinkImage,
  LINK_IMAGES_BUCKET,
  linkImagePath,
  parseLinkForm,
  type LinkValues,
} from "@/lib/link-form";
import { fetchPreviewImage, fetchScreenshot } from "@/lib/link-preview";
import {
  cleanAlt,
  isGalleryLayout,
  MAX_GALLERIES,
  MAX_PAGE_PHOTOS,
  MAX_PHOTOS,
  ownPhotoPath,
} from "@/lib/gallery";
import { MAX_SOURCES, parseSourceForm } from "@/lib/sources";
import {
  MAX_SECTION_LINKS,
  MAX_SECTIONS,
  parseSectionForm,
  planReorder,
  sectionIdFrom,
  type ItemTree,
} from "@/lib/sections";
import {
  DIVIDER_STYLES,
  isDividerStyle,
  parseTextForm,
  TEXT_MAX_CHARS,
} from "@/lib/blocks";
import { actionTranslator } from "@/i18n/server";

const MAX_LINKS = 100;

async function requireOwnProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, theme")
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
  const t = await actionTranslator();
  const raw = String(formData.get("username") ?? "");
  const error = validateUsername(raw);
  if (error) return { error: t(`errors.${error}`) };
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
          ? t("errors.usernameTaken")
          : t("errors.saveFailed"),
    };
  }

  refresh(username);
  return {};
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const bio = sanitizeBio(String(formData.get("bio") ?? ""));
  if ("error" in bio) {
    return { error: t(`errors.${bio.error}`, { max: BIO_MAX_CHARS }) };
  }
  for (const url of bio.links) {
    const unsafe = await checkLinkUrl(url);
    if (unsafe) {
      return {
        error: t("errors.bioLink", { problem: t(`errors.${unsafe}`) }),
      };
    }
  }

  const { supabase, profile } = await requireOwnProfile();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name") ?? "").slice(0, 60),
      bio: bio.bio,
    })
    .eq("id", profile.id);
  if (error) return { error: t("errors.saveFailed") };
  refresh(profile.username);
  return { saved: true };
}

export async function addLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const parsed = parseLinkForm(formData);
  if ("error" in parsed) return { error: t(`errors.${parsed.error}`) };
  const { values } = parsed;
  const unsafe = await checkLinkUrl(values.url);
  if (unsafe) return { error: t(`errors.${unsafe}`) };

  const { supabase, profile, user } = await requireOwnProfile();
  if (!picturesAllowed(values, user.id)) {
    return { error: t("errors.pictureFailed") };
  }
  if (!(await allow(`addlink:${profile.id}`, 30, 600))) {
    return { error: t("errors.linksTooFast") };
  }
  const { count } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  if ((count ?? 0) >= MAX_LINKS) {
    return { error: t("errors.maxLinks", { max: MAX_LINKS }) };
  }
  const sectionId = sectionIdFrom(formData);
  if (sectionId) {
    const problem = await sectionProblem(supabase, profile.id, sectionId);
    if (problem)
      return { error: t(`errors.${problem}`, { max: MAX_SECTION_LINKS }) };
  }

  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    position: count ?? 0,
    ...values,
    ...(sectionId && { parent_id: sectionId }),
  });
  if (error) return { error: t("errors.linkSaveFailed") };

  refresh(profile.username);
  return {};
}

function picturesAllowed(values: LinkValues, userId: string) {
  return (
    (!values.image_url || isOwnLinkImage(values.image_url, userId)) &&
    (!values.preview_url || isAllowedPreview(values.preview_url, userId))
  );
}

// Why a link can't go into this section, or null when it can. `linkId`
// is the link being moved, which doesn't count toward the limit.
async function sectionProblem(
  supabase: Supabase,
  profileId: string,
  sectionId: string,
  linkId?: string,
): Promise<"sectionGone" | "sectionFull" | null> {
  const { data: section } = await supabase
    .from("links")
    .select("id")
    .eq("id", sectionId)
    .eq("profile_id", profileId)
    .eq("kind", "section")
    .maybeSingle();
  if (!section) return "sectionGone";
  const { data: inside } = await supabase
    .from("links")
    .select("id")
    .eq("profile_id", profileId)
    .eq("parent_id", sectionId);
  const others = (inside ?? []).filter((l) => l.id !== linkId);
  return others.length >= MAX_SECTION_LINKS ? "sectionFull" : null;
}

// Changes one link in place: title, URL, size, picture, schedule, player
// setting and section. Its visibility and clicks stay as they are; a link
// that changes section goes to the end of the new one.
export async function updateLink(
  linkId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const parsed = parseLinkForm(formData);
  if ("error" in parsed) return { error: t(`errors.${parsed.error}`) };
  const { values } = parsed;
  const unsafe = await checkLinkUrl(values.url);
  if (unsafe) return { error: t(`errors.${unsafe}`) };

  const { supabase, profile, user } = await requireOwnProfile();
  if (!picturesAllowed(values, user.id)) {
    return { error: t("errors.pictureFailed") };
  }
  const { data: current } = await supabase
    .from("links")
    .select("url, image_url, preview_url, parent_id")
    .eq("id", linkId)
    .eq("profile_id", profile.id)
    .eq("kind", "link")
    .maybeSingle();
  if (!current) return { error: t("errors.linkGone") };

  // Forms without the section field leave the link where it is.
  let move = {};
  if (formData.has("section_id")) {
    const sectionId = sectionIdFrom(formData);
    if (sectionId !== (current.parent_id ?? null)) {
      if (sectionId) {
        const problem = await sectionProblem(
          supabase,
          profile.id,
          sectionId,
          linkId,
        );
        if (problem) {
          return { error: t(`errors.${problem}`, { max: MAX_SECTION_LINKS }) };
        }
      }
      const { count } = await supabase
        .from("links")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id);
      move = { parent_id: sectionId, position: count ?? 0 };
    }
  }

  const { error } = await supabase
    .from("links")
    .update({ ...values, ...move })
    .eq("id", linkId)
    .eq("profile_id", profile.id);
  if (error) return { error: t("errors.linkSaveFailed") };

  if (current.image_url !== values.image_url) {
    await removeLinkImage(supabase, current.image_url);
  }
  if (current.preview_url !== values.preview_url) {
    await removeLinkImage(supabase, current.preview_url);
  }
  refresh(profile.username);
  return { saved: true };
}

// Finds a picture for a big button when the user asks for one: the
// page's share picture, else a screenshot of the page (saved in the
// user's storage folder), else the site's icon. The form keeps the result
// and sends it back with the rest of the link when it's saved.
export async function loadPreview(
  rawUrl: string,
): Promise<{ preview_url?: string; error?: string }> {
  const t = await actionTranslator();
  let url = rawUrl.trim();
  if (!url) return { error: t("errors.previewNeedsUrl") };
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const unsafe = await checkLinkUrl(url);
  if (unsafe) return { error: t(`errors.${unsafe}`) };

  const { supabase, profile, user } = await requireOwnProfile();
  if (!(await allow(`preview:${profile.id}`, 20, 600))) {
    return { error: t("errors.previewsTooFast") };
  }
  const NONE = t("errors.noPreview");
  try {
    const found = await fetchPreviewImage(url);
    if (found && !isIconPreview(found)) return { preview_url: found };

    const shot = await fetchScreenshot(url);
    if (shot) {
      const ext = shot.type.split("/")[1];
      const path = `${user.id}/preview-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(LINK_IMAGES_BUCKET)
        .upload(path, shot.data, { contentType: shot.type });
      if (!error) {
        return {
          preview_url: supabase.storage
            .from(LINK_IMAGES_BUCKET)
            .getPublicUrl(path).data.publicUrl,
        };
      }
    }
    return found ? { preview_url: found } : { error: NONE };
  } catch {
    return { error: NONE };
  }
}

// Deletes a picture or screenshot the form made but no longer uses, as
// long as no saved link points at it.
export async function discardLinkImage(url: string) {
  const { supabase, user } = await requireOwnProfile();
  if (!isOwnLinkImage(url, user.id)) return;
  for (const column of ["image_url", "preview_url"]) {
    const { count } = await supabase
      .from("links")
      .select("id", { count: "exact", head: true })
      .eq(column, url);
    if (count !== 0) return;
  }
  await removeLinkImage(supabase, url);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Deletes a picture we host. Anything else (or nothing) is ignored.
async function removeLinkImage(supabase: Supabase, url: string | null) {
  const path = linkImagePath(url);
  if (path) await supabase.storage.from(LINK_IMAGES_BUCKET).remove([path]);
}

export async function toggleEmbed(linkId: string, embed: boolean) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase.from("links").update({ embed: !embed }).eq("id", linkId);
  refresh(profile.username);
}

export async function deleteLink(linkId: string) {
  const { supabase, profile, user } = await requireOwnProfile();
  const { data: link } = await supabase
    .from("links")
    .select("image_url, preview_url")
    .eq("id", linkId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  // A gallery's photo rows go with it (on delete cascade), so collect
  // their files first.
  const { data: photos } = await supabase
    .from("photos")
    .select("url")
    .eq("link_id", linkId)
    .eq("profile_id", profile.id);
  await supabase.from("links").delete().eq("id", linkId);
  if (link) {
    await removeLinkImage(supabase, link.image_url);
    await removeLinkImage(supabase, link.preview_url);
  }
  const paths = (photos ?? [])
    .map((p) => ownPhotoPath(p.url, user.id))
    .filter((p): p is string => p !== null);
  if (paths.length > 0) await supabase.storage.from("photos").remove(paths);
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

// Saves a new order after a drag: the top-level items in order, and the
// links inside each section. The tree must hold exactly the user's own
// items (see planReorder), otherwise nothing changes.
export async function reorderItems(tree: ItemTree) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: rows } = await supabase
    .from("links")
    .select("id, kind")
    .eq("profile_id", profile.id);
  if (!rows) return;
  const plan = planReorder(tree, rows);
  if (!plan) return;

  const save = (list: typeof plan) =>
    Promise.all(
      list.map(({ id, position, parent_id }) =>
        supabase
          .from("links")
          .update({ position, parent_id })
          .eq("id", id)
          .eq("profile_id", profile.id),
      ),
    );
  // Links leave their sections first, so a full section has room for
  // the ones moving in.
  await save(plan.filter((p) => p.parent_id === null));
  await save(plan.filter((p) => p.parent_id !== null));
  refresh(profile.username);
}

// Adds a section (a title with links under it) at the end of the page.
export async function addSection(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const parsed = parseSectionForm(formData);
  if ("error" in parsed) return { error: t(`errors.${parsed.error}`) };
  const { supabase, profile } = await requireOwnProfile();
  if (!(await allow(`addlink:${profile.id}`, 30, 600))) {
    return { error: t("errors.itemsTooFast") };
  }
  const { data: items } = await supabase
    .from("links")
    .select("kind")
    .eq("profile_id", profile.id);
  const all = items ?? [];
  if (all.length >= MAX_LINKS) {
    return { error: t("errors.maxItems", { max: MAX_LINKS }) };
  }
  if (all.filter((l) => l.kind === "section").length >= MAX_SECTIONS) {
    return { error: t("errors.maxSections", { max: MAX_SECTIONS }) };
  }

  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    kind: "section",
    ...parsed.values,
    position: all.length,
  });
  if (error) return { error: t("errors.sectionFailed") };

  refresh(profile.username);
  return {};
}

// Changes a section's title and style.
export async function updateSection(
  sectionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const parsed = parseSectionForm(formData);
  if ("error" in parsed) return { error: t(`errors.${parsed.error}`) };
  const { supabase, profile } = await requireOwnProfile();
  const { error } = await supabase
    .from("links")
    .update(parsed.values)
    .eq("id", sectionId)
    .eq("profile_id", profile.id)
    .eq("kind", "section");
  if (error) return { error: t("errors.sectionFailed") };
  refresh(profile.username);
  return { saved: true };
}

// Reads the text form and checks the links in its paragraph.
async function textValues(formData: FormData) {
  const t = await actionTranslator();
  const parsed = parseTextForm(formData);
  if ("error" in parsed) {
    return { error: t(`errors.${parsed.error}`, { max: TEXT_MAX_CHARS }) };
  }
  for (const url of parsed.links) {
    const unsafe = await checkLinkUrl(url);
    if (unsafe) {
      return {
        error: t("errors.textLink", { problem: t(`errors.${unsafe}`) }),
      };
    }
  }
  return { values: parsed.values };
}

// Room for one more block at the end of the page, or the reason why not.
async function nextPosition(supabase: Supabase, profileId: string) {
  const t = await actionTranslator();
  if (!(await allow(`addlink:${profileId}`, 30, 600))) {
    return { error: t("errors.itemsTooFast") };
  }
  const { count } = await supabase
    .from("links")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if ((count ?? 0) >= MAX_LINKS) {
    return { error: t("errors.maxItems", { max: MAX_LINKS }) };
  }
  return { position: count ?? 0 };
}

// Adds a text block (a title and a short paragraph) at the end.
export async function addText(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const text = await textValues(formData);
  if ("error" in text) return { error: text.error };
  const { supabase, profile } = await requireOwnProfile();
  const room = await nextPosition(supabase, profile.id);
  if ("error" in room) return { error: room.error };
  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    kind: "text",
    ...text.values,
    position: room.position,
  });
  if (error) return { error: t("errors.saveFailed") };
  refresh(profile.username);
  return {};
}

export async function updateText(
  textId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const text = await textValues(formData);
  if ("error" in text) return { error: text.error };
  const { supabase, profile } = await requireOwnProfile();
  const { error } = await supabase
    .from("links")
    .update(text.values)
    .eq("id", textId)
    .eq("profile_id", profile.id)
    .eq("kind", "text");
  if (error) return { error: t("errors.saveFailed") };
  refresh(profile.username);
  return { saved: true };
}

// Adds a divider (a line) at the end. Its style can be changed after.
export async function addDivider(): Promise<FormState> {
  const t = await actionTranslator();
  const { supabase, profile } = await requireOwnProfile();
  const room = await nextPosition(supabase, profile.id);
  if ("error" in room) return { error: room.error };
  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    kind: "divider",
    settings: { style: DIVIDER_STYLES[0] },
    position: room.position,
  });
  if (error) return { error: t("errors.saveFailed") };
  refresh(profile.username);
  return {};
}

export async function setDividerStyle(dividerId: string, style: string) {
  if (!isDividerStyle(style)) return;
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("links")
    .update({ settings: { style } })
    .eq("id", dividerId)
    .eq("profile_id", profile.id)
    .eq("kind", "divider");
  refresh(profile.username);
}

// Deletes a section. With `keepLinks` its links stay on the page, where
// the section was; otherwise they are deleted with it.
export async function deleteSection(sectionId: string, keepLinks: boolean) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: rows } = await supabase
    .from("links")
    .select("id, kind, parent_id, image_url, preview_url")
    .eq("profile_id", profile.id)
    .order("position");
  const all = rows ?? [];
  if (!all.some((r) => r.id === sectionId && r.kind === "section")) return;
  const inside = all.filter((r) => r.parent_id === sectionId);
  const insideIds = new Set(inside.map((r) => r.id));

  if (keepLinks) {
    const order = all
      .filter((r) => !r.parent_id)
      .flatMap((r) => (r.id === sectionId ? inside : [r]));
    await Promise.all(
      order.map((r, position) =>
        supabase
          .from("links")
          .update(
            insideIds.has(r.id) ? { position, parent_id: null } : { position },
          )
          .eq("id", r.id)
          .eq("profile_id", profile.id),
      ),
    );
  } else if (inside.length > 0) {
    await supabase
      .from("links")
      .delete()
      .eq("parent_id", sectionId)
      .eq("profile_id", profile.id);
    for (const link of inside) {
      await removeLinkImage(supabase, link.image_url);
      await removeLinkImage(supabase, link.preview_url);
    }
  }

  // Any link still inside falls back to the top level (on delete set
  // null), so nothing is lost if a step above failed.
  await supabase
    .from("links")
    .delete()
    .eq("id", sectionId)
    .eq("profile_id", profile.id);
  refresh(profile.username);
}

// profiles.theme holds every look setting ({preset, font, photo}), so
// each change keeps the others.
async function saveLook(change: Record<string, string>) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("profiles")
    .update({ theme: { ...themeSettings(profile.theme), ...change } })
    .eq("id", profile.id);
  refresh(profile.username);
}

export async function setTheme(themeId: string) {
  if (!isThemeId(themeId)) return;
  await saveLook({ preset: themeId });
}

// The font for the whole public page.
export async function setFont(fontId: string) {
  if (!isFontId(fontId)) return;
  await saveLook({ font: fontId });
}

export async function setPhotoStyle(style: string) {
  if (!isPhotoStyle(style)) return;
  await saveLook({ photo: style });
}

// How rounded the blocks on the public page are.
export async function setCorners(corners: string) {
  if (!isCornerStyle(corners)) return;
  await saveLook({ corners });
}

export async function updateSocials(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const socials: Socials = {};
  for (const { id } of SOCIAL_PLATFORMS) {
    const result = normalizeSocial(id, String(formData.get(id) ?? ""));
    if ("error" in result) {
      return {
        error: t(`errors.${result.error}`, { platform: t(`socials.${id}`) }),
      };
    }
    if (result.url?.startsWith("http")) {
      const unsafe = await checkLinkUrl(result.url);
      if (unsafe) return { error: t(`errors.${unsafe}`) };
    }
    if (result.url) socials[id] = result.url;
  }

  const { supabase, profile } = await requireOwnProfile();
  const { error } = await supabase
    .from("profiles")
    .update({ socials })
    .eq("id", profile.id);
  if (error) return { error: t("errors.saveFailed") };

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

// Adds an empty photo gallery at the end of the list. Its photos are
// added afterwards with addPhoto.
export async function addGallery(): Promise<FormState> {
  const t = await actionTranslator();
  const { supabase, profile } = await requireOwnProfile();
  if (!(await allow(`addlink:${profile.id}`, 30, 600))) {
    return { error: t("errors.itemsTooFast") };
  }
  const { data: items } = await supabase
    .from("links")
    .select("kind")
    .eq("profile_id", profile.id);
  const all = items ?? [];
  if (all.length >= MAX_LINKS) {
    return { error: t("errors.maxItems", { max: MAX_LINKS }) };
  }
  if (all.filter((l) => l.kind === "gallery").length >= MAX_GALLERIES) {
    return { error: t("errors.maxGalleries", { max: MAX_GALLERIES }) };
  }

  const { error } = await supabase.from("links").insert({
    profile_id: profile.id,
    title: t("photos.defaultTitle"),
    kind: "gallery",
    layout: "carousel",
    position: all.length,
  });
  if (error) return { error: t("errors.galleryFailed") };

  refresh(profile.username);
  return {};
}

// Called after the browser uploads a photo to Storage. Only accepts a file
// inside the user's own folder of the photos bucket, for one of the
// user's own galleries.
export async function addPhoto(
  galleryId: string,
  url: string,
  alt: string,
): Promise<FormState> {
  const t = await actionTranslator();
  const { supabase, profile, user } = await requireOwnProfile();
  const path = ownPhotoPath(url, user.id);
  if (!path) return { error: t("errors.photoFailed") };

  // Removes the uploaded file when it can't be saved, so it doesn't sit
  // in Storage with nothing pointing at it.
  const discard = async (error: string) => {
    await supabase.storage.from("photos").remove([path]);
    return { error };
  };

  const { data: gallery } = await supabase
    .from("links")
    .select("id")
    .eq("id", galleryId)
    .eq("profile_id", profile.id)
    .eq("kind", "gallery")
    .maybeSingle();
  if (!gallery) return discard(t("errors.galleryGone"));

  if (!(await allow(`addphoto:${profile.id}`, 30, 600))) {
    return discard(t("errors.photosTooFast"));
  }
  const { data: photos } = await supabase
    .from("photos")
    .select("link_id")
    .eq("profile_id", profile.id);
  const inGallery = (photos ?? []).filter((p) => p.link_id === galleryId);
  if (inGallery.length >= MAX_PHOTOS) {
    return discard(t("errors.maxGalleryPhotos", { max: MAX_PHOTOS }));
  }
  if ((photos ?? []).length >= MAX_PAGE_PHOTOS) {
    return discard(t("errors.maxPagePhotos", { max: MAX_PAGE_PHOTOS }));
  }

  const { error } = await supabase.from("photos").insert({
    profile_id: profile.id,
    link_id: galleryId,
    url,
    alt: cleanAlt(alt),
    position: inGallery.length,
  });
  if (error) return discard(t("errors.photoSaveFailed"));

  refresh(profile.username);
  return {};
}

export async function updatePhotoAlt(photoId: string, alt: string) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("photos")
    .update({ alt: cleanAlt(alt) })
    .eq("id", photoId)
    .eq("profile_id", profile.id);
  refresh(profile.username);
}

// Deletes the row, then the file, but only a file in the user's own folder.
export async function deletePhoto(photoId: string) {
  const { supabase, profile, user } = await requireOwnProfile();
  const { data: photo } = await supabase
    .from("photos")
    .select("id, url")
    .eq("id", photoId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!photo) return;

  await supabase.from("photos").delete().eq("id", photo.id);
  const path = ownPhotoPath(photo.url, user.id);
  if (path) await supabase.storage.from("photos").remove([path]);
  refresh(profile.username);
}

// Same rules as reorderLinks: `orderedIds` must be exactly the photo ids
// of one of the user's galleries, otherwise nothing changes.
export async function reorderPhotos(galleryId: string, orderedIds: string[]) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: photos } = await supabase
    .from("photos")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("link_id", galleryId);
  if (!photos) return;

  const own = new Set(photos.map((p) => p.id));
  if (
    orderedIds.length !== own.size ||
    new Set(orderedIds).size !== own.size ||
    !orderedIds.every((id) => own.has(id))
  ) {
    return;
  }

  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("photos").update({ position }).eq("id", id),
    ),
  );
  refresh(profile.username);
}

export async function setGalleryLayout(galleryId: string, layout: string) {
  if (!isGalleryLayout(layout)) return;
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("links")
    .update({ layout })
    .eq("id", galleryId)
    .eq("profile_id", profile.id)
    .eq("kind", "gallery");
  refresh(profile.username);
}

// Tracking links: a name ("TikTok") and the code in the address
// (?s=tiktok), made from the name. They only change the dashboard, not
// the public page.
export async function addSource(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await actionTranslator();
  const parsed = parseSourceForm(formData);
  if ("error" in parsed) return { error: t(`errors.${parsed.error}`) };
  const { supabase, profile } = await requireOwnProfile();

  const { count } = await supabase
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .is("deleted_at", null);
  if ((count ?? 0) >= MAX_SOURCES) {
    return { error: t("errors.maxSources", { max: MAX_SOURCES }) };
  }

  // Making a link with a deleted one's name brings it back, with its
  // history, instead of failing on the unique code.
  const { data: old } = await supabase
    .from("sources")
    .select("id, deleted_at")
    .eq("profile_id", profile.id)
    .eq("code", parsed.values.code)
    .maybeSingle();
  const { error } = old?.deleted_at
    ? await supabase
        .from("sources")
        .update({ label: parsed.values.label, deleted_at: null })
        .eq("id", old.id)
        .eq("profile_id", profile.id)
    : await supabase.from("sources").insert({
        profile_id: profile.id,
        label: parsed.values.label,
        code: parsed.values.code,
      });
  if (error) {
    // 23505: the unique (profile_id, code) rule.
    return {
      error:
        error.code === "23505"
          ? t("errors.sourceExists")
          : t("errors.sourceSaveFailed"),
    };
  }
  revalidatePath("/dashboard");
  return { saved: true };
}

// Hides the link instead of erasing it, so Analytics keeps its name for
// past visits. New visits through it stop counting as this source.
export async function deleteSource(sourceId: string) {
  const { supabase, profile } = await requireOwnProfile();
  await supabase
    .from("sources")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sourceId)
    .eq("profile_id", profile.id);
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
