import { useLocale, useTranslations } from "next-intl";
import { homePath } from "@/i18n/locale";
import { ButtonLink, Heading, PageShell, container, cx } from "@/components/ui";

// Also shown for usernames nobody has claimed and for suspended pages.
export default function NotFound() {
  const t = useTranslations("notFound");
  const common = useTranslations("common");
  const locale = useLocale();
  return (
    <PageShell>
      <main
        className={cx(
          container("medium"),
          "flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center sm:py-28",
        )}
      >
        <Heading as="h1" size="title" className="sm:text-6xl">
          {t("title")}
        </Heading>
        <p className="max-w-md text-lg leading-relaxed text-ink-soft">
          {t("text")}
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/login" size="lg">
            {t("claim")}
          </ButtonLink>
          <ButtonLink href={homePath(locale)} size="lg" variant="secondary">
            {common("goHome")}
          </ButtonLink>
        </div>
      </main>
    </PageShell>
  );
}
