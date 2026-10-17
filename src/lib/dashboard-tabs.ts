/** The dashboard's tabs, in the order they're shown. Content opens first. */
export const DASHBOARD_TABS = [
  "content",
  "look",
  "profile",
  "stats",
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

/** The tab named in the address (?tab=look), or Content. */
export function tabFrom(value: unknown): DashboardTab {
  const first = Array.isArray(value) ? value[0] : value;
  return (DASHBOARD_TABS as readonly unknown[]).includes(first)
    ? (first as DashboardTab)
    : "content";
}

/** The dashboard address for a tab. Content keeps the plain address. */
export function tabHref(tab: DashboardTab) {
  return tab === "content" ? "/dashboard" : `/dashboard?tab=${tab}`;
}
