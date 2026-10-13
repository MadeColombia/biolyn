"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-bold">Sign in to Biolyn</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}

function LoginForm() {
  // /auth/callback sends people here with ?error=link when the email link
  // was already used or has expired.
  const linkFailed = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    linkFailed
      ? "That sign-in link expired or was already used. Request a new one."
      : null,
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (!error) {
      setStatus("sent");
      return;
    }
    setStatus("idle");
    setError(
      error.status === 429
        ? "Too many sign-in emails were sent recently. Use the newest link already in your inbox, or wait an hour and try again."
        : "Something went wrong. Try again.",
    );
  }

  if (status === "sent") {
    return (
      <p>
        Check your email for a sign-in link. Open it in this same browser.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {status === "sending" ? "Sending..." : "Send magic link"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
