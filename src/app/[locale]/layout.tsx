import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LOCALES, isLocale } from "@/i18n/locale";
import { geistMono, geistSans, plexSans, unbounded } from "@/components/app-fonts";
import "../globals.css";

// Every page lives under app/[locale]. The proxy rewrites each address
// to /en/... or /es/..., so both languages are built ahead of time.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    // Makes share-image URLs absolute (https://biolyn.link/...).
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
