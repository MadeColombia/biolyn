import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight">Biolyn</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        One link for everything you share. Put it in your Instagram bio.
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
