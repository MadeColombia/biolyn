"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

// Shows "Dashboard" when this browser already has a session, else "Log in".
// getSession() reads the local cookie, so it makes no network request.
// Pass className to restyle it (the homepage uses its own dark style).
export function AccountLink({
  className = "rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700",
}: {
  className?: string;
}) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <Link
      href={signedIn ? "/dashboard" : "/login"}
      className={className}
    >
      {signedIn ? "Dashboard" : "Log in"}
    </Link>
  );
}
