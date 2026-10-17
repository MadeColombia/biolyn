import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { homePath } from "@/i18n/locale";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Skeleton } from "@/components/ui";
import { SocialIcon } from "@/components/social-icon";
import { FONT_PAGE_CLASS } from "@/components/profile-fonts";
import { RichBio } from "@/components/rich-bio";
import { cleanBio, parseBio, plainBio } from "@/lib/rich-bio";
import { getPublicProfile } from "@/lib/profiles";
import { SOCIAL_PLATFORMS } from "@/lib/socials";
import { motionOf, THEMES } from "@/lib/themes";
import { ThemeMotion } from "@/components/theme-motion";
import { CORNER_CLASSES } from "@/lib/corners";
import { isIconPreview } from "@/lib/link-form";
import { CoverPhoto } from "./cover-photo";
import { Gallery } from "./gallery";
import { ShareButton } from "./share-button";
import { ViewTracker } from "./view-tracker";

// Heights the Spotify and Apple Music players are designed for.
const PLAYER_HEIGHT = {
  spotify: { short: "h-[152px]", tall: "h-[352px]" },
  apple: { short: "h-[175px]", tall: "h-[450px]" },
};

export async function generateMetadata(
  props: PageProps<"/[locale]/[username]">,
): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) return { title: "biolyn" };
  const title = `${profile.display_name ?? profile.username} | biolyn`;
  const description = plainBio(parseBio(profile.bio), " ").trim() || undefined;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ProfilePage(
  props: PageProps<"/[locale]/[username]">,
) {
  const t = await getTranslations("profile");
  return (
    <Suspense
      fallback={
        // The owner's theme isn't known yet, so this uses the design
        // system's neutral canvas instead.
        <main
          aria-busy="true"
          className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-16"
        >
          <p className="sr-only">{t("loading")}</p>
          <Skeleton className="h-32 w-32 rounded-full" />
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

async function Profile({
  params,
}: Pick<PageProps<"/[locale]/[username]">, "params">) {
  const t = await getTranslations();
  const locale = await getLocale();
  const { username } = await params;
  const profile = await getPublicProfile(username.toLowerCase());
  if (!profile) notFound();

  const name = profile.display_name ?? profile.username;
  const theme = THEMES[profile.theme];
  const socials = SOCIAL_PLATFORMS.filter((p) => profile.socials[p.id]);
  // Cover needs a picture; without one the page keeps the round letter.
  const cover = profile.photo_style === "cover" && Boolean(profile.avatar_url);

  return (
    <main
      className={`flex flex-1 flex-col ${theme.page} ${FONT_PAGE_CLASS[profile.font]}`}
    >
      <ViewTracker profileId={profile.id} />
      {/* Wide screens show the page as a card on a tinted backdrop (a
          cover photo's straight sides line up with the card's edges).
          Phones stay edge to edge. */}
      <div
        className={`flex flex-1 flex-col md:px-6 md:py-10 ${theme.backdrop}`}
      >
        <div
          // isolate keeps a moving background above the card's own color;
          // clip (not hidden) lets that background stick while scrolling,
          // and keeps the cover photo's scroll animation tied to the page.
          className={`relative isolate mx-auto flex w-full flex-1 flex-col overflow-clip md:max-w-xl md:rounded-[2rem] md:shadow-2xl ${theme.page}`}
        >
          <ThemeMotion motion={motionOf(profile.theme)} />
          <ShareButton
            username={profile.username}
            name={name}
            avatarUrl={profile.avatar_url}
            onPhoto={cover}
          />
          {cover && <CoverPhoto src={profile.avatar_url!} alt={name} />}
          <div
            className={`mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 pb-16 md:max-w-none md:px-10 ${
              // The name and bio sit over the faded bottom of the photo.
              cover ? "relative -mt-28" : "pt-16"
            }`}
          >
            {cover ? null : profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-32 w-32 rounded-full object-cover md:h-40 md:w-40"
              />
            ) : (
              <div
                className={`flex h-32 w-32 items-center justify-center rounded-full text-4xl font-bold md:h-40 md:w-40 md:text-5xl ${theme.avatar}`}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-center">
              <h1 className={`font-bold ${cover ? "text-3xl" : "text-2xl"}`}>
                {name}
              </h1>
              {profile.bio && (
                <p className={`mt-1 break-words ${theme.muted}`}>
                  <RichBio nodes={cleanBio(parseBio(profile.bio))} />
                </p>
              )}
            </div>
            {socials.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-4">
                {socials.map((p) => (
                  <li key={p.id}>
                    <a
                      href={profile.socials[p.id]}
                      aria-label={t(`socials.${p.id}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block opacity-90 transition hover:opacity-100 motion-safe:hover:scale-110 motion-safe:focus-visible:scale-110"
                    >
                      <SocialIcon id={p.id} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {/* Extra space above the blocks sets the profile apart. */}
            <ul className="mt-6 flex w-full flex-col gap-3 md:mt-10">
              {profile.items.map((link) => (
                <li key={link.id}>
                  {link.kind === "gallery" ? (
                    <Gallery
                      title={link.title}
                      layout={link.layout}
                      photos={link.photos}
                      corners={profile.corners}
                    />
                  ) : link.embed ? (
                    // The player draws its own rounded corners. Clipping
                    // it to the block shape keeps every block square-cut
                    // when the owner picks Square.
                    <div
                      className={`w-full overflow-hidden ${CORNER_CLASSES[profile.corners].block} ${theme.embed} ${
                        link.embed.kind === "youtube"
                          ? "aspect-video"
                          : PLAYER_HEIGHT[link.embed.kind][
                              link.embed.tall ? "tall" : "short"
                            ]
                      }`}
                    >
                      <iframe
                        src={link.embed.src}
                        title={link.title}
                        loading="lazy"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                        className="size-full border-0"
                      />
                    </div>
                  ) : link.size === "big" ? (
                    <a
                      href={`/api/click/${link.id}`}
                      className={`block w-full overflow-hidden p-4 text-center font-semibold transition ${CORNER_CLASSES[profile.corners].block} ${theme.card}`}
                    >
                      {link.image_url && isIconPreview(link.image_url) ? (
                        // The site's icon, centered on a tinted panel.
                        <span
                          className={`flex aspect-video w-full items-center justify-center ${CORNER_CLASSES[profile.corners].inner} ${theme.avatar}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={link.image_url}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-1/2 w-auto max-w-1/2 object-contain"
                          />
                        </span>
                      ) : (
                        link.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={link.image_url}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className={`aspect-video w-full object-cover ${CORNER_CLASSES[profile.corners].inner}`}
                          />
                        )
                      )}
                      <span
                        className={`block px-4 text-lg ${link.image_url ? "py-4" : "py-8"}`}
                      >
                        {link.title}
                      </span>
                    </a>
                  ) : (
                    <a
                      href={`/api/click/${link.id}`}
                      className={`block w-full px-4 py-4 text-center font-medium transition ${CORNER_CLASSES[profile.corners].block} ${theme.button}`}
                    >
                      {link.title}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col items-center gap-2 pt-8 text-sm">
              {/* The biolyn ring takes visitors to the homepage. */}
              <Link
                href={homePath(locale)}
                className="inline-flex items-center gap-2 rounded-full border border-current/15 bg-current/5 py-2 pr-3.5 pl-2.5 font-semibold transition hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                <svg viewBox="0 0 64 64" width={18} height={18} aria-hidden>
                  <circle
                    cx="32"
                    cy="32"
                    r="23"
                    fill="none"
                    strokeWidth="14"
                    className="stroke-brand"
                  />
                </svg>
                {t("profile.madeWith")}
              </Link>
              <div
                className={`flex flex-wrap items-center justify-center gap-x-4 ${theme.muted}`}
              >
                <Link href={`/report/${profile.username}`} rel="nofollow">
                  {t("profile.report")}
                </Link>
                <span aria-hidden>·</span>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
