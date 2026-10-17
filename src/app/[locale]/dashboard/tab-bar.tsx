import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui";
import {
  DASHBOARD_TABS,
  tabHref,
  type DashboardTab,
} from "@/lib/dashboard-tabs";

/**
 * The dashboard's tabs. On phones they sit in a bar at the bottom of the
 * screen, in thumb reach, with an icon over each name. From tablet size up
 * they stick to the top of the page. Each tab is its own address, so the
 * back button works.
 */
export function TabBar({ active }: { active: DashboardTab }) {
  const t = useTranslations("tabs");
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-surface pb-[env(safe-area-inset-bottom)] sm:sticky sm:top-0 sm:-mx-2 sm:border-t-0 sm:bg-canvas/95 sm:pt-2 sm:pb-3 sm:backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md sm:max-w-none sm:gap-1 sm:rounded-2xl sm:border sm:border-edge sm:bg-surface sm:p-1">
        {DASHBOARD_TABS.map((tab) => {
          const current = tab === active;
          return (
            <li key={tab} className="flex-1">
              <Link
                href={tabHref(tab)}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-xl sm:text-sm",
                  current
                    ? "text-brand sm:bg-raised sm:text-ink"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                <TabIcon tab={tab} />
                {t(tab)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabIcon({ tab }: { tab: DashboardTab }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 sm:size-[18px]"
    >
      {tab === "content" && (
        <>
          <rect x="4" y="4" width="16" height="5" rx="1.5" />
          <rect x="4" y="12" width="16" height="3" rx="1.5" />
          <rect x="4" y="18" width="16" height="2" rx="1" />
        </>
      )}
      {tab === "look" && (
        <>
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8l-.4-.9c-.5-1 .2-2.3 1.4-2.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z" />
          <circle cx="7.5" cy="11" r="1.2" />
          <circle cx="10.5" cy="7" r="1.2" />
          <circle cx="15" cy="7.5" r="1.2" />
        </>
      )}
      {tab === "profile" && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )}
      {tab === "stats" && <path d="M5 20V12M12 20V4M19 20v-9" />}
      {tab === "share" && (
        <>
          <path d="M12 15V3M7 8l5-5 5 5" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </>
      )}
    </svg>
  );
}
