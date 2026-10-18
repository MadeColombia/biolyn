import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { DEFAULT_LOCALE, LOCALES, homePath, isLocale } from "@/i18n/locale";
import {
  ButtonLink,
  Card,
  Heading,
  Logo,
  LogoMotion,
  PageShell,
  button,
  card,
  container,
  cx,
} from "@/components/ui";
import { ThemeMotion } from "@/components/theme-motion";
import { motionOf, THEMES, type ThemeId } from "@/lib/themes";

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

// Three eye-catching themes (all of them move).
const SHOWCASE_THEMES: ThemeId[] = ["aurora", "bubbles", "retro"];

// Search engines get both homepages, each pointing at the other.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  return {
    alternates: {
      canonical: homePath(isLocale(locale) ? locale : DEFAULT_LOCALE),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, homePath(l)])),
        "x-default": homePath(DEFAULT_LOCALE),
      },
    },
  };
}

export default function Home() {
  const t = useTranslations("home");
  return (
    <PageShell showLogo={false}>
      <main className="flex flex-1 flex-col">
        <section
          className={cx(
            container(),
            "flex flex-col items-center gap-7 pt-16 pb-16 text-center sm:pt-20",
          )}
        >
          <Logo animated className="text-3xl sm:text-4xl" />
          <Heading as="h1" size="display" className="max-w-4xl">
            {t("heroStart")}{" "}
            <span className="text-brand">{t("heroBrand")}</span> {t("heroEnd")}
          </Heading>
          <p className="max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            {t("intro")}
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
              <span>{t("yourName")}</span>
            </span>
            <span className={cx(button({ size: "lg" }), "flex-1 sm:flex-none")}>
              {t("claim")}
            </span>
          </Link>
          <p className="text-sm text-ink-muted">{t("signInOptions")}</p>
        </section>

        <section
          className={cx(
            container(),
            "grid grid-cols-1 gap-4 pb-24 md:grid-cols-3",
          )}
        >
          <Card className="flex flex-col gap-5 md:col-span-2">
            <Heading>{t("themesTitle")}</Heading>
            <p className="max-w-lg leading-relaxed text-ink-soft">
              {t("themesText")}
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {SHOWCASE_THEMES.map((id) => (
                <ThemeTile key={id} id={id} />
              ))}
              <span className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-edge p-2 text-center text-sm font-semibold text-ink-soft sm:h-32">
                {t("themesMore")}
              </span>
            </div>
          </Card>

          <Link
            href="/login"
            className={cx(
              card({ tone: "interactive" }),
              "group flex flex-col gap-5",
            )}
          >
            <StylePreview />
            <Heading>{t("styleTitle")}</Heading>
            <p className="leading-relaxed text-ink-soft">{t("styleText")}</p>
            <span className="mt-auto font-bold text-brand">
              {t("styleCta")}{" "}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>

          <Feature title={t("mediaTitle")} icon={<PlayerIcon />}>
            {t("mediaText")}
          </Feature>

          <Card className="flex flex-col gap-5 md:col-span-2">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Heading>{t("statsTitle")}</Heading>
              <span className="text-sm text-ink-muted">{t("statsSample")}</span>
            </div>
            <p className="max-w-lg leading-relaxed text-ink-soft">
              {t("statsText")}
            </p>
            <div className="flex h-32 items-end gap-2.5" aria-hidden="true">
              {SAMPLE_BARS.map((height, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg ${i === 5 ? "bg-brand" : "bg-edge"}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </Card>

          <Feature title={t("manageTitle")} icon={<SlidersIcon />}>
            {t("manageText")}
          </Feature>

          <Card
            tone="brand"
            className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between md:col-span-2"
          >
            <div className="max-w-md">
              <Heading className="mb-2">{t("shareTitle")}</Heading>
              <p className="leading-relaxed">{t("shareText")}</p>
            </div>
            <QrIcon />
          </Card>
        </section>

        <section className="border-t border-line">
          <div
            className={cx(
              container(),
              "flex flex-wrap items-start gap-12 py-20",
            )}
          >
            <Heading size="title" className="flex-[1_1_320px] leading-tight">
              {t("stepsTitle")}
            </Heading>
            <ol className="flex flex-[2_1_520px] flex-col">
              <Step n={1} verb={t("step1Verb")}>
                {t("step1")}
              </Step>
              <Step n={2} verb={t("step2Verb")}>
                {t("step2")}
              </Step>
              <Step n={3} verb={t("step3Verb")}>
                {t("step3")}
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
          <LogoMotion height={72} />
          <Heading size="title" className="sm:text-5xl">
            {t("finalTitle")}
          </Heading>
          <ButtonLink href="/login" size="lg">
            {t("finalButton")}
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

// A tiny page in a theme. Moving themes move here too (and stop for
// reduced motion).
function ThemeTile({ id }: { id: ThemeId }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative isolate flex h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-edge sm:h-32",
        THEMES[id].page,
      )}
    >
      <ThemeMotion motion={motionOf(id)} preview />
      <span className={cx("h-2.5 w-3/4 rounded-sm", THEMES[id].button)} />
      <span className={cx("h-2.5 w-3/4 rounded-sm", THEMES[id].button)} />
    </span>
  );
}

// A tiny page taking shape: a cover photo, a round picture and buttons
// with different corners.
function StylePreview() {
  return (
    <div aria-hidden="true">
      <div className="h-16 rounded-2xl bg-linear-to-br from-brand/35 to-brand/5" />
      <div className="-mt-7 ml-4 h-14 w-14 rounded-full bg-brand ring-4 ring-surface" />
      <div className="mt-3 flex flex-col gap-2">
        <span className="h-3 w-full rounded-none bg-raised" />
        <span className="h-3 w-5/6 rounded-md bg-raised" />
        <span className="h-3 w-2/3 rounded-full bg-brand" />
      </div>
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

function PlayerIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-brand">
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="M10 9v6l5-3z" strokeLinejoin="round" />
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
