import { AccountLink } from "@/components/account-link";
import { Logo } from "./logo";
import { container, cx } from "./recipes";

/**
 * Wraps a Biolyn screen: canvas background, body font, header with the logo
 * and Log in / Dashboard, and the footer. Put the screen's <main> inside.
 * Not for public profile pages (/[username]), which use the owner's theme.
 */
export function PageShell({
  children,
  header = <AccountLink />,
}: {
  children: React.ReactNode;
  /** Right side of the header. Pass null to hide it. */
  header?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-canvas font-body text-ink">
      <header
        className={cx(
          container(),
          "flex items-center justify-between gap-4 py-5",
        )}
      >
        <Logo />
        {header}
      </header>
      {children}
      <footer
        className={cx(
          container(),
          "border-t border-line pt-6 pb-10 text-sm text-ink-muted",
        )}
      >
        © Biolyn
      </footer>
    </div>
  );
}
