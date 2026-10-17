// The languages biolyn speaks. English is the default: the homepage lives
// at / in English and at /es in Spanish. Every other page keeps one
// address for both languages and picks the language per visitor.
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Saved when someone picks a language, so every page remembers it. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Set by the proxy on every page request, so server actions know it too. */
export const LOCALE_HEADER = "x-biolyn-locale";
/** A year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best language from a browser's Accept-Language header, like
 * "es-CO,es;q=0.9,en;q=0.8". Only the language part counts, so es-MX and
 * es-ES both get Spanish. Null when none of ours is listed.
 */
export function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        lang: tag.trim().toLowerCase().split("-")[0],
        weight: Number.isFinite(weight) ? weight : 0,
        i,
      };
    })
    .filter((w) => w.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  return wanted.map((w) => w.lang).find(isLocale) ?? null;
}

/** A saved choice wins, then the browser's languages, then English. */
export function pickLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(cookie)) return cookie;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** The homepage address for a language: / or /es. */
export function homePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
}
