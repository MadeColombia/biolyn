import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { DEFAULT_LOCALE, isLocale } from "./locale";
import { MESSAGES } from "./messages";

// next-intl asks this for the language of each render. Pages live under
// app/[locale], and the proxy rewrites every address to it, so the
// language is the root param. Callers can also name one explicitly.
export default getRequestConfig(async ({ locale }) => {
  const picked = isLocale(locale) ? locale : await rootLocale();
  const resolved = isLocale(picked) ? picked : DEFAULT_LOCALE;
  return { locale: resolved, messages: MESSAGES[resolved] };
});
