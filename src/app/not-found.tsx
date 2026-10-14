import { ButtonLink, Heading, PageShell, container, cx } from "@/components/ui";

// Also shown for usernames nobody has claimed and for suspended pages.
export default function NotFound() {
  return (
    <PageShell>
      <main
        className={cx(
          container("medium"),
          "flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center sm:py-28",
        )}
      >
        <Heading as="h1" size="title" className="sm:text-6xl">
          Nothing here yet
        </Heading>
        <p className="max-w-md text-lg leading-relaxed text-ink-soft">
          This page doesn&apos;t exist, or nobody has claimed this username. It
          could be yours.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/login" size="lg">
            Claim your biolyn.link
          </ButtonLink>
          <ButtonLink href="/" size="lg" variant="secondary">
            Go to the homepage
          </ButtonLink>
        </div>
      </main>
    </PageShell>
  );
}
