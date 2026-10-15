import { Card, Heading } from "@/components/ui";
import { cardChoices } from "@/lib/qr-card";
import { MAX_SOURCES, sourceUrl } from "@/lib/sources";
import { CopyLinkButton } from "./forms";
import { AddSourceForm, DeleteSource } from "./source-forms";
import { ShareCardDialog } from "./share-card";

const visits = (n: number) => (n === 1 ? "1 visit" : `${n} visits`);

export type Source = { id: string; code: string; label: string };

/**
 * Tracking links: the page address with ?s=<code> on the end. Share a
 * different one in each place, and analytics shows which one people used.
 */
export function SourcesSection({
  sources,
  siteUrl,
  username,
  views30,
  cardVersion,
}: {
  sources: Source[];
  siteUrl: string;
  username: string;
  /** Views in the last 30 days per source code. */
  views30: Record<string, number>;
  /** Changes when the share card looks different, see cardVersion(). */
  cardVersion: string;
}) {
  const rows = sources.map((s) => ({
    ...s,
    url: sourceUrl(siteUrl, username, s.code),
  }));

  return (
    <Card padding="md" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Heading size="section">Tracking links</Heading>
        <p className="text-sm text-ink-muted">
          Make a separate link for each place you share your page, like your
          TikTok bio or a flyer. Analytics then shows how many people came from
          each one.
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
                <p className="truncate font-bold">{s.label}</p>
                <p className="text-sm text-ink-muted tabular-nums">
                  {visits(views30[s.code] ?? 0)} in the last 30 days
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyLinkButton url={s.url} />
                <ShareCardDialog
                  label={s.label}
                  choices={cardChoices(username, {
                    code: s.code,
                    v: cardVersion,
                  })}
                  fileName={`${username}-${s.code}-biolyn`}
                />
                <DeleteSource id={s.id} label={s.label} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        className={rows.length > 0 ? "border-t border-line pt-6" : undefined}
      >
        <AddSourceForm full={rows.length >= MAX_SOURCES} />
      </div>
    </Card>
  );
}
