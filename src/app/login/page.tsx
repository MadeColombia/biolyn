"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
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

// Remembers which sign-in method this browser used last, so the login page
// can mark it with a "Last used" badge. Stored only in this browser.
type Method = "google" | "email";
const LAST_METHOD_KEY = "biolyn:last-sign-in";

function readLastMethod(): Method | null {
  try {
    const value = localStorage.getItem(LAST_METHOD_KEY);
    return value === "google" || value === "email" ? value : null;
  } catch {
    return null; // storage blocked, for example in some private windows
  }
}

function saveLastMethod(method: Method) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, method);
  } catch {}
}

function LastUsedBadge() {
  return (
    <span className="absolute -top-2.5 right-3 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
      Last used
    </span>
  );
}

function LoginForm() {
  // Read on the client only; the server render shows no badge.
  const lastMethod = useSyncExternalStore(
    () => () => {},
    readLastMethod,
    () => null,
  );
  // /auth/callback sends people here with ?error=link when the email link
  // was already used or has expired, or Google sign-in was cancelled.
  const linkFailed = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    linkFailed
      ? "Sign-in didn't finish. The email link may have expired or been used already, or Google sign-in was cancelled. Try again."
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
      saveLastMethod("email");
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

  async function signInWithGoogle() {
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    // Sends the browser to Google, then back to /auth/callback with a code.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (error) {
      setError("Google sign-in isn't available right now. Use email instead.");
    } else {
      saveLastMethod("google");
    }
  }

  if (status === "sent") {
    return (
      <p>Check your email for a sign-in link. Open it in this same browser.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="relative rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Continue with Google
        {lastMethod === "google" && <LastUsedBadge />}
      </button>
      <p className="text-center text-sm text-neutral-500">or</p>
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
          className="relative rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
          {lastMethod === "email" && <LastUsedBadge />}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
