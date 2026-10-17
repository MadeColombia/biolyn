import { useTranslations } from "next-intl";
import { AccountLink } from "@/components/account-link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "./logo";
import { container, cx } from "./recipes";

/**
 * Wraps a Biolyn screen: canvas background, body font, header with the logo
 * and Log in / Dashboard, and the footer with the language switcher. Put
 * the screen's <main> inside.
 * Not for public profile pages (/[username]), which use the owner's theme.
 */
export function PageShell({
  children,
  header = <AccountLink />,
  showLogo = true,
  bottomBar = false,
}: {
  children: React.ReactNode;
  /** Hide the header logo when the page shows its own (the homepage). */
  showLogo?: boolean;
  /** Right side of the header. Pass null to hide it. */
  header?: React.ReactNode;
  /** The screen has a bar fixed to the bottom on phones (the dashboard
   * tabs), so the footer leaves room for it. */
  bottomBar?: boolean;
}) {
  const t = useTranslations("shell");
  return (
    <div className="flex flex-1 flex-col bg-canvas font-body text-ink">
      <header
        className={cx(
          container(),
          "flex items-center gap-4 py-5",
          showLogo ? "justify-between" : "justify-end",
        )}
      >
        {showLogo && <Logo />}
        {header}
      </header>
      {children}
      <footer
        className={cx(
          container(),
          "flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 text-sm text-ink-muted",
          bottomBar
            ? "pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-8"
            : "pb-8",
        )}
      >
        <span>{t("footer")}</span>
        <LanguageSwitcher className="hover:text-ink" />
      </footer>
    </div>
  );
}
