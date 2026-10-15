import QRCode from "qrcode";
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

export function StatsSection({
  stats,
  data,
  links,
  sourceNames,
}: {
  stats: Stats;
  data: Analytics;
  links: Link[];
  sourceNames: Record<string, string>;
}) {
  const tiles = [
    { label: "Views, 7 days", value: stats.views7 },
    { label: "Views, 30 days", value: stats.views30 },
    { label: "Clicks, 30 days", value: stats.clicks30 },
  ];
  return (
    <Card padding="md" className="flex flex-col gap-6">
      <AnalyticsModes data={data} links={links} sourceNames={sourceNames}>
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="flex min-w-0 flex-col gap-1 rounded-2xl border border-edge p-3 sm:p-4"
            >
              {/* 1971 becomes 1.9k so it fits a phone-width tile; the
                  exact number stays in the tooltip and for screen readers. */}
              <Heading
                as="p"
                size="section"
                className="tabular-nums sm:text-3xl"
              >
                <span aria-hidden title={t.value.toLocaleString("en-US")}>
                  {compactNumber(t.value)}
                </span>
                <span className="sr-only">{t.value}</span>
              </Heading>
              <p className="text-xs text-ink-muted sm:text-sm">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Heading as="h3" size="label">
            Clicks per link, 30 days
          </Heading>
          <BarList
            empty="No links yet."
            rows={links.map((l) => ({
              key: l.id,
              label: l.title,
              count: stats.clicksByLink[l.id] ?? 0,
            }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Heading as="h3" size="label">
            Where visitors come from, 30 days
          </Heading>
          <BarList
            empty="No visits yet. Share your link to start seeing data."
            rows={stats.topChannels.map((r) => ({
              key: r.key,
              label: channelLabel(r.key, sourceNames),
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
  url,
  username,
  version,
}: {
  url: string;
  username: string;
  version: string;
}) {
  const png = await QRCode.toDataURL(url, { margin: 2, width: 1024 });
  return (
    <Card padding="md" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading size="section">Share card</Heading>
        <p className="leading-relaxed text-ink-soft">
          A picture with your QR code to post in a story or print on flyers,
          menus or your shop counter. Scanning it opens your page.
        </p>
      </div>
      <ShareCardPicker
        choices={cardChoices(username, { v: version })}
        fileName={`${username}-biolyn`}
        qrPng={png}
      />
    </Card>
  );
}
