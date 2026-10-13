import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { socialsFrom } from "@/lib/socials";
import { THEMES, themeFrom, type ThemeId } from "@/lib/themes";
import { setTheme, signOut, updateProfile } from "./actions";
import {
  AddLinkForm,
  AvatarUpload,
  ClaimUsernameForm,
  SocialsForm,
} from "./forms";
import { LinkList } from "./link-list";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-12">
      <Suspense fallback={<p>Loading your links...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

// Reads the session cookie, so it must render inside <Suspense>.
async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, theme, socials")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Pick your username</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          This becomes your link, for example biolyn.link/yourname.
        </p>
        <ClaimUsernameForm />
      </section>
    );
  }

  const { data: links } = await supabase
    .from("links")
    .select("id, title, url, is_visible")
    .eq("profile_id", profile.id)
    .order("position");

  const currentTheme = themeFrom(profile.theme);

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Biolyn</h1>
          <Link
            href={`/${profile.username}`}
            target="_blank"
            className="text-sm text-neutral-500 underline"
          >
            biolyn.link/{profile.username}
          </Link>
        </div>
        <form action={signOut}>
          <button className="text-sm text-neutral-500 underline">
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Profile</h2>
        <AvatarUpload
          userId={user.id}
          avatarUrl={profile.avatar_url}
          name={profile.display_name ?? profile.username}
        />
        <form action={updateProfile} className="flex flex-col gap-2">
          <input
            name="display_name"
            defaultValue={profile.display_name ?? ""}
            placeholder="Display name"
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <textarea
            name="bio"
            defaultValue={profile.bio ?? ""}
            placeholder="Short bio (160 characters)"
            maxLength={160}
            className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="self-start rounded-lg border px-4 py-2">
            Save profile
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Links</h2>
        <AddLinkForm />
        <LinkList
          key={(links ?? []).map((l) => `${l.id}:${l.is_visible}`).join()}
          links={links ?? []}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Socials</h2>
        <SocialsForm socials={socialsFrom(profile.socials)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Theme</h2>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <form key={id} action={setTheme.bind(null, id)}>
              <button
                aria-pressed={id === currentTheme}
                className={`flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl text-sm font-medium ${THEMES[id].page} ${id === currentTheme ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
              >
                <span
                  className={`h-3 w-3/4 rounded ${THEMES[id].button}`}
                />
                {THEMES[id].label}
              </button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
