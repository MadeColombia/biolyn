import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { socialsFrom } from "@/lib/socials";
import {
  photoStyleFrom,
  THEMES,
  themeFrom,
  type ThemeId,
} from "@/lib/themes";
import { galleryLayoutFrom } from "@/lib/gallery";
import { setCorners, setFont, setTheme, signOut } from "./actions";
import { FONTS, fontFrom, type FontId } from "@/lib/fonts";
import { CORNERS, CORNER_CLASSES, cornerStyleFrom, type CornerStyle } from "@/lib/corners";
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

export default function DashboardPage() {
  return (
    <PageShell
      header={
        <form action={signOut}>
          <Button variant="ghost" size="sm">
            Sign out
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
function DashboardLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only">Loading your links...</p>
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
            Pick your username
          </Heading>
          <p className="text-lg leading-relaxed text-ink-soft">
            This becomes your link, for example biolyn.link/yourname.
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
  const [analytics, { data: sources }] = await Promise.all([
    getAnalytics(supabase, profile.id),
    supabase
      .from("sources")
      .select("id, code, label")
      .eq("profile_id", profile.id)
      .order("created_at"),
  ]);
  const stats = summarize(analytics);
  const sourceNames = Object.fromEntries(
    (sources ?? []).map((s) => [s.code, s.label]),
  );
  const sourceViews = Object.fromEntries(
    ranked(analytics, "views", "channel", 30)
      .filter((r) => r.key.startsWith("s:"))
      .map((r) => [r.key.slice(2), r.count]),
  );
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://biolyn.link";

  return (
    <>
      {profile.is_suspended && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-3xl border border-danger bg-surface p-6 text-danger"
        >
          <p className="font-bold">Your public page is hidden</p>
          <p className="text-sm leading-relaxed">
            It was reported for breaking the rules. You can still edit it, but
            visitors can&apos;t see it.
          </p>
        </div>
      )}

      <header className="flex flex-col gap-4 pb-2">
        <Heading as="h1" size="title">
          Your page
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
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <CopyLinkButton url={`${siteUrl}/${profile.username}`} />
        </div>
      </header>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Profile">
          Your picture, name and bio sit at the top of your page.
        </SectionTitle>
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
        <SectionTitle title="Content">
          Add links and photo carousels, then drag them into any order. Hidden
          items stay here but not on your page.
        </SectionTitle>
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
      />

      <SourcesSection
        sources={sources ?? []}
        siteUrl={siteUrl}
        username={profile.username}
        views30={sourceViews}
      />

      <QrSection url={`${siteUrl}/${profile.username}`} />

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Socials">
          Shown as icons under your name. Leave a field empty to remove it.
        </SectionTitle>
        <SocialsForm socials={socialsFrom(profile.socials)} />
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Theme">
          How your public page looks to visitors.
        </SectionTitle>
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
                  {THEMES[id].label}
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>Current</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Font">
          Used for everything on your public page: name, bio and links.
        </SectionTitle>
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
                    {FONTS[id].label}
                  </span>
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>Current</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Corners">
          The shape of every block on your public page: buttons, big links,
          players and photos.
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
                    className={cx("h-9 w-20 bg-brand", CORNER_CLASSES[id].block)}
                    aria-hidden
                  />
                  <span className="text-sm">{CORNERS[id].label}</span>
                </button>
                <div className="flex h-8 items-center justify-center">
                  {selected && <Badge>Current</Badge>}
                </div>
              </form>
            );
          })}
        </div>
      </Card>
    </>
  );
}
