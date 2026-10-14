import Link from "next/link";
import {
  ButtonLink,
  Card,
  Heading,
  PageShell,
  button,
  card,
  container,
  cx,
} from "@/components/ui";

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

export default function Home() {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col">
        <section
          className={cx(
            container(),
            "flex flex-col items-center gap-7 pt-16 pb-16 text-center sm:pt-20",
          )}
        >
          <Heading as="h1" size="display" className="max-w-4xl">
            Your bio fits <span className="text-brand">one link.</span> Make it
            count.
          </Heading>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Biolyn turns that single link into a page with all your links, your
            socials and stats on what people actually tap.
          </p>
          <Link
            href="/login"
            className={cx(
              card({ tone: "interactive", padding: "none" }),
              "flex w-full max-w-xl flex-wrap items-center gap-2 p-2 text-left",
            )}
          >
            <span className="flex min-h-14 flex-1 items-center px-4 text-lg font-semibold">
              <span className="text-ink-muted">biolyn.link/</span>
              <span>yourname</span>
            </span>
            <span className={cx(button({ size: "lg" }), "flex-1 sm:flex-none")}>
              Claim it free
            </span>
          </Link>
          <p className="text-sm text-ink-muted">
            Continue with Google or get a magic link by email.
          </p>
        </section>

        <section
          className={cx(
            container(),
            "grid grid-cols-1 gap-4 pb-24 md:grid-cols-3",
          )}
        >
          <Card className="flex flex-col gap-5 md:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Heading>Know what works</Heading>
              <span className="text-sm text-ink-muted">
                Dashboard preview, sample data
              </span>
            </div>
            <p className="max-w-lg leading-relaxed text-ink-soft">
              Views over 7 or 30 days, clicks on each link and the sites your
              visitors came from.
            </p>
            <div className="flex h-40 items-end gap-2.5" aria-hidden="true">
              {SAMPLE_BARS.map((height, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg ${i === 5 ? "bg-brand" : "bg-edge"}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </Card>

          <Card tone="brand" className="flex flex-col justify-between gap-4">
            <QrIcon />
            <div>
              <Heading className="mb-2">QR code included</Heading>
              <p className="leading-relaxed">
                Download a PNG for flyers, menus and your shop counter.
              </p>
            </div>
          </Card>

          <Feature
            title="Multiple themes"
            icon={
              <div className="flex gap-2.5" aria-hidden="true">
                <span className="h-11 w-11 rounded-xl border border-edge bg-white" />
                <span className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950" />
                <span className="h-11 w-11 rounded-xl bg-linear-to-b from-orange-400 via-pink-500 to-purple-600" />
              </div>
            }
          >
            Pick the look that fits you and switch whenever your style changes.
          </Feature>
          <Feature title="All your socials" icon={<ShareIcon />}>
            Instagram, TikTok, YouTube and more, as clean icons under your name.
          </Feature>
          <Feature title="Easy to manage" icon={<SlidersIcon />}>
            Add, edit and drag your links into order from one simple dashboard.
          </Feature>
        </section>

        <section className="border-t border-line">
          <div className={cx(container(), "flex flex-wrap items-start gap-12 py-20")}>
            <Heading size="title" className="flex-[1_1_320px] leading-tight">
              From sign up to bio in minutes.
            </Heading>
            <ol className="flex flex-[2_1_520px] flex-col">
              <Step n={1} verb="Claim">
                biolyn.link/yourname
              </Step>
              <Step n={2} verb="Add">
                your links, photo, socials and theme
              </Step>
              <Step n={3} verb="Paste">
                it into your Instagram bio
              </Step>
            </ol>
          </div>
        </section>

        <section
          className={cx(
            container(),
            "flex flex-col items-center gap-6 pb-20 text-center",
          )}
        >
          <Heading size="title" className="sm:text-5xl">
            Claim your name before it&apos;s gone.
          </Heading>
          <ButtonLink href="/login" size="lg">
            Get started free
          </ButtonLink>
        </section>
      </main>
    </PageShell>
  );
}

function Feature({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      {icon}
      <Heading>{title}</Heading>
      <p className="leading-relaxed text-ink-soft">{children}</p>
    </Card>
  );
}

function Step({
  n,
  verb,
  children,
}: {
  n: number;
  verb: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-6 border-b border-line py-5">
      <Heading as="span" size="label" className="w-5 shrink-0 text-brand">
        {n}
      </Heading>
      <span className="text-xl">
        <strong>{verb}</strong>{" "}
        <span className="text-ink-soft">{children}</span>
      </span>
    </li>
  );
}

const iconProps = {
  fill: "none",
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

function QrIcon() {
  return (
    <svg {...iconProps} width="72" height="72" stroke="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-brand">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.6 10.6l6.8-3.2M8.6 13.4l6.8 3.2" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-brand">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
