import { getTranslations } from "next-intl/server";
import { Card, Heading } from "@/components/ui";
import type { Stats } from "@/lib/analytics";
import { compactNumber, type Analytics } from "@/lib/chart";
import { channelLabel } from "@/lib/sources";
import { AnalyticsModes } from "./analytics-chart";
import { cardChoices } from "@/lib/qr-card";
import { ShareCardPicker } from "./share-card";

type Link = { id: string; title: string };

type Row = { key: string; label: string; count: number };

/** Rows with a count and a bar sized against the biggest count. */
function BarList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-raised p-4 text-sm text-ink-soft">{empty}</p>
    );
  }
  const max = Math.max(...rows.map((r) => r.count));
  // Like the homepage chart: only the top row gets the brand color.
  const top = rows.findIndex((r) => r.count === max);
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.key} className="flex flex-col gap-2 py-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate">{r.label}</span>
            <span className="font-bold tabular-nums">{r.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-raised" aria-hidden="true">
            <div
              className={`h-full rounded-full ${i === top ? "bg-brand" : "bg-ink-muted/40"}`}
              style={{ width: `${max ? (r.count / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export async function StatsSection({
  stats,
  data,
  links,
  sourceNames,
  locale,
}: {
  stats: Stats;
  data: Analytics;
  links: Link[];
  sourceNames: Record<string, string>;
  locale: string;
}) {
  const t = await getTranslations("stats");
  const sourcesT = await getTranslations("sources");
  const tiles = [
    { label: t("views7"), value: stats.views7 },
    { label: t("views30"), value: stats.views30 },
    { label: t("clicks30"), value: stats.clicks30 },
  ];
  return (
    <Card padding="md" className="flex flex-col gap-6">
      <AnalyticsModes data={data} links={links} sourceNames={sourceNames}>
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex min-w-0 flex-col gap-1 rounded-2xl border border-edge p-3 sm:p-4"
            >
              {/* 1971 becomes 1.9k so it fits a phone-width tile; the
                  exact number stays in the tooltip and for screen readers. */}
              <Heading
                as="p"
                size="section"
                className="tabular-nums sm:text-3xl"
              >
                <span aria-hidden title={tile.value.toLocaleString(locale)}>
                  {compactNumber(tile.value, locale)}
                </span>
                <span className="sr-only">{tile.value}</span>
              </Heading>
              <p className="text-xs text-ink-muted sm:text-sm">{tile.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Heading as="h3" size="label">
            {t("clicksPerLink")}
          </Heading>
          <BarList
            empty={t("noLinks")}
            rows={links.map((l) => ({
              key: l.id,
              label: l.title,
              count: stats.clicksByLink[l.id] ?? 0,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Heading as="h3" size="label">
            {t("whereFrom")}
          </Heading>
          <BarList
            empty={t("noVisits")}
            rows={stats.topChannels.map((r) => ({
              key: r.key,
              label: channelLabel(r.key, sourceNames, sourcesT("direct")),
              count: r.count,
            }))}
          />
        </div>
      </AnalyticsModes>
    </Card>
  );
}

// The share card: a picture with the page's QR code and name, to post
// or print. Scanning the code opens the page.
export async function QrSection({
  username,
  version,
  wallets,
  locale,
}: {
  username: string;
  version: string;
  /** Which wallet buttons to show. */
  wallets: { apple: boolean; google: boolean };
  locale: string;
}) {
  const t = await getTranslations("stats");
  return (
    <Card padding="md" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading size="section">{t("shareTitle")}</Heading>
        <p className="leading-relaxed text-ink-soft">{t("shareText")}</p>
      </div>
      <ShareCardPicker
        choices={cardChoices(username, { v: version, lang: locale, wallets })}
        fileName={`${username}-biolyn`}
      />
    </Card>
  );
}
