import { getTranslations } from "next-intl/server";
import { Card, Heading } from "@/components/ui";
import { cardChoices } from "@/lib/qr-card";
import { MAX_SOURCES, sourceUrl } from "@/lib/sources";
import { CopyLinkButton } from "./forms";
import { AddSourceForm, DeleteSource } from "./source-forms";
import { ShareCardDialog } from "./share-card";

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
  cardVersion,
  wallets,
  locale,
}: {
  sources: Source[];
  siteUrl: string;
  username: string;
  /** Views in the last 30 days per source code. */
  views30: Record<string, number>;
  /** Changes when the share card looks different, see cardVersion(). */
  cardVersion: string;
  /** Which wallet buttons to show. */
  wallets: { apple: boolean; google: boolean };
  locale: string;
}) {
  const t = await getTranslations("sources");
  const rows = sources.map((s) => ({
    ...s,
    url: sourceUrl(siteUrl, username, s.code),
  }));

  return (
    <Card padding="none" className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <Heading size="section">{t("title")}</Heading>
        <p className="text-sm text-ink-muted">{t("text")}</p>
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
                  {t("visits", { count: views30[s.code] ?? 0 })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <CopyLinkButton url={s.url} />
                <ShareCardDialog
                  label={s.label}
                  choices={cardChoices(username, {
                    code: s.code,
                    v: cardVersion,
                    lang: locale,
                    wallets,
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
