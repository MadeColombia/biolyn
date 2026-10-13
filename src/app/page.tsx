import Link from "next/link";
import { IBM_Plex_Sans, Unbounded } from "next/font/google";
import { AccountLink } from "@/components/account-link";

// Homepage-only fonts: Unbounded for headings, IBM Plex Sans for body text.
const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});
const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const heading = "font-[family-name:var(--font-display)] tracking-tight";
const card = "rounded-3xl border border-home-border bg-home-card p-8";
const button =
  "inline-flex min-h-14 items-center justify-center rounded-2xl bg-terra px-7 text-lg font-bold text-white transition-colors hover:bg-terra-deep";

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

const AUDIENCES = [
  "Creators",
  "Cafés",
  "Musicians",
  "Small shops",
  "Artists",
  "Coaches",
];

export default function Home() {
  return (
    <div
      className={`${display.variable} ${body.variable} flex flex-1 flex-col bg-home-bg font-[family-name:var(--font-body)] text-home-text`}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className={`${heading} text-xl font-extrabold`}>
          biolyn<span className="text-terra">.</span>link
        </Link>
        <AccountLink className="rounded-xl bg-home-raised px-4 py-3 text-sm font-bold hover:bg-home-border" />
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-14 px-6 pt-12 pb-20 sm:pt-16">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
            <h1
              className={`${heading} text-5xl leading-[1.12] font-extrabold sm:text-7xl sm:leading-[1.05]`}
            >
              Your bio fits{" "}
              <span className="relative inline-block text-terra">
                one link.
                <Squiggle />
              </span>{" "}
              Make it count.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-home-text-2 sm:text-xl">
              Biolyn turns that single link into a page with all your links,
              your socials and stats on what people actually tap.
            </p>
            <Link
              href="/login"
              className="flex w-full max-w-xl flex-wrap items-center gap-2 rounded-3xl border border-home-border bg-home-card p-2 text-left transition-colors hover:border-terra"
            >
              <span className="flex min-h-14 flex-1 items-center px-4 text-lg font-semibold">
                <span className="text-home-muted">biolyn.link/</span>
                <span>yourname</span>
              </span>
              <span className={`${button} flex-1 sm:flex-none`}>
                Claim it free
              </span>
            </Link>
            <p className="text-sm text-home-muted">
              Continue with Google or get a magic link by email.
            </p>
          </div>
          <HeroPhone />
        </section>

        <div className="bg-terra py-4 text-white">
          <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 font-[family-name:var(--font-display)] text-sm font-bold sm:text-base">
            {AUDIENCES.map((who, i) => (
              <li key={who} className="flex items-center gap-6">
                {i > 0 && <Spark className="hidden sm:block" />}
                {who}
              </li>
            ))}
          </ul>
        </div>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 py-20 md:grid-cols-3">
          <div className={`flex flex-col gap-5 md:col-span-2 ${card}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className={`${heading} text-2xl font-bold`}>
                Know what works
              </h2>
              <span className="text-sm text-home-muted">
                Dashboard preview, sample data
              </span>
            </div>
            <p className="max-w-lg leading-relaxed text-home-text-2">
              Views over 7 or 30 days, clicks on each link and the sites your
              visitors came from.
            </p>
            <div className="flex h-40 items-end gap-2.5" aria-hidden="true">
              {SAMPLE_BARS.map((height, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg ${i === 5 ? "bg-terra" : "bg-home-tint"}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-terra p-8 text-white">
            <Dots className="absolute -top-2 -right-2 text-white/20" />
            <QrIcon />
            <div>
              <h2 className={`${heading} mb-2 text-2xl font-bold`}>
                QR code included
              </h2>
              <p className="leading-relaxed">
                Download a PNG for flyers, menus and your shop counter.
              </p>
            </div>
          </div>

          <Feature
            title="Multiple themes"
            icon={
              <div className="flex gap-2" aria-hidden="true">
                <span className="h-10 w-10 rounded-full border border-home-border bg-white" />
                <span className="h-10 w-10 rounded-full bg-slate-950" />
                <span className="h-10 w-10 rounded-full bg-linear-to-b from-orange-400 via-pink-500 to-purple-600" />
              </div>
            }
          >
            Pick the look that fits you and switch whenever your style changes.
          </Feature>
          <Feature
            title="All your socials"
            icon={
              <IconChip>
                <ShareIcon />
              </IconChip>
            }
          >
            Instagram, TikTok, YouTube and more, as clean icons under your name.
          </Feature>
          <Feature
            title="Easy to manage"
            icon={
              <IconChip>
                <SlidersIcon />
              </IconChip>
            }
          >
            Add, edit and drag your links into order from one simple dashboard.
          </Feature>
        </section>

        <section className="bg-home-tint">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start gap-12 px-6 py-20">
            <h2
              className={`${heading} flex-[1_1_320px] text-4xl leading-tight font-extrabold`}
            >
              From sign up to bio in minutes.
            </h2>
            <ol className="grid flex-[2_1_520px] grid-cols-1 gap-4 sm:grid-cols-3">
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

        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[2rem] bg-home-text px-6 py-16 text-center text-home-bg">
            <Dots className="absolute -top-4 -left-4 text-white/10" />
            <Dots className="absolute -right-4 -bottom-4 text-white/10" />
            <h2
              className={`${heading} relative max-w-3xl text-4xl font-extrabold sm:text-5xl`}
            >
              Claim your name before it&apos;s gone.
            </h2>
            <Link href="/login" className={`relative ${button}`}>
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-home-line px-6 pt-6 pb-10 text-sm text-home-muted">
        © Biolyn
      </footer>
    </div>
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
    <div className={`flex flex-col gap-4 ${card}`}>
      {icon}
      <h2 className={`${heading} text-2xl font-bold`}>{title}</h2>
      <p className="leading-relaxed text-home-text-2">{children}</p>
    </div>
  );
}

function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-home-tint">
      {children}
    </span>
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
    <li className="flex flex-col gap-3 rounded-3xl bg-home-card p-6">
      <span className={`${heading} text-4xl font-extrabold text-terra`}>
        0{n}
      </span>
      <span className="text-lg leading-snug">
        <strong>{verb}</strong>{" "}
        <span className="text-home-text-2">{children}</span>
      </span>
    </li>
  );
}

// A sample profile on a phone, set on a terracotta circle with dot texture.
// Decorative only, so it is hidden from screen readers.
function HeroPhone() {
  return (
    <div
      className="relative mx-auto flex flex-[0_1_380px] justify-center py-6"
      aria-hidden="true"
    >
      <div className="absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terra sm:h-96 sm:w-96" />
      <Dots className="absolute top-0 right-0 text-terra" />
      <Dots className="absolute bottom-2 left-0 text-home-text/25" />
      <div className="relative w-64 rounded-[2.5rem] bg-home-text p-2.5 sm:w-72">
        <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-home-card px-5 pt-9 pb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terra text-2xl font-bold text-white">
            L
          </div>
          <div className="text-center">
            <div className="font-bold">Luna Coffee</div>
            <div className="text-sm text-home-muted">Small batch roasts</div>
          </div>
          <div className="flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-6 w-6 rounded-full bg-home-tint" />
            ))}
          </div>
          {["Order beans", "This week's menu", "Find us"].map((label) => (
            <div
              key={label}
              className="w-full rounded-full border border-home-border bg-home-bg py-3 text-center text-sm font-semibold"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Squiggle() {
  return (
    <svg
      className="absolute -bottom-1.5 left-0 h-2.5 w-full text-terra sm:-bottom-3 sm:h-4"
      viewBox="0 0 200 16"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 10c20-8 36 6 56 0s36-8 56 0 36 6 56 0 20-6 28-4"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Dots({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="96"
      height="96"
      viewBox="0 0 96 96"
      aria-hidden="true"
    >
      {Array.from({ length: 36 }, (_, i) => (
        <circle
          key={i}
          cx={8 + (i % 6) * 16}
          cy={8 + Math.floor(i / 6) * 16}
          r="2.5"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="currentColor" />
    </svg>
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
    <svg {...iconProps} width="26" height="26" className="stroke-terra">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.6 10.6l6.8-3.2M8.6 13.4l6.8 3.2" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg {...iconProps} width="26" height="26" className="stroke-terra">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
