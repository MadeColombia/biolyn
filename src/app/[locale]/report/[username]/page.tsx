import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Heading, PageShell, Skeleton, container, cx } from "@/components/ui";
import { ReportForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("reportTitle"), robots: { index: false } };
}

export default async function ReportPage(
  props: PageProps<"/[locale]/report/[username]">,
) {
  const t = await getTranslations("report");
  return (
    <PageShell>
      <main
        className={cx(
          container("narrow"),
          "flex flex-1 flex-col gap-8 py-12 sm:py-16",
        )}
      >
        <Suspense
          fallback={
            <div aria-busy="true" className="flex flex-col gap-6">
              <p className="sr-only">{t("loading")}</p>
              <Skeleton className="h-10 w-56 rounded-xl" />
              <Skeleton className="h-10 w-48 rounded-xl" />
              <Skeleton className="h-96 w-full rounded-3xl" />
            </div>
          }
        >
          <Report params={props.params} />
        </Suspense>
      </main>
    </PageShell>
  );
}

async function Report({
  params,
}: Pick<PageProps<"/[locale]/report/[username]">, "params">) {
  const t = await getTranslations("report");
  const { username } = await params;
  const name = username.toLowerCase();
  return (
    <>
      <div className="flex flex-col gap-3">
        <Heading as="h1" size="title" className="leading-tight">
          {t("title")}
        </Heading>
        <p className="self-start rounded-xl border border-edge bg-surface px-4 py-2 font-bold wrap-anywhere text-ink">
          <span className="font-normal text-ink-muted">biolyn.link/</span>
          {name}
        </p>
        <p className="text-lg leading-relaxed text-ink-soft">
          {t("intro")}
        </p>
      </div>
      <ReportForm username={name} />
    </>
  );
}
