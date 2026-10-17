import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";

// The magic link and Google sign-in both land here with a one-time code.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Sign-in emails pick their language from the account, so keep it in
      // step with the language this person uses on the site.
      const locale = pickLocale(
        request.cookies.get(LOCALE_COOKIE)?.value,
        request.headers.get("accept-language"),
      );
      if (data?.user && data.user.user_metadata?.locale !== locale) {
        await supabase.auth.updateUser({ data: { locale } }).catch(() => {});
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
