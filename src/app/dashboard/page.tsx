import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  PageShell,
  card,
  container,
  cx,
  input,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getStats } from "@/lib/analytics";
import { socialsFrom } from "@/lib/socials";
import { THEMES, themeFrom, type ThemeId } from "@/lib/themes";
import { setTheme, signOut, updateProfile } from "./actions";
import {
  AddLinkForm,
  AvatarUpload,
  ClaimUsernameForm,
  CopyLinkButton,
  SocialsForm,
} from "./forms";
import { LinkList } from "./link-list";
import { QrSection, StatsSection } from "./stats";

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

  const { data: links } = await supabase
    .from("links")
    .select(
      "id, title, url, is_visible, embed, size, image_url, starts_at, ends_at",
    )
    .eq("profile_id", profile.id)
    .order("position");

  const currentTheme = themeFrom(profile.theme);
  const stats = await getStats(
    supabase,
    profile.id,
    (links ?? []).map((l) => l.id),
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
        />
        <form action={updateProfile} className="flex flex-col gap-4">
          <Field
            label="Display name"
            name="display_name"
            defaultValue={profile.display_name ?? ""}
            placeholder="Display name"
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="field-bio" className="text-sm font-bold text-ink">
              Bio
            </label>
            <textarea
              id="field-bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              placeholder="Short bio (160 characters)"
              maxLength={160}
              aria-describedby="field-bio-note"
              className={cx(input(), "min-h-24 py-3")}
            />
            <p id="field-bio-note" className="text-sm text-ink-muted">
              Up to 160 characters.
            </p>
          </div>
          <Button className="self-start">Save profile</Button>
        </form>
      </Card>

      <Card padding="md" className="flex flex-col gap-6">
        <SectionTitle title="Links">
          Drag to reorder, or tap Edit to change a link. Hidden links stay here but not on your page.
        </SectionTitle>
        <AddLinkForm userId={user.id} />
        <div className="border-t border-line pt-6">
          <LinkList
            key={JSON.stringify(links ?? [])}
            userId={user.id}
            links={links ?? []}
          />
        </div>
      </Card>

      <StatsSection stats={stats} links={links ?? []} />

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
    </>
  );
}
