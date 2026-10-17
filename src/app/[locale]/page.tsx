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

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

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
            {t("heroStart")} <span className="text-brand">{t("heroBrand")}</span>{" "}
            {t("heroEnd")}
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
          <p className="text-sm text-ink-muted">
            {t("signInOptions")}
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
              <Heading>{t("statsTitle")}</Heading>
              <span className="text-sm text-ink-muted">{t("statsSample")}</span>
            </div>
            <p className="max-w-lg leading-relaxed text-ink-soft">
              {t("statsText")}
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
              <Heading className="mb-2">{t("qrTitle")}</Heading>
              <p className="leading-relaxed">{t("qrText")}</p>
            </div>
          </Card>

          <Feature
            title={t("themesTitle")}
            icon={
              <div className="flex gap-2.5" aria-hidden="true">
                <span className="h-11 w-11 rounded-xl border border-edge bg-white" />
                <span className="h-11 w-11 rounded-xl border border-slate-700 bg-slate-950" />
                <span className="h-11 w-11 rounded-xl bg-linear-to-b from-orange-400 via-pink-500 to-purple-600" />
              </div>
            }
          >
            {t("themesText")}
          </Feature>
          <Feature title={t("socialsTitle")} icon={<ShareIcon />}>
            {t("socialsText")}
          </Feature>
          <Feature title={t("manageTitle")} icon={<SlidersIcon />}>
            {t("manageText")}
          </Feature>
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
