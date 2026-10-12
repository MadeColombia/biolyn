import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profiles";

export async function generateMetadata(
  props: PageProps<"/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return { title: "Biolyn" };
  return {
    title: `${profile.display_name ?? profile.username} | Biolyn`,
    description: profile.bio ?? undefined,
  };
}

export default function ProfilePage(props: PageProps<"/[username]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-16">
      <Suspense fallback={<div className="h-24 w-24 rounded-full bg-neutral-200" />}>
        <Profile params={props.params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<PageProps<"/[username]">, "params">) {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) notFound();

  const name = profile.display_name ?? profile.username;

  return (
    <>
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt={name}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-200 text-3xl font-bold text-neutral-600">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <h1 className="text-2xl font-bold">{name}</h1>
        {profile.bio && (
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {profile.bio}
          </p>
        )}
      </div>
      <ul className="flex w-full flex-col gap-3">
        {profile.links.map((link) => (
          <li key={link.id}>
            <a
              href={`/api/click/${link.id}`}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-4 text-center font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {link.title}
            </a>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-8 text-sm text-neutral-500">
        Made with Biolyn
      </Link>
    </>
  );
}
