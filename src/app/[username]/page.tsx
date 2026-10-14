import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { SocialIcon } from "@/components/social-icon";
import { getPublicProfile } from "@/lib/profiles";
import { SOCIAL_PLATFORMS } from "@/lib/socials";
import { THEMES } from "@/lib/themes";
import { ViewTracker } from "./view-tracker";

export async function generateMetadata(
  props: PageProps<"/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return { title: "biolyn" };
  const title = `${profile.display_name ?? profile.username} | biolyn`;
  return {
    title,
    description: profile.bio ?? undefined,
    openGraph: { title, description: profile.bio ?? undefined },
  };
}

export default function ProfilePage(props: PageProps<"/[username]">) {
  return (
    <Suspense
      fallback={
        // The owner's theme isn't known yet, so this uses the design
        // system's neutral canvas instead.
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-16"
        >
          <p className="sr-only">Loading this page...</p>
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-7 w-44 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-xl" />
          <div className="flex w-full flex-col gap-3 pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        </main>
      }
    >
      <Profile params={props.params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/[username]">, "params">) {
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) notFound();

  const name = profile.display_name ?? profile.username;
  const theme = THEMES[profile.theme];
  const socials = SOCIAL_PLATFORMS.filter((p) => profile.socials[p.id]);

  return (
    <main className={`flex flex-1 flex-col ${theme.page}`}>
      <ViewTracker profileId={profile.id} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-16">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={name}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${theme.avatar}`}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{name}</h1>
          {profile.bio && (
            <p className={`mt-1 ${theme.muted}`}>{profile.bio}</p>
          )}
        </div>
        {socials.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-4">
            {socials.map((p) => (
              <li key={p.id}>
                <a
                  href={profile.socials[p.id]}
                  aria-label={p.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block opacity-90 transition hover:opacity-100"
                >
                  <SocialIcon id={p.id} />
                </a>
              </li>
            ))}
          </ul>
        )}
        <ul className="flex w-full flex-col gap-3">
          {profile.links.map((link) => (
            <li key={link.id}>
              {link.embed ? (
                <iframe
                  src={link.embed.src}
                  title={link.title}
                  loading="lazy"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  className={`w-full rounded-xl border-0 ${
                    link.embed.kind === "youtube"
                      ? "aspect-video"
                      : link.embed.tall
                        ? "h-[352px]"
                        : "h-[152px]"
                  }`}
                />
              ) : (
                <a
                  href={`/api/click/${link.id}`}
                  className={`block w-full rounded-xl px-4 py-4 text-center font-medium transition ${theme.button}`}
                >
                  {link.title}
                </a>
              )}
            </li>
          ))}
        </ul>
        <div
          className={`mt-auto flex items-center gap-4 pt-8 text-sm ${theme.muted}`}
        >
          <Link href="/">Made with biolyn</Link>
          <span aria-hidden>·</span>
          <Link href={`/report/${profile.username}`} rel="nofollow">
            Report
          </Link>
        </div>
      </div>
    </main>
  );
}
