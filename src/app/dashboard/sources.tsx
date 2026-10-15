import QRCode from "qrcode";
import { Button, Card, Heading, button } from "@/components/ui";
import { MAX_SOURCES, sourceUrl } from "@/lib/sources";
import { deleteSource } from "./actions";
import { CopyLinkButton } from "./forms";
import { AddSourceForm } from "./source-forms";

export type Source = { id: string; code: string; label: string };

/**
 * Tracking links: the page address with ?s=<code> on the end. Share a
 * different one in each place, and analytics shows which one people used.
 */
export async function SourcesSection({
  sources,
  siteUrl,
  username,
  views30,
}: {
  sources: Source[];
  siteUrl: string;
  username: string;
  /** Views in the last 30 days per source code. */
  views30: Record<string, number>;
}) {
  const rows = await Promise.all(
    sources.map(async (s) => {
      const url = sourceUrl(siteUrl, username, s.code);
      return { ...s, url, qr: await QRCode.toDataURL(url, { margin: 2, width: 1024 }) };
    }),
  );
  const shortSite = siteUrl.replace(/^https?:\/\//, "");

  return (
    <Card padding="md" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading size="section">Tracking links</Heading>
        <p className="text-sm text-ink-muted">
          Your page link with a tag on the end. Share a different one in each
          place (TikTok bio, a newsletter, a flyer) and Analytics shows which
          one people came through. Visitors see the same page.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex items-baseline gap-2">
                  <span className="truncate font-bold">{s.label}</span>
                  <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                    {views30[s.code] ?? 0} views, 30 days
                  </span>
                </p>
                <p className="truncate text-sm text-ink-soft">
                  {shortSite}/{username}
                  <span className="font-bold text-ink">?s={s.code}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyLinkButton url={s.url} label="Copy" />
                <a
                  href={s.qr}
                  download={`biolyn-qr-${s.code}.png`}
                  className={button({ variant: "secondary", size: "sm" })}
                >
                  QR code
                </a>
                <form action={deleteSource.bind(null, s.id)}>
                  <Button variant="danger" size="sm" aria-label={`Delete ${s.label}`}>
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={rows.length > 0 ? "border-t border-line pt-6" : undefined}>
        <AddSourceForm full={rows.length >= MAX_SOURCES} />
      </div>
    </Card>
  );
}
