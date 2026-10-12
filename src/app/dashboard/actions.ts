"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/usernames";
import { profileTag } from "@/lib/profiles";

async function requireOwnProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  return { supabase, profile };
}

// Refresh both the dashboard and the cached public page.
function refresh(username: string) {
  updateTag(profileTag(username));
  revalidatePath("/dashboard");
}

export type FormState = { error?: string };

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

// Swap a link with its neighbour above (-1) or below (+1).
export async function moveLink(linkId: string, direction: -1 | 1) {
  const { supabase, profile } = await requireOwnProfile();
  const { data: links } = await supabase
    .from("links")
    .select("id")
    .eq("profile_id", profile.id)
    .order("position");
  if (!links) return;

  const index = links.findIndex((l) => l.id === linkId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= links.length) return;

  [links[index], links[target]] = [links[target], links[index]];
  await Promise.all(
    links.map((l, position) =>
      supabase.from("links").update({ position }).eq("id", l.id),
    ),
  );
  refresh(profile.username);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
