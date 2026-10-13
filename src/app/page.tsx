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

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

// Depth styles: cards sit on a soft shadow and lift on hover; buttons have
// a darker bottom edge that presses down when tapped.
const card =
  "rounded-3xl border border-home-border bg-home-card shadow-[0_2px_0_var(--color-home-border),0_24px_48px_-24px_rgb(90_50_30/0.35)] transition-transform duration-300 motion-safe:hover:-translate-y-1";
const pressable =
  "bg-terra font-bold text-white shadow-[0_5px_0_var(--color-terra-deep)] transition-[translate,box-shadow] active:translate-y-[3px] active:shadow-[0_2px_0_var(--color-terra-deep)]";

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
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-7 px-6 pt-16 pb-16 text-center sm:pt-20">
          <h1
            className={`${heading} max-w-4xl text-5xl leading-[1.05] font-extrabold sm:text-7xl`}
          >
            Your bio fits <span className="text-terra">one link.</span> Make it
            count.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-home-text-2 sm:text-xl">
            Biolyn turns that single link into a page with all your links, your
            socials and stats on what people actually tap.
          </p>
          <Link
            href="/login"
            className="group flex w-full max-w-xl flex-wrap items-center gap-2 rounded-3xl border border-home-border bg-home-card p-2 pb-3 text-left shadow-[0_2px_0_var(--color-home-border),0_24px_48px_-24px_rgb(90_50_30/0.35)] transition hover:border-terra"
          >
            <span className="flex min-h-14 flex-1 items-center px-4 text-lg font-semibold">
              <span className="text-home-muted">biolyn.link/</span>
              <span>yourname</span>
            </span>
            <span
              className={`flex min-h-14 flex-1 items-center justify-center rounded-2xl px-7 text-lg sm:flex-none ${pressable} group-active:translate-y-[3px] group-active:shadow-[0_2px_0_var(--color-terra-deep)]`}
            >
              Claim it free
            </span>
          </Link>
          <p className="text-sm text-home-muted">
            Continue with Google or get a magic link by email.
          </p>
          <PhoneScene />
        </section>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 pb-24 md:grid-cols-3">
          <div className={`flex flex-col gap-5 p-8 md:col-span-2 ${card}`}>
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
                  className={`flex-1 rounded-lg shadow-[inset_0_-6px_0_rgb(0_0_0/0.08)] ${i === 5 ? "bg-linear-to-b from-terra-light to-terra" : "bg-linear-to-b from-home-raised to-home-border"}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-3xl bg-linear-to-br from-terra-light to-terra p-8 text-white shadow-[0_6px_0_var(--color-terra-deep),0_28px_48px_-20px_rgb(120_50_20/0.55)] transition-transform duration-300 motion-safe:hover:-translate-y-1">
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
              <div className="flex gap-2.5" aria-hidden="true">
                <span className="h-11 w-11 -rotate-6 rounded-xl border border-home-border bg-white shadow-[0_4px_0_var(--color-home-border)]" />
                <span className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950 shadow-[0_4px_0_#000]" />
                <span className="h-11 w-11 rotate-6 rounded-xl bg-linear-to-b from-orange-400 via-pink-500 to-purple-600 shadow-[0_4px_0_#6b21a8]" />
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

        <section className="border-t border-home-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start gap-12 px-6 py-20">
            <h2
              className={`${heading} flex-[1_1_320px] text-4xl leading-tight font-extrabold`}
            >
              From sign up to bio in minutes.
            </h2>
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

        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 pb-20 text-center">
          <h2 className={`${heading} text-4xl font-extrabold sm:text-5xl`}>
            Claim your name before it&apos;s gone.
          </h2>
          <Link
            href="/login"
            className={`inline-flex min-h-14 items-center rounded-2xl px-8 text-lg ${pressable}`}
          >
            Get started free
          </Link>
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
    <div className={`flex flex-col gap-4 p-8 ${card}`}>
      {icon}
      <h2 className={`${heading} text-2xl font-bold`}>{title}</h2>
      <p className="leading-relaxed text-home-text-2">{children}</p>
    </div>
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
    <li className="flex items-center gap-5 border-b border-home-line py-5">
      <span
        className={`${heading} flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-xl bg-home-card text-lg font-bold text-terra shadow-[0_3px_0_var(--color-home-border)] ring-1 ring-home-border`}
      >
        {n}
      </span>
      <span className="text-xl">
        <strong>{verb}</strong>{" "}
        <span className="text-home-text-2">{children}</span>
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

function QrIcon({ size = 72 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size} stroke="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-terra">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.6 10.6l6.8-3.2M8.6 13.4l6.8 3.2" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-terra">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

// A sample profile on a phone tilted back in 3D, with two floating cards.
// Decorative only, so it is hidden from screen readers.
function PhoneScene() {
  return (
    <div
      className="relative mt-6 flex w-full justify-center [perspective:1400px]"
      aria-hidden="true"
    >
      <div className="w-64 rounded-[2.5rem] bg-home-text p-2.5 shadow-[0_40px_80px_-30px_rgb(60_30_15/0.6),0_14px_0_#120c09] [transform:rotateX(22deg)_rotateZ(-5deg)] sm:w-72">
        <div className="flex flex-col items-center gap-3 rounded-[2rem] bg-home-card px-5 pt-9 pb-7">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-terra-light to-terra text-2xl font-bold text-white shadow-[0_4px_0_var(--color-terra-deep)]">
            L
          </div>
          <div className="text-center">
            <div className="font-bold">Luna Coffee</div>
            <div className="text-sm text-home-muted">Small batch roasts</div>
          </div>
          {["Order beans", "This week's menu", "Find us"].map((label) => (
            <div
              key={label}
              className="w-full rounded-full bg-home-bg py-3 text-center text-sm font-semibold shadow-[0_3px_0_var(--color-home-border)] ring-1 ring-home-border"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-10 left-[calc(50%-17rem)] hidden rotate-[-8deg] items-center gap-3 rounded-2xl bg-home-card px-4 py-3 text-left text-sm font-semibold shadow-[0_4px_0_var(--color-home-border),0_20px_40px_-16px_rgb(90_50_30/0.4)] ring-1 ring-home-border md:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-terra text-white">
          +
        </span>
        New link added
      </div>
      <div className="absolute right-[calc(50%-16rem)] bottom-16 hidden rotate-[7deg] rounded-2xl bg-linear-to-br from-terra-light to-terra p-3 text-white shadow-[0_5px_0_var(--color-terra-deep),0_20px_40px_-16px_rgb(120_50_20/0.5)] md:block">
        <QrIcon size={44} />
      </div>
    </div>
  );
}
