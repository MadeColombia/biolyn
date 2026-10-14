import { Suspense } from "react";
import type { Metadata } from "next";
import { Heading, PageShell, container, cx } from "@/components/ui";
import { ReportForm } from "./form";

export const metadata: Metadata = {
  title: "Report a page | Biolyn",
  robots: { index: false },
};

export default function ReportPage(props: PageProps<"/report/[username]">) {
  return (
    <PageShell>
      <main
        className={cx(
          container("narrow"),
          "flex flex-1 flex-col gap-8 py-12 sm:py-16",
        )}
      >
        <Suspense>
          <Report params={props.params} />
        </Suspense>
      </main>
    </PageShell>
  );
}

async function Report({
  params,
}: Pick<PageProps<"/report/[username]">, "params">) {
  const { username } = await params;
  const name = username.toLowerCase();
  return (
    <>
      <div className="flex flex-col gap-3">
        <Heading as="h1" size="title" className="leading-tight">
          Report a page
        </Heading>
        <p className="self-start rounded-xl border border-edge bg-surface px-4 py-2 font-bold wrap-anywhere text-ink">
          <span className="font-normal text-ink-muted">biolyn.link/</span>
          {name}
        </p>
        <p className="text-lg leading-relaxed text-ink-soft">
          Tell us what breaks the rules on this page. The owner won&apos;t see
          who reported it.
        </p>
      </div>
      <ReportForm username={name} />
    </>
  );
}
