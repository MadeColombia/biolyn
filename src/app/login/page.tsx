"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  PageShell,
  container,
  cx,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  // header={null}: no "Log in" button pointing at this same page.
  return (
    <PageShell header={null}>
      <main
        className={cx(
          container("narrow"),
          "flex flex-1 flex-col justify-center gap-8 py-12 sm:py-20",
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Heading as="h1" size="title">
            Sign in to Biolyn
          </Heading>
          <p className="text-lg leading-relaxed text-ink-soft">
            Claim your link or pick up where you left off. No password needed.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </PageShell>
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

// The badge sits inside a button, so it takes the opposite tone to stay
// visible: neutral on the terracotta button, brand on the secondary one.
function LastUsedBadge({ onBrand = false }: { onBrand?: boolean }) {
  // Pinned to the button's top corner so the label never wraps on phones.
  return (
    <span className="absolute -top-2.5 right-3">
      <Badge tone={onBrand ? "neutral" : "brand"}>Last used</Badge>
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
      <Card className="flex flex-col gap-3 text-center" role="status">
        <Heading as="h2">Check your email</Heading>
        <p className="leading-relaxed text-ink-soft">
          We sent a sign-in link to{" "}
          <strong className="font-bold break-all text-ink">{email}</strong>.
          Open it in this same browser.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <Button
        type="button"
        className="relative"
        variant="secondary"
        fullWidth
        onClick={signInWithGoogle}
      >
        Continue with Google
        {lastMethod === "google" && <LastUsedBadge />}
      </Button>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="flex-1 border-t border-line" />
        <span className="text-sm text-ink-muted">or</span>
        <span className="flex-1 border-t border-line" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Email"
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button
          type="submit"
          fullWidth
          className="relative"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
          {lastMethod === "email" && <LastUsedBadge onBrand />}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
