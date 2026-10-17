"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_NAMES,
  homePath,
  type Locale,
} from "@/i18n/locale";
import { cx } from "@/components/ui/recipes";

/**
 * A small "Español" / "English" link that switches the whole site. The
 * choice is saved in a cookie, so every page remembers it. The homepage
 * has its own address per language; other pages reload in place.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const other = LOCALES.find((l) => l !== locale) as Locale;

  function change() {
    document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    const path = window.location.pathname;
    if (LOCALES.some((l) => path === homePath(l))) {
      window.location.assign(homePath(other));
    } else {
      window.location.reload();
    }
  }

  return (
    <button
      type="button"
      onClick={change}
      lang={other}
      aria-label={t("switchTo", { language: LOCALE_NAMES[other] })}
      className={cx(
        "inline-flex min-h-11 items-center gap-1.5 rounded-lg underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      {LOCALE_NAMES[other]}
    </button>
  );
}
