import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Nothing here yet</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        This page doesn&apos;t exist, or nobody has claimed this username. It
        could be yours.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        Claim your biolyn.link
      </Link>
    </main>
  );
}
