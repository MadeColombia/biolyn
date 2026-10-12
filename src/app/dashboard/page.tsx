import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deleteLink,
  moveLink,
  signOut,
  toggleLink,
  updateProfile,
} from "./actions";
import { AddLinkForm, ClaimUsernameForm } from "./forms";

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
    .select("id, username, display_name, bio")
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
        <ul className="flex flex-col gap-2">
          {(links ?? []).map((link, i) => (
            <li
              key={link.id}
              className={`flex items-center gap-2 rounded-lg border p-3 ${link.is_visible ? "" : "opacity-50"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{link.title}</p>
                <p className="truncate text-sm text-neutral-500">{link.url}</p>
              </div>
              <form action={moveLink.bind(null, link.id, -1)}>
                <button disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
              </form>
              <form action={moveLink.bind(null, link.id, 1)}>
                <button
                  disabled={i === (links ?? []).length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </form>
              <form action={toggleLink.bind(null, link.id, link.is_visible)}>
                <button className="text-sm underline">
                  {link.is_visible ? "Hide" : "Show"}
                </button>
              </form>
              <form action={deleteLink.bind(null, link.id)}>
                <button className="text-sm text-red-600 underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
