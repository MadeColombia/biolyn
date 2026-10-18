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
import { SocialIcon } from "@/components/social-icon";
import { ThemeMotion } from "@/components/theme-motion";
import { FONT_CLASS } from "@/components/profile-fonts";
import { CORNER_CLASSES, CORNERS, type CornerStyle } from "@/lib/corners";
import { FONTS, type FontId } from "@/lib/fonts";
import type { SocialId } from "@/lib/socials";
import { motionOf, THEMES, type ThemeId } from "@/lib/themes";

// Illustrative bar heights for the dashboard preview (not real data).
const SAMPLE_BARS = [38, 52, 45, 70, 62, 88, 76];

const SAMPLE_SOCIALS: SocialId[] = ["instagram", "tiktok", "youtube", "x"];

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
  const looks = useTranslations("looks");
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
            <Heading>{t("themesTitle")}</Heading>
            <p className="max-w-lg leading-relaxed text-ink-soft">
              {t("themesText")}
            </p>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                <ThemeTile
                  key={id}
                  id={id}
                  name={looks(`themes.${id}`)}
                  moves={t("themeMoves")}
                />
              ))}
            </ul>
          </Card>

          <Feature title={t("styleTitle")} icon={<StylePreview />}>
            {t("styleText")}
          </Feature>

          <Feature title={t("blocksTitle")} icon={<BlocksPreview />}>
            {t("blocksText")}
          </Feature>
          <Feature title={t("playersTitle")} icon={<PlayerIcon />}>
            {t("playersText")}
          </Feature>
          <Feature
            title={t("socialsTitle")}
            icon={
              <div className="flex h-10 items-center gap-3 text-brand">
                {SAMPLE_SOCIALS.map((id) => (
                  <SocialIcon key={id} id={id} />
                ))}
              </div>
            }
          >
            {t("socialsText")}
          </Feature>

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

          <Feature title={t("manageTitle")} icon={<SlidersIcon />}>
            {t("manageText")}
          </Feature>
          <Feature title={t("shareTitle")} icon={<ShareIcon />}>
            {t("shareText")}
          </Feature>
          <Feature title={t("languagesTitle")} icon={<LanguagesIcon />}>
            {t("languagesText")}
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

// A tiny page in each theme, the same tile the dashboard picker shows.
// Moving themes move here too (and stop for reduced motion).
function ThemeTile({
  id,
  name,
  moves,
}: {
  id: ThemeId;
  name: string;
  moves: string;
}) {
  const motion = motionOf(id);
  return (
    <li className="flex flex-col items-center gap-1.5 text-center text-xs font-semibold leading-tight">
      <span
        aria-hidden
        className={cx(
          "relative isolate flex h-16 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-edge sm:h-20",
          THEMES[id].page,
        )}
      >
        <ThemeMotion motion={motion} preview />
        <span className={cx("h-2 w-3/4 rounded-sm", THEMES[id].button)} />
        <span className={cx("h-2 w-3/4 rounded-sm", THEMES[id].button)} />
      </span>
      <span>
        {name}
        {motion && (
          <span className="block font-normal text-ink-muted">{moves}</span>
        )}
      </span>
    </li>
  );
}

// Every page font and every corner style, as a quick sample.
function StylePreview() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-baseline gap-3 text-3xl text-ink">
        {(Object.keys(FONTS) as FontId[]).map((id) => (
          <span key={id} className={FONT_CLASS[id]}>
            Aa
          </span>
        ))}
      </div>
      <div className="flex gap-2.5">
        {(Object.keys(CORNERS) as CornerStyle[]).map((id) => (
          <span
            key={id}
            className={cx(
              "h-7 w-12 border-2 border-brand",
              CORNER_CLASSES[id].block,
            )}
          />
        ))}
      </div>
    </div>
  );
}

// A small carousel: a row of photos running off the edge.
function BlocksPreview() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="flex gap-2 overflow-hidden">
        <span className="h-14 w-20 shrink-0 rounded-xl bg-brand" />
        <span className="h-14 w-20 shrink-0 rounded-xl bg-raised" />
        <span className="h-14 w-20 shrink-0 rounded-xl bg-edge" />
        <span className="h-14 w-20 shrink-0 rounded-xl bg-raised" />
      </div>
      <span className="h-3 w-full rounded-full bg-raised" />
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

function PlayerIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-brand">
      <rect x="2.5" y="4" width="19" height="16" rx="3" />
      <path d="M10 9v6l5-3z" strokeLinejoin="round" />
    </svg>
  );
}

function LanguagesIcon() {
  return (
    <svg {...iconProps} width="40" height="40" className="stroke-brand">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
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
