"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { button } from "@/components/ui/recipes";
import { createClient } from "@/lib/supabase/browser";

// Shows "Dashboard" when this browser already has a session, else "Log in".
// getSession() reads the local cookie, so it makes no network request.
// Looks like a small secondary button; pass className to restyle it.
export function AccountLink({
  className = button({ variant: "secondary", size: "sm" }),
}: {
  className?: string;
}) {
  const t = useTranslations("shell");
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
      {signedIn ? t("dashboard") : t("logIn")}
    </Link>
  );
}
