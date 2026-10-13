import { Suspense } from "react";
import type { Metadata } from "next";
import { ReportForm } from "./form";

export const metadata: Metadata = {
  title: "Report a page | Biolyn",
  robots: { index: false },
};

export default function ReportPage(props: PageProps<"/report/[username]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-16">
      <Suspense>
        <Report params={props.params} />
      </Suspense>
    </main>
  );
}

async function Report({
  params,
}: Pick<PageProps<"/report/[username]">, "params">) {
  const { username } = await params;
  const name = username.toLowerCase();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Report biolyn.link/{name}</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Tell us what breaks the rules on this page. The owner won&apos;t see
          who reported it.
        </p>
      </div>
      <ReportForm username={name} />
    </>
  );
}
