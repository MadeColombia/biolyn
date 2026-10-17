import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Badge,
  Button,
  Card,
  Heading,
  PageShell,
  card,
  container,
  cx,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getAnalytics, summarize } from "@/lib/analytics";
import { ranked } from "@/lib/chart";
import { sourceNames as namesFor } from "@/lib/sources";
import { socialsFrom } from "@/lib/socials";
import { photoStyleFrom, THEMES, themeFrom, type ThemeId } from "@/lib/themes";
import { galleryLayoutFrom } from "@/lib/gallery";
import { cardDesign, cardVersion } from "@/lib/qr-card";
import { walletsOn } from "@/lib/pass-content";
import { setCorners, setFont, setTheme, signOut } from "./actions";
import { FONTS, fontFrom, type FontId } from "@/lib/fonts";
import {
  CORNERS,
  CORNER_CLASSES,
  cornerStyleFrom,
  type CornerStyle,
} from "@/lib/corners";
import { FONT_CLASS } from "@/components/profile-fonts";
import {
  AvatarUpload,
  ClaimUsernameForm,
  CopyLinkButton,
  ProfileForm,
  SocialsForm,
} from "./forms";
import { AddItemMenu } from "./add-item";
import { LinkList, type LinkItem, type ListItem } from "./link-list";
import { QrSection, StatsSection } from "./stats";
import { SourcesSection } from "./sources";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  return (
    <PageShell
      header={
        <form action={signOut}>
          <Button variant="ghost" size="sm">
            {t("signOut")}
          </Button>
        </form>
      }
    >
      <main
        className={cx(container("medium"), "flex flex-1 flex-col gap-4 py-12")}
      >
        <Suspense fallback={<DashboardLoading />}>
          <Dashboard />
        </Suspense>
      </main>
    </PageShell>
  );
}

// Card shaped placeholders, so the page doesn't jump when data arrives.
async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only">{t("loading")}</p>
      <div className="h-10 w-56 rounded-xl bg-raised motion-safe:animate-pulse" />
      <div className="h-16 rounded-3xl border border-edge bg-surface motion-safe:animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-48 rounded-3xl border border-edge bg-surface motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

/** Card title with an optional caption under it. */
function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Heading size="section">{title}</Heading>
      {children && <p className="text-sm text-ink-muted">{children}</p>}
    </div>
  );
}

// Reads the session cookie, so it must render inside <Suspense>.
async function Dashboard() {
  const t = await getTranslations("dashboard");
  const looks = await getTranslations("looks");
  const common = await getTranslations("common");
  const sourcesT = await getTranslations("sources");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_url, theme, socials, is_suspended",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Heading as="h1" size="title">
            {t("pickTitle")}
          </Heading>
          <p className="text-lg leading-relaxed text-ink-soft">
            {t("pickText")}
          </p>
        </div>
        <Card padding="md">
          <ClaimUsernameForm />
        </Card>
      </section>
    );
  }

  const { data: rows } = await supabase
    .from("links")
    .select(
      "id, kind, title, url, layout, is_visible, embed, size, image_url, preview_url, starts_at, ends_at",
    )
    .eq("profile_id", profile.id)
    .order("position");

  const { data: photos } = await supabase
    .from("photos")
    .select("id, link_id, url, alt")
    .eq("profile_id", profile.id)
    .order("position");

  // Galleries and links share one list, so they can be dragged in any order.
  const items: ListItem[] = (rows ?? []).map((row) =>
    row.kind === "gallery"
      ? {
          kind: "gallery" as const,
          id: row.id,
          title: row.title,
          is_visible: row.is_visible,
          layout: galleryLayoutFrom(row.layout),
          photos: (photos ?? [])
            .filter((p) => p.link_id === row.id)
            .map(({ id, url, alt }) => ({ id, url, alt })),
        }
      : { ...row, kind: "link" as const, url: row.url ?? "" },
  );
  const links = items.filter((i): i is LinkItem => i.kind === "link");

  const currentTheme = themeFrom(profile.theme);
  const currentFont = fontFrom(profile.theme);
  const currentCorners = cornerStyleFrom(profile.theme);
  // Every tracking link ever made: deleted ones still name past visits.
  const { data: allSources } = await supabase
    .from("sources")
    .select("id, code, label, deleted_at")
    .eq("profile_id", profile.id)
    .order("created_at");
  const sources = (allSources ?? []).filter((s) => !s.deleted_at);
  const analytics = await getAnalytics(
    supabase,
    profile.id,
    (allSources ?? []).map((s) => s.code),
  );
  const stats = summarize(analytics);
  const sourceNames = namesFor(allSources ?? [], (name) =>
    sourcesT("deleted", { name }),
  );
  const sourceViews = Object.fromEntries(
    ranked(analytics, "views", "channel", 30)
      .filter((r) => r.key.startsWith("s:"))
      .map((r) => [r.key.slice(2), r.count]),
  );
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://biolyn.link";
  const version = cardVersion([
    profile.avatar_url,
    profile.display_name,
    currentTheme,
    cardDesign(),
  ]);
  const wallets = walletsOn();

  return (
    <>
      {profile.is_suspended && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-3xl border border-danger bg-surface p-6 text-danger"
        >
          <p className="font-bold">{t("hiddenTitle")}</p>
          <p className="text-sm leading-relaxed">{t("hiddenText")}</p>
        </div>
      )}

      <header className="flex flex-col gap-4 pb-2">
        <Heading as="h1" size="title">
          {t("yourPage")}
        </Heading>
        <div
          className={cx(
            card({ padding: "none" }),
            "flex items-center gap-2 p-2",
          )}
        >
          <Link
            href={`/${profile.username}`}
            target="_blank"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-lg font-semibold transition hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="truncate">
              <span className="text-ink-muted">biolyn.link/</span>
              {profile.username}
            </span>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="shrink-0 text-ink-muted"
            >
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
            <span className="sr-only">{common("opensInNewTab")}</span>
          </Link>
          <CopyLinkButton url={`${siteUrl}/${profile.username}`} />
        </div>
      </header>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("profileTitle")}>{t("profileText")}</SectionTitle>
        <AvatarUpload
          userId={user.id}
          avatarUrl={profile.avatar_url}
          name={profile.display_name ?? profile.username}
          photoStyle={photoStyleFrom(profile.theme)}
        />
        <ProfileForm
          displayName={profile.display_name ?? ""}
          bio={profile.bio}
        />
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("contentTitle")}>{t("contentText")}</SectionTitle>
        <AddItemMenu userId={user.id} />
        <div className="border-t border-line pt-6">
          <LinkList
            key={JSON.stringify(items)}
            userId={user.id}
            items={items}
          />
        </div>
      </Card>

      <StatsSection
        stats={stats}
        data={analytics}
        links={links}
        sourceNames={sourceNames}
        locale={locale}
      />

      <SourcesSection
        sources={sources}
        siteUrl={siteUrl}
        username={profile.username}
        views30={sourceViews}
        cardVersion={version}
        wallets={wallets}
        locale={locale}
      />

      {/* A hidden page has no card to show. */}
      {!profile.is_suspended && (
        <QrSection
          username={profile.username}
          version={version}
          wallets={wallets}
          locale={locale}
        />
      )}

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("socialsTitle")}>{t("socialsText")}</SectionTitle>
        <SocialsForm socials={socialsFrom(profile.socials)} />
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("themeTitle")}>{t("themeText")}</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const selected = id === currentTheme;
            return (
              <form key={id} action={setTheme.bind(null, id)}>
                <button
                  aria-pressed={selected}
                  className={cx(
                    "flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-edge px-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    THEMES[id].page,
                    selected &&
                      "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                  )}
                >
                  <span
                    className={cx("h-3 w-3/4 rounded", THEMES[id].button)}
                  />
                  {looks(`themes.${id}`)}
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>{common("current")}</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("fontTitle")}>{t("fontText")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(FONTS) as FontId[]).map((id) => {
            const selected = id === currentFont;
            return (
              <form key={id} action={setFont.bind(null, id)}>
                <button
                  aria-pressed={selected}
                  className={cx(
                    "flex h-28 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-edge bg-canvas px-2 text-ink transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    selected &&
                      "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                  )}
                >
                  <span className={cx("text-3xl", FONT_CLASS[id])} aria-hidden>
                    Aa
                  </span>
                  <span className={cx("text-sm", FONT_CLASS[id])}>
                    {looks(`fonts.${id}`)}
                  </span>
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>{common("current")}</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title={t("cornersTitle")}>{t("cornersText")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(CORNERS) as CornerStyle[]).map((id) => {
            const selected = id === currentCorners;
            return (
              <form key={id} action={setCorners.bind(null, id)}>
                <button
                  aria-pressed={selected}
                  className={cx(
                    "flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-edge bg-canvas px-2 text-ink transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    selected &&
                      "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                  )}
                >
                  <span
                    className={cx(
                      "h-9 w-20 bg-brand",
                      CORNER_CLASSES[id].block,
                    )}
                    aria-hidden
                  />
                  <span className="text-sm">{looks(`corners.${id}`)}</span>
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>{common("current")}</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>
    </>
  );
}
