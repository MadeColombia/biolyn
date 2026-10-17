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
import { tabFrom } from "@/lib/dashboard-tabs";
import { createClient } from "@/lib/supabase/server";
import { getAnalytics, summarize } from "@/lib/analytics";
import { ranked } from "@/lib/chart";
import { sourceNames as namesFor } from "@/lib/sources";
import { socialsFrom } from "@/lib/socials";
import {
  motionOf,
  photoStyleFrom,
  THEMES,
  themeFrom,
  type ThemeId,
} from "@/lib/themes";
import { ThemeMotion } from "@/components/theme-motion";
import { galleryLayoutFrom } from "@/lib/gallery";
import { nestRows, sectionLayoutFrom } from "@/lib/sections";
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
import { DeleteUndo } from "./delete-undo";
import { LinkList, type LinkItem, type ListItem } from "./link-list";
import { TabBar } from "./tab-bar";
import { PreviewButton, PreviewPanel } from "./preview";
import { previewVersion } from "@/lib/preview";
import { dividerStyleFrom, textBodyText } from "@/lib/blocks";
import { QrSection, StatsSection } from "./stats";
import { SourcesSection } from "./sources";

export default async function DashboardPage(
  props: PageProps<"/[locale]/dashboard">,
) {
  const t = await getTranslations("dashboard");
  return (
    <PageShell
      bottomBar
      header={
        <form action={signOut}>
          <Button variant="ghost" size="sm">
            {t("signOut")}
          </Button>
        </form>
      }
    >
      {/* Computers get a second column for the page preview. */}
      <main
        className={cx(
          container(),
          "flex flex-1 flex-col pt-2 pb-12 sm:pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-10",
        )}
      >
        <Suspense fallback={<DashboardLoading />}>
          <Dashboard searchParams={props.searchParams} />
        </Suspense>
      </main>
    </PageShell>
  );
}

// The editor column: as wide as before, or the left column on computers.
const editorColumn =
  "mx-auto flex w-full max-w-3xl flex-col gap-4 lg:mx-0 lg:max-w-none";

// Card shaped placeholders, so the page doesn't jump when data arrives.
async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  return (
    <div aria-busy="true" className={editorColumn}>
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

// Reads the session cookie and the address, so it must render inside
// <Suspense>.
async function Dashboard({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/dashboard">["searchParams"];
}) {
  const t = await getTranslations("dashboard");
  const common = await getTranslations("common");
  const tab = tabFrom((await searchParams).tab);
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
      <section className={cx(editorColumn, "gap-6")}>
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://biolyn.link";
  const locale = await getLocale();
  // The share card's picture changes with the photo, name and theme.
  const version = cardVersion([
    profile.avatar_url,
    profile.display_name,
    themeFrom(profile.theme),
    cardDesign(),
  ]);
  const wallets = walletsOn();
  // A hidden page can't be shown, so it gets no preview.
  const preview = profile.is_suspended
    ? null
    : await previewVersionFor(supabase, profile);

  return (
    <>
      <div className={editorColumn}>
        {profile.is_suspended && (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-3xl border border-danger bg-surface p-6 text-danger"
          >
            <p className="font-bold">{t("hiddenTitle")}</p>
            <p className="text-sm leading-relaxed">{t("hiddenText")}</p>
          </div>
        )}

        <div
          className={cx(
            card({ padding: "none" }),
            "flex items-center gap-2 p-2",
          )}
        >
          <Link
            href={`/${profile.username}`}
            target="_blank"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 font-semibold transition hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-lg"
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

        <TabBar active={tab} />

        {tab === "content" && (
          <ContentTab profileId={profile.id} userId={user.id} />
        )}
        {tab === "look" && <LookTab theme={profile.theme} />}
        {tab === "profile" && (
          <>
            <TabTitle title={t("profileTitle")} text={t("profileText")} />
            <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
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
            <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
              <SectionTitle title={t("socialsTitle")}>
                {t("socialsText")}
              </SectionTitle>
              <SocialsForm socials={socialsFrom(profile.socials)} />
            </Card>
            {/* A hidden page has no card to show. */}
            {!profile.is_suspended && (
              <QrSection
                username={profile.username}
                version={version}
                wallets={wallets}
                locale={locale}
              />
            )}
          </>
        )}
        {tab === "stats" && (
          <StatsTab
            profile={profile}
            siteUrl={siteUrl}
            cardVersion={version}
            wallets={wallets}
          />
        )}
      </div>
      {preview && (
        <>
          <PreviewPanel username={profile.username} version={preview} />
          {tab !== "stats" && (
            <PreviewButton username={profile.username} version={preview} />
          )}
        </>
      )}
    </>
  );
}

// Everything the public page shows, boiled down to a short code that
// changes when any of it does. The preview reloads when the code changes.
async function previewVersionFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: { id: string },
) {
  const [{ data: links }, { data: photos }] = await Promise.all([
    supabase.from("links").select("*").eq("profile_id", profile.id),
    supabase.from("photos").select("*").eq("profile_id", profile.id),
  ]);
  return previewVersion([profile, links, photos]);
}

/**
 * The heading at the top of a tab, with a short line under it. `hidden`
 * keeps it for screen readers only, on tabs whose cards have their own
 * titles.
 */
function TabTitle({
  title,
  text,
  hidden = false,
}: {
  title: string;
  text?: string;
  hidden?: boolean;
}) {
  if (hidden) return <h1 className="sr-only">{title}</h1>;
  return (
    <div className="flex flex-col gap-1 pt-2">
      <Heading as="h1" size="section" className="sm:text-3xl">
        {title}
      </Heading>
      {text && <p className="text-ink-soft">{text}</p>}
    </div>
  );
}

// Links, galleries and sections share one list, so they can be dragged in
// any order. Links can also sit inside a section.
async function ContentTab({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string;
}) {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const [{ data: rows }, { data: photos }] = await Promise.all([
    supabase
      .from("links")
      .select(
        "id, kind, parent_id, title, url, layout, is_visible, embed, size, image_url, preview_url, starts_at, ends_at, settings",
      )
      .eq("profile_id", profileId)
      .order("position"),
    supabase
      .from("photos")
      .select("id, link_id, url, alt")
      .eq("profile_id", profileId)
      .order("position"),
  ]);

  type Row = NonNullable<typeof rows>[number];
  const toLink = (row: Row): LinkItem => ({
    ...row,
    kind: "link",
    title: row.title ?? "",
    url: row.url ?? "",
  });
  const items: ListItem[] = nestRows(rows ?? []).map(
    ({ row, children }): ListItem => {
      switch (row.kind) {
        case "gallery":
          return {
            kind: "gallery",
            id: row.id,
            title: row.title ?? "",
            is_visible: row.is_visible,
            layout: galleryLayoutFrom(row.layout),
            photos: (photos ?? [])
              .filter((p) => p.link_id === row.id)
              .map(({ id, url, alt }) => ({ id, url, alt })),
          };
        case "section":
          return {
            kind: "section",
            id: row.id,
            title: row.title,
            is_visible: row.is_visible,
            layout: sectionLayoutFrom(row.layout),
            links: children.map(toLink),
          };
        case "text":
          return {
            kind: "text",
            id: row.id,
            title: row.title,
            is_visible: row.is_visible,
            body: textBodyText(row.settings),
          };
        case "divider":
          return {
            kind: "divider",
            id: row.id,
            is_visible: row.is_visible,
            style: dividerStyleFrom(row.settings),
          };
        default:
          return toLink(row);
      }
    },
  );
  const sections = items.flatMap((i) =>
    i.kind === "section"
      ? [{ id: i.id, title: i.title, layout: i.layout }]
      : [],
  );

  return (
    <>
      <TabTitle title={t("contentTitle")} text={t("contentText")} />
      <DeleteUndo>
        <AddItemMenu userId={userId} sections={sections} />
        <LinkList userId={userId} items={items} />
      </DeleteUndo>
    </>
  );
}

async function LookTab({ theme }: { theme: unknown }) {
  const t = await getTranslations("dashboard");
  const looks = await getTranslations("looks");
  const common = await getTranslations("common");
  const currentTheme = themeFrom(theme);
  const currentFont = fontFrom(theme);
  const currentCorners = cornerStyleFrom(theme);
  return (
    <>
      <TabTitle title={t("lookTitle")} hidden />
      <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
        <SectionTitle title={t("themeTitle")}>{t("themeText")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const selected = id === currentTheme;
            const motion = motionOf(id);
            return (
              <form key={id} action={setTheme.bind(null, id)}>
                <button
                  aria-pressed={selected}
                  className="group flex w-full flex-col items-center gap-2 rounded-2xl text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {/* A tiny page in the theme: its background (moving
                      ones move here too) and two of its buttons. */}
                  <span
                    aria-hidden
                    className={cx(
                      "relative isolate flex h-24 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-edge transition group-hover:border-brand",
                      THEMES[id].page,
                      selected &&
                        "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                    )}
                  >
                    <ThemeMotion motion={motion} preview />
                    <span
                      className={cx("h-3 w-3/4 rounded", THEMES[id].button)}
                    />
                    <span
                      className={cx("h-3 w-3/4 rounded", THEMES[id].button)}
                    />
                  </span>
                  <span className="flex flex-col items-center leading-tight">
                    {looks(`themes.${id}`)}
                    {motion && (
                      <span className="text-xs font-normal text-ink-muted">
                        {t("themeMoves")}
                      </span>
                    )}
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

      <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
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

      <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
        <SectionTitle title={t("cornersTitle")}>
          {t("cornersText")}
        </SectionTitle>
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

// Visit numbers, then the tracking links that split them by where the
// page was shared.
async function StatsTab({
  profile,
  siteUrl,
  cardVersion,
  wallets,
}: {
  profile: { id: string; username: string };
  siteUrl: string;
  cardVersion: string;
  wallets: ReturnType<typeof walletsOn>;
}) {
  const t = await getTranslations("dashboard");
  const sourcesT = await getTranslations("sources");
  const locale = await getLocale();
  const supabase = await createClient();
  // Every tracking link ever made: deleted ones still name past visits.
  const [{ data: allSources }, { data: rows }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, code, label, deleted_at")
      .eq("profile_id", profile.id)
      .order("created_at"),
    supabase
      .from("links")
      .select("id, title")
      .eq("profile_id", profile.id)
      .eq("kind", "link")
      .order("position"),
  ]);
  const analytics = await getAnalytics(
    supabase,
    profile.id,
    (allSources ?? []).map((s) => s.code),
  );
  const sourceViews = Object.fromEntries(
    ranked(analytics, "views", "channel", 30)
      .filter((r) => r.key.startsWith("s:"))
      .map((r) => [r.key.slice(2), r.count]),
  );

  return (
    <>
      <TabTitle title={t("statsTitle")} hidden />
      <StatsSection
        stats={summarize(analytics)}
        data={analytics}
        links={(rows ?? []).map((r) => ({ id: r.id, title: r.title ?? "" }))}
        sourceNames={namesFor(allSources ?? [], (name) =>
          sourcesT("deleted", { name }),
        )}
        locale={locale}
      />
      <SourcesSection
        sources={(allSources ?? []).filter((s) => !s.deleted_at)}
        siteUrl={siteUrl}
        username={profile.username}
        views30={sourceViews}
        cardVersion={cardVersion}
        wallets={wallets}
        locale={locale}
      />
    </>
  );
}
