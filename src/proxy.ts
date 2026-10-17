import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_HEADER,
  isLocale,
  pickLocale,
  type Locale,
} from "@/i18n/locale";

// Runs before every page.
//
// Language: pages live under app/[locale]. The homepage has an address
// per language (/ and /es); every other page (profiles, dashboard, login,
// report) keeps one address and is quietly rewritten to the visitor's
// language: their saved choice, else their browser's.
//
// Sign-in: on /dashboard and /login it refreshes the Supabase session
// cookie, sends signed-out visitors to /login and signed-in ones past it.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const [, first = "", ...rest] = pathname.split("/");

  // /es/dashboard and other prefixed addresses: remember the language
  // and drop the prefix, except /es itself (the Spanish homepage).
  if (isLocale(first)) {
    const home = rest.length === 0 || (rest.length === 1 && rest[0] === "");
    if (home && first !== DEFAULT_LOCALE) {
      return remember(withLocale(request, first, pathname), first, saved);
    }
    const to = new URL(`/${rest.join("/")}${search}`, request.url);
    return remember(NextResponse.redirect(to), first, saved);
  }

  const locale = pickLocale(saved, request.headers.get("accept-language"));

  // The English homepage sends Spanish speakers to /es.
  if (pathname === "/") {
    if (locale !== DEFAULT_LOCALE) {
      return NextResponse.redirect(new URL(`/${locale}${search}`, request.url));
    }
    return withLocale(request, locale, `/${locale}`);
  }

  const target = `/${locale}${pathname}`;
  if (pathname.startsWith("/dashboard") || pathname === "/login") {
    return withSession(request, locale, target);
  }
  return withLocale(request, locale, target);
}

/**
 * Serves `target` (an address under app/[locale]) while the browser keeps
 * the address it asked for. Server actions read the language from the
 * header, since they have no route params.
 */
function withLocale(request: NextRequest, locale: Locale, target: string) {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  const url = new URL(target + request.nextUrl.search, request.url);
  return NextResponse.rewrite(url, { request: { headers } });
}

/** Saves the language from a prefixed address as the visitor's choice. */
function remember(response: NextResponse, locale: Locale, saved?: string) {
  if (saved !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}

async function withSession(
  request: NextRequest,
  locale: Locale,
  target: string,
) {
  let response = withLocale(request, locale, target);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = withLocale(request, locale, target);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLogin = request.nextUrl.pathname === "/login";
  if (!user && !onLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && onLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Every page, but not API routes, the sign-in callback, Next.js files
  // or icons and pictures. Usernames can have dots (ana.lopez), so only
  // these file types are left out, not every name with a dot.
  matcher: [
    "/((?!api/|auth/|_next/|_vercel/|brand/|\\.well-known/|.*\\.(?:ico|png|jpe?g|svg|webp|gif|txt|xml|webmanifest)$).*)",
  ],
};
